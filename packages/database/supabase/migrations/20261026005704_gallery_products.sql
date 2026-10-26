-- Galleries: products of the package that the client decides in the gallery.
--
-- Some packages include a printed book (the client picks the front and back
-- covers) or a canvas (the client picks its photo), always among the photos
-- they marked as favourites. Sizes are inches as sold, short side first
-- («libro 8x11», «canva 16x20»). A horizontal front cover turns an 8×11 book
-- into 11×8, so on rectangular books the back cover must have the same
-- orientation; square books (6×6, 8×8) take any photo.
--
-- The studio sets the products (read from the card notes when the gallery is
-- created, editable). The choices are written by the client page with the
-- service role only, and checked again when the selection is confirmed.

create table public.gallery_products (
  id bigint generated always as identity primary key,
  studio_id bigint not null,
  gallery_id bigint not null,
  kind text not null check (kind in ('book', 'canvas')),
  size_short numeric(3, 1) not null check (size_short between 1 and 99.5),
  size_long numeric(3, 1) not null check (size_long between 1 and 99.5),
  -- Book: front cover. Canvas: the photo.
  photo_id bigint,
  -- Book only: back cover.
  back_photo_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (size_short <= size_long),
  check (kind = 'book' or back_photo_id is null),
  check (back_photo_id is null or back_photo_id <> photo_id),
  foreign key (gallery_id, studio_id) references public.galleries (id, studio_id) on delete cascade,
  -- The photos belong to the same gallery; removing one clears the choice.
  foreign key (photo_id, gallery_id, studio_id)
    references public.gallery_photos (id, gallery_id, studio_id) on delete set null (photo_id),
  foreign key (back_photo_id, gallery_id, studio_id)
    references public.gallery_photos (id, gallery_id, studio_id) on delete set null (back_photo_id)
);

comment on table public.gallery_products is 'Book or canvas included in the package of a gallery, with the photos the client chose for it (front/back cover, canvas photo).';
comment on column public.gallery_products.photo_id is 'Book: front cover. Canvas: the photo. Written by the client page (service role).';
comment on column public.gallery_products.back_photo_id is 'Book: back cover, same orientation as the front on rectangular books. Written by the client page (service role).';

create index gallery_products_gallery_id_studio_id_idx on public.gallery_products (gallery_id, studio_id);
create index gallery_products_studio_id_idx on public.gallery_products (studio_id);
create index gallery_products_photo_id_idx
on public.gallery_products (photo_id, gallery_id, studio_id)
where photo_id is not null;
create index gallery_products_back_photo_id_idx
on public.gallery_products (back_photo_id, gallery_id, studio_id)
where back_photo_id is not null;

alter table public.gallery_products enable row level security;

revoke all on table public.gallery_products from anon, authenticated;
grant select, delete on table public.gallery_products to authenticated;
-- The choices (photo_id, back_photo_id) are the client's: service role only.
grant insert (studio_id, gallery_id, kind, size_short, size_long) on table public.gallery_products to authenticated;
grant select, insert, update, delete on table public.gallery_products to service_role;

-- Visible when the gallery is (galleries RLS applies inside the subquery).
create policy "Members can view gallery products"
on public.gallery_products for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and gallery_id in (select g.id from public.galleries g)
);

create policy "Gallery managers can add products"
on public.gallery_products for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('galleries.manage'))
  and gallery_id in (select g.id from public.galleries g)
);

create policy "Gallery managers can remove products"
on public.gallery_products for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('galleries.manage'))
  and gallery_id in (select g.id from public.galleries g)
);

create trigger gallery_products_set_updated_at
before update on public.gallery_products
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- A photo taken out of the favourites stops being a cover or the canvas
-- ---------------------------------------------------------------------------

create function private.clear_unpicked_product_choices()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.gallery_products
  set photo_id = null
  where gallery_id = new.gallery_id
    and photo_id = new.id;

  update public.gallery_products
  set back_photo_id = null
  where gallery_id = new.gallery_id
    and back_photo_id = new.id;

  return null;
end;
$$;

comment on function private.clear_unpicked_product_choices() is 'Clears the book covers / canvas photo that pointed to a photo the client un-picked.';

revoke execute on function private.clear_unpicked_product_choices() from public, anon, authenticated;

create trigger gallery_photos_clear_product_choices
after update of picked_at on public.gallery_photos
for each row
when (old.picked_at is not null and new.picked_at is null)
execute function private.clear_unpicked_product_choices();

-- ---------------------------------------------------------------------------
-- Confirming requires every product decided
-- ---------------------------------------------------------------------------

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
  undecided integer;
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

  -- Hold the choices while they are checked (a second phone may be choosing).
  perform 1
  from public.gallery_products
  where gallery_id = gallery.id
  for update;

  -- Each product needs its photos among the favourites; a book also a
  -- different back cover, with the front's orientation when it is
  -- rectangular (a square photo counts as vertical, like in the app; a photo
  -- without dimensions is not checked).
  select count(*) into undecided
  from public.gallery_products p
  left join public.gallery_photos f
    on f.id = p.photo_id
   and f.gallery_id = p.gallery_id
   and f.picked_at is not null
   and f.uploaded_at is not null
  left join public.gallery_photos b
    on b.id = p.back_photo_id
   and b.gallery_id = p.gallery_id
   and b.picked_at is not null
   and b.uploaded_at is not null
  where p.gallery_id = gallery.id
    and (
      f.id is null
      or (
        p.kind = 'book'
        and (
          b.id is null
          or (
            p.size_short <> p.size_long
            and (f.width > f.height) <> (b.width > b.height)
          )
        )
      )
    );

  if undecided > 0 then
    raise exception 'Gallery % has % products without their photos', p_gallery_id, undecided
      using errcode = '23514';
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

comment on function public.submit_gallery_selection(bigint, text) is 'Client confirms the selection: checks the book/canvas choices, closes the gallery, moves the card to the submitted stage and logs it. Service role only.';

revoke execute on function public.submit_gallery_selection(bigint, text) from public, anon, authenticated;
grant execute on function public.submit_gallery_selection(bigint, text) to service_role;
