-- Editor: full edit and demand levels. Each photo says how it is cleaned
-- (only the backdrop, or everything but the faces), how demanding (one
-- model, the best of two, or the best of two plus a second pass) and, with
-- one model, which one. The studio sets the defaults in Ajustes → Editor.

alter table public.edit_photos
  add column mode text not null default 'fondo'
    check (mode in ('fondo', 'completa')),
  add column level smallint not null default 1
    check (level between 1 and 3),
  -- Model chosen for level 1 (null: the default for the mode).
  add column model text check (model in ('gpt', 'nbpro')),
  -- Model whose result was kept (service role).
  add column winner text check (winner in ('gpt', 'nbpro'));

comment on column public.edit_photos.mode is 'fondo: backdrop and floor only (people original); completa: everything but the faces.';
comment on column public.edit_photos.level is '1: one model; 2: GPT Image 2 and Nano Banana Pro, the reviewer keeps the best; 3: like 2 plus a second pass on what is still wrong.';

grant insert (mode, level, model) on table public.edit_photos to authenticated;

alter table public.studios
  add column editor_mode text not null default 'fondo'
    check (editor_mode in ('fondo', 'completa')),
  add column editor_level smallint not null default 1
    check (editor_level between 1 and 3),
  add column editor_model text not null default 'gpt'
    check (editor_model in ('gpt', 'nbpro'));

grant update (editor_mode, editor_level, editor_model) on table public.studios to authenticated;
