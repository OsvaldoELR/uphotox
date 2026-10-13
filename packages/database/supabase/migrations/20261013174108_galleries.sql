-- Galleries module, first part: selection galleries (replaces Pixieset).
--
-- The studio uploads the watermarked previews it exports from Lightroom; the
-- client opens a secret link (no account), marks favourites and confirms. The
-- studio then copies the chosen file names back into Lightroom.
--
-- Photos live in Cloudflare R2, not Supabase Storage, under
--   <studio_id>/<gallery_id>/<photo_id>.jpg    (preview, as exported)
--   <studio_id>/<gallery_id>/<photo_id>_t.jpg  (thumbnail made in the browser)
-- R2 has no RLS: the app only hands out short-lived presigned URLs, to members
-- after these policies pass and to the client after the token matches. The
-- client side runs on the server with the service role, scoped to the gallery
-- found by its token.

-- ---------------------------------------------------------------------------
-- Permissions: galleries.view / galleries.manage
-- ---------------------------------------------------------------------------

alter table public.studio_members drop constraint studio_members_permissions_check;
alter table public.studio_members add constraint studio_members_permissions_check
check (
  permissions <@ array[
    'boards.view', 'boards.manage',
    'cards.create', 'cards.edit', 'cards.move', 'cards.delete',
    'clients.view', 'clients.manage',
    'galleries.view', 'galleries.manage',
    'editor.access',
    'team.manage',
    'settings.manage'
  ]::text[]
);

-- ---------------------------------------------------------------------------
-- studios: price of each photo chosen above the package
-- ---------------------------------------------------------------------------

alter table public.studios
add column extra_photo_price numeric(10, 2) not null default 20
  check (extra_photo_price between 0 and 99999);

comment on column public.studios.extra_photo_price is 'Price of each photo a client picks above the number included in their package. Copied to each gallery when it is created.';

grant update (extra_photo_price) on table public.studios to authenticated;

-- ---------------------------------------------------------------------------
-- board_stages: which stage a card moves to when a gallery is sent / picked
-- ---------------------------------------------------------------------------

alter table public.board_stages
add column gallery_role text check (gallery_role in ('sent', 'submitted'));

comment on column public.board_stages.gallery_role is 'sent: the card moves here when its gallery is sent to the client. submitted: when the client confirms the selection. At most one stage per role and board.';

create unique index board_stages_board_id_gallery_role_idx
on public.board_stages (board_id, gallery_role)
where gallery_role is not null;

grant insert (gallery_role) on table public.board_stages to authenticated;
grant update (gallery_role) on table public.board_stages to authenticated;

-- Existing boards made from the default template keep working without setup
-- (first stage with that name per board, in case a board repeats it).
update public.board_stages
set gallery_role = 'sent'
where id in (
  select distinct on (board_id) id
  from public.board_stages
  where name = 'Enviadas para escoger'
  order by board_id, position
);

update public.board_stages
set gallery_role = 'submitted'
where id in (
  select distinct on (board_id) id
  from public.board_stages
  where name = 'Escogidas'
  order by board_id, position
);

-- ---------------------------------------------------------------------------
-- card_events: gallery milestones in the card history
-- ---------------------------------------------------------------------------

alter table public.card_events drop constraint card_events_kind_check;
alter table public.card_events add constraint card_events_kind_check
check (
  kind in (
    'created', 'moved', 'email_sent', 'email_failed',
    'gallery_sent', 'gallery_submitted', 'gallery_reopened'
  )
);

-- ---------------------------------------------------------------------------
-- galleries: one selection gallery per card
-- ---------------------------------------------------------------------------

create table public.galleries (
  id bigint generated always as identity primary key,
  studio_id bigint not null references public.studios (id) on delete cascade,
  card_id bigint not null,
  -- Secret part of the client link. Long, random, regenerable.
  token text not null unique check (char_length(token) between 32 and 64),
  -- draft: uploading, client link closed. open: the client can pick.
  -- submitted: the client confirmed (locked until the studio reopens it).
  -- "Expired" is open with expires_at in the past.
  status text not null default 'draft' check (status in ('draft', 'open', 'submitted')),
  -- Photos included in the package; null = no limit (nothing counts as extra).
  included_count integer check (included_count between 0 and 2000),
  extra_price numeric(10, 2) not null check (extra_price between 0 and 99999),
  sent_at timestamptz,
  expires_at timestamptz,
  submitted_at timestamptz,
  client_note text check (char_length(client_note) <= 1000),
  -- Photos removed from R2 after the retention period; rows (file names and
  -- picks) are kept as history.
  purged_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One gallery per card. A card belongs to a single studio, so the pair is
  -- as unique as card_id alone, and it covers the composite foreign key.
  unique (card_id, studio_id),
  unique (id, studio_id),
  foreign key (card_id, studio_id) references public.cards (id, studio_id) on delete cascade
);

comment on table public.galleries is 'Selection gallery of a card: the client picks favourites through a secret link (read by token with the service role).';

create index galleries_studio_id_status_idx on public.galleries (studio_id, status);
create index galleries_created_by_idx on public.galleries (created_by);

