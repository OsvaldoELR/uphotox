-- Editor module: AI background clean-up of the photos a client picked.
-- The studio uploads the full-size exports; the Cloudflare service cleans
-- them. Objects in R2: editor/<studio_id>/<gallery_id>/<edit_photo_id>/
-- (original.jpg, result.jpg, preview.jpg, zones.jpg, framed*.jpg,
-- info.json, status.json; see @repo/storage/editor).

-- An edit photo points at a gallery photo of the same gallery and studio.
alter table public.gallery_photos
  add constraint gallery_photos_id_gallery_id_studio_id_key unique (id, gallery_id, studio_id);

-- ---------------------------------------------------------------------------
-- edit_photos: one cleaned version per picked gallery photo
-- ---------------------------------------------------------------------------

create table public.edit_photos (
  id bigint generated always as identity primary key,
  studio_id bigint not null references public.studios (id) on delete cascade,
  gallery_id bigint not null,
  gallery_photo_id bigint not null,
  -- Name of the full-size export (e.g. DSCF7325.jpg).
  file_name text not null check (char_length(file_name) between 1 and 255),
  bytes bigint not null check (bytes > 0),
  -- uploading → queued → processing → done | failed (service role only).
  status text not null default 'uploading'
    check (status in ('uploading', 'queued', 'processing', 'done', 'failed')),
  -- Times it was sent to the engine; each run is a row in edit_usage.
  runs integer not null default 0 check (runs >= 0),
  score smallint check (score between 0 and 10),
  needs_review boolean not null default false,
  review_comment text check (char_length(review_comment) <= 2000),
  error text check (char_length(error) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  queued_at timestamptz,
  finished_at timestamptz,
  unique (id, studio_id),
  -- One row per gallery photo (a redo reuses it). Also covers the FK below.
  unique (gallery_photo_id, gallery_id, studio_id),
  foreign key (gallery_id, studio_id) references public.galleries (id, studio_id) on delete cascade,
  foreign key (gallery_photo_id, gallery_id, studio_id) references public.gallery_photos (id, gallery_id, studio_id) on delete cascade
);

comment on table public.edit_photos is 'Background clean-up of a picked gallery photo. Status and results are written by the server (service role) from the Cloudflare service.';

create index edit_photos_studio_id_idx on public.edit_photos (studio_id);
create index edit_photos_gallery_id_studio_id_idx on public.edit_photos (gallery_id, studio_id);
create index edit_photos_created_by_idx on public.edit_photos (created_by);

alter table public.edit_photos enable row level security;

revoke all on table public.edit_photos from anon, authenticated;
grant select, delete on table public.edit_photos to authenticated;
grant insert (studio_id, gallery_id, gallery_photo_id, file_name, bytes) on table public.edit_photos to authenticated;
grant select, insert, update, delete on table public.edit_photos to service_role;

-- Visible when the gallery is (galleries RLS applies inside the subquery).
create policy "Editors can view edit photos"
on public.edit_photos for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('editor.access'))
  and gallery_id in (select g.id from public.galleries g)
);

create policy "Editors can add edit photos"
on public.edit_photos for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('editor.access'))
  and gallery_id in (select g.id from public.galleries g)
);

create policy "Editors can delete edit photos"
on public.edit_photos for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('editor.access'))
  and gallery_id in (select g.id from public.galleries g)
);

-- ---------------------------------------------------------------------------
-- edit_usage: what each run cost (the studio's consumption)
-- ---------------------------------------------------------------------------
-- Kept when the photo or the gallery goes, so the month's consumption stays.

create table public.edit_usage (
  id bigint generated always as identity primary key,
  studio_id bigint not null references public.studios (id) on delete cascade,
  edit_photo_id bigint,
  gallery_id bigint,
  run integer not null check (run > 0),
  cost numeric(10, 4) not null check (cost >= 0),
  succeeded boolean not null,
  created_at timestamptz not null default now(),
  -- A run is counted once, however many times its status is read.
  unique (edit_photo_id, run),
  foreign key (edit_photo_id, studio_id) references public.edit_photos (id, studio_id) on delete set null (edit_photo_id),
  foreign key (gallery_id, studio_id) references public.galleries (id, studio_id) on delete set null (gallery_id)
);

comment on table public.edit_usage is 'Cost of each Editor run, for the consumption panel. Written by the server (service role only).';

create index edit_usage_studio_id_created_at_idx on public.edit_usage (studio_id, created_at);
create index edit_usage_edit_photo_id_studio_id_idx on public.edit_usage (edit_photo_id, studio_id);
create index edit_usage_gallery_id_studio_id_idx on public.edit_usage (gallery_id, studio_id);

alter table public.edit_usage enable row level security;

revoke all on table public.edit_usage from anon, authenticated;
grant select on table public.edit_usage to authenticated;
grant select, insert on table public.edit_usage to service_role;

create policy "Editors and settings managers can view usage"
on public.edit_usage for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (
    (select private.has_permission('editor.access'))
    or (select private.has_permission('settings.manage'))
  )
);

-- ---------------------------------------------------------------------------
-- R2 clean-up: deleting edit photos (directly or by cascade) queues their
-- objects in storage_deletions, like gallery photos.
-- ---------------------------------------------------------------------------

create or replace function private.edit_photos_queue_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.storage_deletions (object_key)
  select format('editor/%s/%s/%s/%s', d.studio_id, d.gallery_id, d.id, file.name)
  from deleted_photos d
  cross join (
    values
      ('original.jpg'), ('result.jpg'), ('preview.jpg'), ('zones.jpg'),
      ('framed.jpg'), ('framed-preview.jpg'), ('info.json'), ('status.json')
  ) as file (name);

  return null;
end;
$$;

revoke execute on function private.edit_photos_queue_deletion() from public, anon, authenticated;

create trigger edit_photos_queue_deletion
after delete on public.edit_photos
referencing old table as deleted_photos
for each statement execute function private.edit_photos_queue_deletion();
