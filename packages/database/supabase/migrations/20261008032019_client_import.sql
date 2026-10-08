-- Clients module: bulk import from a CSV (clients whose session is already
-- booked). The app parses and checks the file in the browser; this function
-- writes the whole batch in one transaction, as the caller (RLS applies):
-- 1. Reuses an existing client with the same email (or else the same phone
--    digits) and fills in the contact fields it was missing.
-- 2. Creates one card per row in the chosen stage, marked source = 'import'.
-- 3. Skips rows whose external_id is already on a card, so importing the same
--    file twice does not duplicate anything.
-- Importing never emails anyone (that only happens when a card moves).

-- ---------------------------------------------------------------------------
-- cards: new origin, writable by members only for manual/import
-- ---------------------------------------------------------------------------

alter table public.cards drop constraint cards_source_check;
alter table public.cards add constraint cards_source_check
check (source in ('manual', 'webhook', 'import'));

grant insert (source, external_id) on table public.cards to authenticated;

-- Same rule as before, plus: members cannot pass a card off as a webhook one.
drop policy "Members can create cards" on public.cards;

create policy "Members can create cards"
on public.cards for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('cards.create'))
  and (
    not (select private.only_assigned())
    or assigned_to = (select auth.uid())
  )
  and source in ('manual', 'import')
);

-- ---------------------------------------------------------------------------
-- clients: lookups used to recognise a returning client
-- ---------------------------------------------------------------------------

create index clients_studio_id_email_idx
on public.clients (studio_id, lower(email))
where email is not null;

create index clients_studio_id_phone_digits_idx
on public.clients (studio_id, regexp_replace(phone, '\D', '', 'g'))
where phone is not null;

-- ---------------------------------------------------------------------------
-- import_cards
-- ---------------------------------------------------------------------------

-- entries: [{ line, client_name, email, phone, title, session_at, notes,
-- external_id }]. Returns { created, clients_created, clients_matched,
-- skipped: [line…] }.
create or replace function public.import_cards(
  target_board_id bigint,
  target_stage_id bigint,
  entries jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  studio bigint := (select private.current_studio_id());
  caller uuid := (select auth.uid());
  restricted boolean := (select private.only_assigned());
  entry jsonb;
  row_email text;
  row_phone text;
  email_key text;
  phone_key text;
  ext_id text;
  client bigint;
  client_is_new boolean;
  new_card bigint;
  next_position double precision;
  created_cards integer := 0;
  created_clients bigint[] := '{}';
  matched_clients bigint[] := '{}';
  skipped jsonb := '[]'::jsonb;
begin
  if studio is null then
    raise exception 'The caller has no studio' using errcode = '42501';
  end if;

  if jsonb_typeof(entries) is distinct from 'array'
     or jsonb_array_length(entries) > 500 then
    raise exception 'entries must be an array of at most 500 items'
    using errcode = '22023';
  end if;

  -- RLS: only stages of the caller's studio are visible.
  if not exists (
    select 1 from public.board_stages s
    where s.id = target_stage_id and s.board_id = target_board_id
  ) then
    raise exception 'Stage not found on that board' using errcode = 'P0002';
  end if;

  select coalesce(max(c.position), 0) into next_position
  from public.cards c
  where c.stage_id = target_stage_id;

  for entry in select value from jsonb_array_elements(entries) loop
    ext_id := nullif(btrim(entry ->> 'external_id'), '');

    if ext_id is not null and exists (
      select 1 from public.cards c
      where c.studio_id = studio and c.external_id = ext_id
    ) then
      skipped := skipped || jsonb_build_array(entry -> 'line');
      continue;
    end if;

    row_email := nullif(btrim(entry ->> 'email'), '');
    row_phone := nullif(btrim(entry ->> 'phone'), '');
    email_key := lower(row_email);
    phone_key := nullif(regexp_replace(coalesce(row_phone, ''), '\D', '', 'g'), '');

    if char_length(phone_key) < 7 then
      phone_key := null;
    end if;

    client := null;

    if email_key is not null then
      select cl.id into client
      from public.clients cl
      where cl.studio_id = studio and lower(cl.email) = email_key
      order by cl.id
      limit 1;
    end if;

    if client is null and phone_key is not null then
      select cl.id into client
      from public.clients cl
      where cl.studio_id = studio
        and regexp_replace(cl.phone, '\D', '', 'g') = phone_key
      order by cl.id
      limit 1;
    end if;

    client_is_new := client is null;

    if client_is_new then
      insert into public.clients (studio_id, full_name, email, phone)
      values (studio, btrim(entry ->> 'client_name'), row_email, row_phone)
      returning id into client;
    else
      -- Fill in what the studio did not have yet; never overwrite.
      update public.clients cl
      set
        email = coalesce(cl.email, row_email),
        phone = coalesce(cl.phone, row_phone)
      where cl.id = client
        and (
          (cl.email is null and row_email is not null)
          or (cl.phone is null and row_phone is not null)
        );
    end if;

    next_position := next_position + 1024;
    new_card := null;

    insert into public.cards (
      studio_id, board_id, stage_id, client_id, title, session_at, notes,
      position, assigned_to, source, external_id
    )
    values (
      studio,
      target_board_id,
      target_stage_id,
      client,
      btrim(entry ->> 'title'),
      nullif(entry ->> 'session_at', '')::timestamptz,
      nullif(btrim(entry ->> 'notes'), ''),
      next_position,
      -- Restricted members only see their own cards, so they own new ones.
      case when restricted then caller end,
      'import',
      ext_id
    )
    -- A card this member cannot see may already hold the id.
    on conflict (studio_id, external_id) where external_id is not null
    do nothing
    returning id into new_card;

    if new_card is null then
      if client_is_new then
        delete from public.clients cl where cl.id = client;
      end if;

      skipped := skipped || jsonb_build_array(entry -> 'line');
      continue;
    end if;

    created_cards := created_cards + 1;

    if client_is_new then
      created_clients := created_clients || client;
    elsif not (client = any (created_clients) or client = any (matched_clients)) then
      matched_clients := matched_clients || client;
    end if;
  end loop;

  return jsonb_build_object(
    'created', created_cards,
    'clients_created', cardinality(created_clients),
    'clients_matched', cardinality(matched_clients),
    'skipped', skipped
  );
end;
$$;

comment on function public.import_cards(bigint, bigint, jsonb) is 'Bulk import of booked clients from a CSV into one board stage. Runs as the caller (RLS applies); never sends email.';

revoke execute on function public.import_cards(bigint, bigint, jsonb) from public, anon;
grant execute on function public.import_cards(bigint, bigint, jsonb) to authenticated;
