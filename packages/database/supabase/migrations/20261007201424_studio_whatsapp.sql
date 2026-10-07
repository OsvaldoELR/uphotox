-- Client emails are notifications: instead of "reply to this email" they
-- link to the studio's WhatsApp.

-- Digits only, international format without "+" (what wa.me expects):
-- country code + number, 8 to 15 digits (E.164).
alter table public.studios
add column whatsapp text check (whatsapp ~ '^[1-9][0-9]{7,14}$');

comment on column public.studios.whatsapp is 'Studio WhatsApp in international format, digits only (e.g. 34612345678). Linked from client emails.';

-- The update policy already requires settings.manage; this only widens the
-- columns that can be written.
grant update (whatsapp) on table public.studios to authenticated;

-- The default "Agendado" message told clients to reply to the email. Fix
-- stages that still carry that exact default text (customised ones stay).
update public.board_stages
set client_message = '¡Tu sesión está confirmada! Te esperamos en la fecha acordada.'
where client_message = E'¡Tu sesión está confirmada! Te esperamos en la fecha acordada.\n\nSi necesitas cambiar algo, responde a este correo.';
