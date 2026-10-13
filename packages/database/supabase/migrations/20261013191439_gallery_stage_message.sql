-- The default «Enviadas para escoger» message asked the client to reply with
-- their selection. With the selection gallery they confirm on the page and
-- the email carries «Elegir mis fotos». Only stages still holding that exact
-- default text change (customised ones stay).

update public.board_stages
set client_message = E'Tus fotos están listas para que elijas tus favoritas.\n\nMárcalas con el corazón en tu galería y pulsa «Confirmar selección» cuando termines.'
where client_message = E'Tus fotos están listas para que elijas tus favoritas.\n\nRevisa tu galería y avísanos con tu selección.';