alter table public.galleries enable row level security;

revoke all on table public.galleries from anon, authenticated;
grant select, delete on table public.galleries to authenticated;
grant insert (studio_id, card_id, token, included_count, extra_price) on table public.galleries to authenticated;
-- client_note and purged_at are written by the server only.
grant update (token, status, included_count, extra_price, sent_at, expires_at, submitted_at) on table public.galleries to authenticated;
grant select, insert, update, delete on table public.galleries to service_role;

-- A gallery is visible when its card is (cards RLS: boards.view and
-- only_assigned apply inside the subquery).
create policy "Members can view galleries"
on public.galleries for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (
    (select private.has_permission('galleries.view'))
    or (select private.has_permission('galleries.manage'))
  )
  and card_id in (select c.id from public.cards c)
);

create policy "Gallery managers can create galleries"
on public.galleries for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('galleries.manage'))
  and card_id in (select c.id from public.cards c)
);

create policy "Gallery managers can update galleries"
on public.galleries for update
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('galleries.manage'))
  and card_id in (select c.id from public.cards c)
)
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('galleries.manage'))
);

create policy "Gallery managers can delete galleries"
on public.galleries for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('galleries.manage'))
  and card_id in (select c.id from public.cards c)
);

create trigger galleries_set_updated_at
before update on public.galleries
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- gallery_photos
-- ---------------------------------------------------------------------------

create table public.gallery_photos (
  id bigint generated always as identity primary key,
  studio_id bigint not null,
  gallery_id bigint not null,
  -- Name of the exported file (e.g. IMG_1234.jpg). Without the extension it
  -- matches the original in the Lightroom catalogue.
  file_name text not null check (char_length(file_name) between 1 and 255),
  bytes integer not null check (bytes > 0),
  width integer check (width > 0),
  height integer check (height > 0),
  -- Set once the browser has uploaded both files to R2.
  uploaded_at timestamptz,
  -- Marked as favourite by the client (service role only).
  picked_at timestamptz,
  created_at timestamptz not null default now(),
  -- One row per file name in a gallery (studio_id adds nothing to the
  -- uniqueness but makes this the covering index of the foreign key).
  unique (gallery_id, studio_id, file_name),
  foreign key (gallery_id, studio_id) references public.galleries (id, studio_id) on delete cascade
);

comment on table public.gallery_photos is 'Photos of a selection gallery. Objects in R2: <studio_id>/<gallery_id>/<id>.jpg and <id>_t.jpg.';

create index gallery_photos_studio_id_idx on public.gallery_photos (studio_id);

alter table public.gallery_photos enable row level security;

revoke all on table public.gallery_photos from anon, authenticated;
grant select, delete on table public.gallery_photos to authenticated;
grant insert (studio_id, gallery_id, file_name, bytes, width, height) on table public.gallery_photos to authenticated;
grant update (uploaded_at) on table public.gallery_photos to authenticated;
grant select, insert, update, delete on table public.gallery_photos to service_role;

-- Visible when the gallery is (galleries RLS applies inside the subquery).
create policy "Members can view gallery photos"
on public.gallery_photos for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and gallery_id in (select g.id from public.galleries g)
);

create policy "Gallery managers can add photos"
on public.gallery_photos for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('galleries.manage'))
  and gallery_id in (select g.id from public.galleries g)
);

create policy "Gallery managers can update photos"
on public.gallery_photos for update
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('galleries.manage'))
  and gallery_id in (select g.id from public.galleries g)
)
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('galleries.manage'))
);

create policy "Gallery managers can delete photos"
on public.gallery_photos for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('galleries.manage'))
  and gallery_id in (select g.id from public.galleries g)
);

-- ---------------------------------------------------------------------------
-- storage_deletions: R2 objects waiting to be removed
-- ---------------------------------------------------------------------------
-- Deleting a photo, gallery, card, board or client cascades in Postgres but
-- cannot reach R2. A trigger queues the object keys here; the server empties
-- the queue right after a delete and a daily job sweeps what is left.

create table public.storage_deletions (
  id bigint generated always as identity primary key,
  object_key text not null check (char_length(object_key) <= 300),
  created_at timestamptz not null default now()
);

comment on table public.storage_deletions is 'R2 object keys to delete. Written by triggers, emptied by the server (service role only).';

alter table public.storage_deletions enable row level security;

revoke all on table public.storage_deletions from anon, authenticated;
grant select, insert, delete on table public.storage_deletions to service_role;

-- SECURITY DEFINER: members cannot write the queue themselves, but their
-- deletes (already checked by RLS) must still enqueue the objects.
create or replace function private.gallery_photos_queue_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.storage_deletions (object_key)
  select format('%s/%s/%s%s', d.studio_id, d.gallery_id, d.id, suffix.value)
  from deleted_photos d
  cross join (values ('.jpg'), ('_t.jpg')) as suffix (value);

  return null;
end;
$$;

revoke execute on function private.gallery_photos_queue_deletion() from public, anon, authenticated;

create trigger gallery_photos_queue_deletion
after delete on public.gallery_photos
referencing old table as deleted_photos
for each statement execute function private.gallery_photos_queue_deletion();
