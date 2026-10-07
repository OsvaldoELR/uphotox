-- 1. Card cover photo: a small compressed thumbnail per card, stored in a
--    private Storage bucket under <studio_id>/<card_id>/<file>.
-- 2. Card origin: manual vs received through the inbound webhook, with the
--    caller's id so retries (Make, Zapier…) never create duplicates.
-- 3. studio_integrations: per-studio inbound webhook. Any form tool (Typeform
--    through Make, Google Forms, Zapier, n8n…) posts new clients to a secret URL.

-- ---------------------------------------------------------------------------
-- cards: cover + origin
-- ---------------------------------------------------------------------------

alter table public.cards
add column cover_path text check (char_length(cover_path) <= 300),
add column source text not null default 'manual' check (source in ('manual', 'webhook')),
add column external_id text check (char_length(external_id) <= 200);

comment on column public.cards.cover_path is 'Object path in the card-covers bucket (<studio_id>/<card_id>/<file>.webp).';
comment on column public.cards.external_id is 'Id of the record in the source system (e.g. the form response id), used to ignore retries.';

create unique index cards_studio_id_external_id_idx
on public.cards (studio_id, external_id)
where external_id is not null;

-- Members set the cover; source/external_id are written by the server only.
grant update (cover_path) on table public.cards to authenticated;

-- Same move/edit rules as before, with the cover counted as an edit.
create or replace function private.cards_check_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if (new.stage_id, new.position) is distinct from (old.stage_id, old.position)
       and not private.has_permission('cards.move') then
      raise exception 'Missing permission: cards.move' using errcode = '42501';
    end if;

    if (new.client_id, new.title, new.session_at, new.gallery_url, new.notes, new.assigned_to, new.cover_path)
       is distinct from
       (old.client_id, old.title, old.session_at, old.gallery_url, old.notes, old.assigned_to, old.cover_path)
       and not private.has_permission('cards.edit') then
      raise exception 'Missing permission: cards.edit' using errcode = '42501';
    end if;
  end if;

  if new.stage_id is distinct from old.stage_id then
    new.stage_entered_at := now();
  end if;

  return new;
end;
$$;

revoke execute on function private.cards_check_update() from public, anon, authenticated;

comment on column public.cards.gallery_url is 'Delivery link (e.g. a shared Google Photos album) included in client emails.';

-- ---------------------------------------------------------------------------
-- Storage: card-covers (private; thumbnails only, so small and image-only)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-covers', 'card-covers', false, 524288, array['image/webp', 'image/jpeg', 'image/png']);

create policy "Members can view their studio's card covers"
on storage.objects for select
to authenticated
using (
  bucket_id = 'card-covers'
  and (storage.foldername(name))[1] = (select private.current_studio_id())::text
  and (select private.has_permission('boards.view'))
);

create policy "Card editors can upload card covers"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'card-covers'
  and (storage.foldername(name))[1] = (select private.current_studio_id())::text
  and (select private.has_permission('cards.edit'))
);

create policy "Card editors can delete card covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'card-covers'
  and (storage.foldername(name))[1] = (select private.current_studio_id())::text
  and (select private.has_permission('cards.edit'))
);

-- ---------------------------------------------------------------------------
-- studio_integrations
-- ---------------------------------------------------------------------------

create table public.studio_integrations (
  id bigint generated always as identity primary key,
  studio_id bigint not null references public.studios (id) on delete cascade,
  provider text not null check (provider in ('webhook')),
  enabled boolean not null default true,
  -- Secret part of the webhook URL: whoever has the URL can add clients, so
  -- it is long, random, visible only to settings managers and regenerable.
  token text not null unique check (char_length(token) between 32 and 64),
  -- Where new clients land. Null stage → first stage of the board.
  board_id bigint,
  stage_id bigint,
  last_received_at timestamptz,
  last_error text check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, provider),
  foreign key (board_id, studio_id) references public.boards (id, studio_id) on delete set null (board_id),
  foreign key (stage_id, board_id) references public.board_stages (id, board_id) on delete set null (stage_id)
);

comment on table public.studio_integrations is 'Inbound webhook per studio. The API endpoint reads it with the service role by token.';

create index studio_integrations_board_id_studio_id_idx on public.studio_integrations (board_id, studio_id);
create index studio_integrations_stage_id_board_id_idx on public.studio_integrations (stage_id, board_id);

alter table public.studio_integrations enable row level security;

revoke all on table public.studio_integrations from anon, authenticated;
grant select, delete on table public.studio_integrations to authenticated;
grant insert (studio_id, provider, enabled, token, board_id, stage_id) on table public.studio_integrations to authenticated;
grant update (enabled, token, board_id, stage_id) on table public.studio_integrations to authenticated;
grant select, insert, update, delete on table public.studio_integrations to service_role;

create policy "Settings managers can view integrations"
on public.studio_integrations for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
);

create policy "Settings managers can add integrations"
on public.studio_integrations for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
);

create policy "Settings managers can update integrations"
on public.studio_integrations for update
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
)
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
);

create policy "Settings managers can remove integrations"
on public.studio_integrations for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
);

create trigger studio_integrations_set_updated_at
before update on public.studio_integrations
for each row execute function private.set_updated_at();
