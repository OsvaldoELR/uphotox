-- Editor, phase 3: the studio reviews each cleaned photo (approve, redo
-- with a note, discard), downloads the approved ones, and sets how the
-- editor works in Ajustes.

-- ---------------------------------------------------------------------------
-- Review of each photo
-- ---------------------------------------------------------------------------

alter table public.edit_photos
  add column review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'discarded')),
  -- The studio's instruction for the last redo (added to the AI's fixes).
  add column note text check (char_length(note) <= 500),
  add column reviewed_at timestamptz,
  add column downloaded_at timestamptz;

comment on column public.edit_photos.review_status is 'pending until the studio approves the cleaned photo or discards it (keeps the original).';

-- Members review and mark downloads; status, costs and notes for the
-- service stay with the server (service role).
grant update (review_status, reviewed_at, downloaded_at) on table public.edit_photos to authenticated;

create policy "Editors can review edit photos"
on public.edit_photos for update
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('editor.access'))
  and gallery_id in (select g.id from public.galleries g)
)
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('editor.access'))
);

-- ---------------------------------------------------------------------------
-- Editor settings of the studio (Ajustes → Editor, settings.manage)
-- ---------------------------------------------------------------------------

alter table public.studios
  -- Remove a helper's hand holding the child.
  add column editor_helpers boolean not null default true,
  -- Straighten and crop the results in the studio's style.
  add column editor_framing boolean not null default false,
  -- Optional monthly spending cap (USD): no new photos once reached.
  add column editor_monthly_limit numeric(10, 2) check (editor_monthly_limit >= 0),
  -- Days the editor keeps originals and results before deleting them.
  add column editor_keep_days integer not null default 30
    check (editor_keep_days between 7 and 365);

grant update (editor_helpers, editor_framing, editor_monthly_limit, editor_keep_days) on table public.studios to authenticated;

-- ---------------------------------------------------------------------------
-- The engine now also stores the original's preview (before.jpg): include
-- it in the R2 clean-up of deleted photos.
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
      ('original.jpg'), ('before.jpg'), ('result.jpg'), ('preview.jpg'),
      ('zones.jpg'), ('framed.jpg'), ('framed-preview.jpg'), ('info.json'),
      ('status.json')
  ) as file (name);

  return null;
end;
$$;

revoke execute on function private.edit_photos_queue_deletion() from public, anon, authenticated;
