-- Galleries, second part: the client confirms the selection.
--
-- The client page has no session: the server finds the gallery by its token
-- and acts with the service role. Confirming must lock the gallery, close it,
-- move the card to the board's "submitted" stage and write the history in one
-- transaction (a double tap must not confirm twice), so it lives here and
-- only the service role may execute it.

create or replace function public.submit_gallery_selection(
  p_gallery_id bigint,
  p_client_note text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  gallery public.galleries%rowtype;
  card public.cards%rowtype;
  picked integer;
  extras integer;
  target_stage_id bigint;
begin
  select * into gallery
  from public.galleries
  where id = p_gallery_id
  for update;

  if not found then
    raise exception 'Gallery % not found', p_gallery_id using errcode = 'P0002';
  end if;

  if gallery.status <> 'open'
     or gallery.purged_at is not null
     or (gallery.expires_at is not null and gallery.expires_at <= now()) then
    raise exception 'Gallery % is not open', p_gallery_id using errcode = '55000';
  end if;

  select count(*) into picked
  from public.gallery_photos
  where gallery_id = gallery.id
    and picked_at is not null
    and uploaded_at is not null;

  if picked = 0 then
    raise exception 'Gallery % has no picked photos', p_gallery_id using errcode = '22023';
  end if;

  extras := case
    when gallery.included_count is null then 0
    else greatest(picked - gallery.included_count, 0)
  end;

  update public.galleries
  set status = 'submitted',
      submitted_at = now(),
      client_note = nullif(btrim(left(coalesce(p_client_note, ''), 1000)), '')
  where id = gallery.id;

  select * into card
  from public.cards
  where id = gallery.card_id
  for update;

  select s.id into target_stage_id
  from public.board_stages s
  where s.board_id = card.board_id
    and s.gallery_role = 'submitted';

  if target_stage_id is not null and target_stage_id <> card.stage_id then
    -- First in the stage, like a card added at the top. The card triggers
    -- record the move (no user: the service role is trusted).
    update public.cards
    set stage_id = target_stage_id,
        position = coalesce(
          (select min(c.position) from public.cards c where c.stage_id = target_stage_id),
          1024
        ) - 1024
    where id = card.id;
  else
    target_stage_id := null;
  end if;

  insert into public.card_events (studio_id, card_id, kind, detail)
  values (
    gallery.studio_id,
    gallery.card_id,
    'gallery_submitted',
    case
      when extras = 0 then format('%s fotos', picked)
      when extras = 1 then format('%s fotos (1 extra)', picked)
      else format('%s fotos (%s extras)', picked, extras)
    end
  );

  return jsonb_build_object(
    'picked', picked,
    'extras', extras,
    'card_id', card.id,
    'from_stage_id', card.stage_id,
    'to_stage_id', target_stage_id
  );
end;
$$;

comment on function public.submit_gallery_selection(bigint, text) is 'Client confirms the selection: closes the gallery, moves the card to the submitted stage and logs it. Service role only.';

revoke execute on function public.submit_gallery_selection(bigint, text) from public, anon, authenticated;
grant execute on function public.submit_gallery_selection(bigint, text) to service_role;
