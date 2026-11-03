-- Galleries: studio settings for books and for the full unedited gallery.
--
-- 1. Not every book has a back cover (Lente Libre's 6×6 does not). Each
--    studio lists its book sizes and says which ones have one; a gallery
--    product copies that when it is created, so the client only chooses a
--    back cover when the book has it. Sizes the studio did not list keep one.
-- 2. A studio can offer the whole session unedited (e.g. $100, minimal colour
--    retouch). The client sees the offer once they confirm their selection
--    and asks for it through the studio's WhatsApp; there are no payments.

-- ---------------------------------------------------------------------------
-- studios: full unedited gallery offer
-- ---------------------------------------------------------------------------

alter table public.studios
add column full_gallery_price numeric(10, 2)
  check (full_gallery_price between 0 and 99999),
add column full_gallery_note text
  check (char_length(full_gallery_note) <= 300);

comment on column public.studios.full_gallery_price is 'Price of the whole session unedited, offered to the client after confirming their selection. Null = not offered.';
comment on column public.studios.full_gallery_note is 'What the full unedited gallery includes, as the client reads it. Null = the app''s default text.';

grant update (full_gallery_price, full_gallery_note) on table public.studios to authenticated;

-- ---------------------------------------------------------------------------
-- book_formats: the studio's book sizes and whether they have a back cover
-- ---------------------------------------------------------------------------

create table public.book_formats (
  id bigint generated always as identity primary key,
  studio_id bigint not null references public.studios (id) on delete cascade,
  -- Inches as sold, short side first (same as gallery_products).
  size_short numeric(3, 1) not null check (size_short between 1 and 99.5),
  size_long numeric(3, 1) not null check (size_long between 1 and 99.5),
  back_cover boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (size_short <= size_long),
  unique (studio_id, size_short, size_long)
);

comment on table public.book_formats is 'Book sizes a studio sells and whether each has a back cover for the client to choose. Sizes not listed have one.';

alter table public.book_formats enable row level security;

revoke all on table public.book_formats from anon, authenticated;
grant select, delete on table public.book_formats to authenticated;
grant insert (studio_id, size_short, size_long, back_cover) on table public.book_formats to authenticated;
grant update (back_cover) on table public.book_formats to authenticated;
grant select, insert, update, delete on table public.book_formats to service_role;

-- Every member reads them (creating a gallery applies them); settings
-- managers change them.
create policy "Members can view book formats"
on public.book_formats for select
to authenticated
using (studio_id = (select private.current_studio_id()));

create policy "Settings managers can add book formats"
on public.book_formats for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
);

create policy "Settings managers can update book formats"
on public.book_formats for update
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
)
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
);

create policy "Settings managers can remove book formats"
on public.book_formats for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
);

create trigger book_formats_set_updated_at
before update on public.book_formats
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- gallery_products: does this book have a back cover?
-- ---------------------------------------------------------------------------

alter table public.gallery_products
add column back_cover boolean not null default true;

comment on column public.gallery_products.back_cover is 'Book with a back cover for the client to choose (copied from the studio''s book formats). Always false for a canvas.';

update public.gallery_products
set back_cover = false
where kind = 'canvas';

alter table public.gallery_products
add constraint gallery_products_back_cover_kind_check
  check (kind = 'book' or not back_cover),
add constraint gallery_products_back_cover_photo_check
  check (back_cover or back_photo_id is null);

grant insert (back_cover) on table public.gallery_products to authenticated;

-- ---------------------------------------------------------------------------
-- Confirming asks for a back cover only when the book has one
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

  -- Each product needs its photos among the favourites; a book with a back
  -- cover also a different one, with the front's orientation when the book
  -- is rectangular (a square photo counts as vertical, like in the app; a
  -- photo without dimensions is not checked).
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
        and p.back_cover
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
