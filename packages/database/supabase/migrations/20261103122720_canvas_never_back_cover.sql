-- A canvas never has a back cover. gallery_products.back_cover defaults to
-- true (right for books), so an insert that does not set it for a canvas
-- would break gallery_products_back_cover_kind_check: the app version live
-- before this change does exactly that. Normalise it in the database.

create function private.canvas_without_back_cover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> 'book' then
    new.back_cover := false;
  end if;

  return new;
end;
$$;

comment on function private.canvas_without_back_cover() is 'Keeps gallery_products.back_cover false for anything that is not a book.';

revoke execute on function private.canvas_without_back_cover() from public, anon, authenticated;

create trigger gallery_products_canvas_without_back_cover
before insert or update of kind, back_cover on public.gallery_products
for each row execute function private.canvas_without_back_cover();
