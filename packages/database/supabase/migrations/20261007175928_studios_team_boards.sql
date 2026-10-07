-- Studios, team roles/permissions and the boards (kanban) module.
--
-- Tenancy: one account = one studio. Every person belongs to exactly one
-- studio (studio_members.user_id is the primary key). All studio data carries
-- studio_id, and composite foreign keys keep related rows inside the same
-- studio, so RLS only has to check studio_id once per table.
--
-- Authorization: a member has a role plus a GoHighLevel-style list of
-- permission keys. The owner implicitly has every permission. `only_assigned`
-- restricts a member to the cards assigned to them.

-- The template's example table is replaced by the real domain model.
drop table if exists public.projects;

-- ---------------------------------------------------------------------------
-- profiles: expose the email to teammates (team list, notifications).
-- ---------------------------------------------------------------------------

alter table public.profiles
add column email text check (char_length(email) <= 320);

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    new.email
  );
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

revoke execute on function private.handle_user_email_change() from public, anon, authenticated;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- studios and studio_members
-- ---------------------------------------------------------------------------

create type public.studio_role as enum ('owner', 'photographer', 'editor', 'assistant');

create table public.studios (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.studios is 'A photography studio (tenant). Created with public.create_studio().';

create table public.studio_members (
  -- One studio per person for now. To allow several, switch the primary key
  -- to (studio_id, user_id) and teach current_studio_id() which one is active.
  user_id uuid primary key references public.profiles (id) on delete cascade,
  studio_id bigint not null references public.studios (id) on delete cascade,
  role public.studio_role not null,
  permissions text[] not null default '{}' check (
    permissions <@ array[
      'boards.view', 'boards.manage',
      'cards.create', 'cards.edit', 'cards.move', 'cards.delete',
      'clients.view', 'clients.manage',
      'editor.access',
      'team.manage',
      'settings.manage'
    ]::text[]
  ),
  only_assigned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target for composite foreign keys (e.g. cards.assigned_to).
  unique (user_id, studio_id)
);

comment on column public.studio_members.permissions is 'Permission keys granted to the member. Owners implicitly have all of them.';
comment on column public.studio_members.only_assigned is 'When true the member only sees cards assigned to them (and their clients).';

create index studio_members_studio_id_idx on public.studio_members (studio_id);
create unique index studio_members_one_owner_idx on public.studio_members (studio_id) where role = 'owner';

-- ---------------------------------------------------------------------------
-- Authorization helpers. SECURITY DEFINER so policies on studio_members can
-- use them without recursing into their own RLS. Each one only ever reads
-- the calling user's own membership row (auth.uid()), and the schema is not
-- exposed through the Data API. authenticated needs EXECUTE because policies
-- are evaluated with the querying role's privileges.
-- ---------------------------------------------------------------------------

create or replace function private.current_studio_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select m.studio_id
  from public.studio_members m
  where m.user_id = (select auth.uid());
$$;

create or replace function private.has_permission(permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.studio_members m
    where m.user_id = (select auth.uid())
      and (m.role = 'owner' or permission = any (m.permissions))
  );
$$;

create or replace function private.only_assigned()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select m.only_assigned and m.role <> 'owner'
      from public.studio_members m
      where m.user_id = (select auth.uid())
    ),
    true
  );
$$;

revoke execute on function private.current_studio_id() from public, anon;
revoke execute on function private.has_permission(text) from public, anon;
revoke execute on function private.only_assigned() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_studio_id() to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.only_assigned() to authenticated;

-- studios ------------------------------------------------------------------

alter table public.studios enable row level security;

revoke all on table public.studios from anon, authenticated;
grant select on table public.studios to authenticated;
grant update (name) on table public.studios to authenticated;
grant select, insert, update, delete on table public.studios to service_role;

create policy "Members can view their studio"
on public.studios for select
to authenticated
using (id = (select private.current_studio_id()));

create policy "Settings managers can rename their studio"
on public.studios for update
to authenticated
using (
  id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
)
with check (
  id = (select private.current_studio_id())
  and (select private.has_permission('settings.manage'))
);

create trigger studios_set_updated_at
before update on public.studios
for each row execute function private.set_updated_at();

-- studio_members -----------------------------------------------------------

alter table public.studio_members enable row level security;

revoke all on table public.studio_members from anon, authenticated;
grant select, delete on table public.studio_members to authenticated;
grant insert (user_id, studio_id, role, permissions, only_assigned) on table public.studio_members to authenticated;
grant update (role, permissions, only_assigned) on table public.studio_members to authenticated;
grant select, insert, update, delete on table public.studio_members to service_role;

create policy "Members can view their teammates"
on public.studio_members for select
to authenticated
using (studio_id = (select private.current_studio_id()));

-- Team managers add people (whose auth user the server just created); the
-- owner row is only ever written by create_studio().
create policy "Team managers can add members"
on public.studio_members for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('team.manage'))
  and role <> 'owner'
);

create policy "Team managers can update members"
on public.studio_members for update
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('team.manage'))
  and role <> 'owner'
)
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('team.manage'))
  and role <> 'owner'
);

create policy "Team managers can remove members"
on public.studio_members for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('team.manage'))
  and role <> 'owner'
  and user_id <> (select auth.uid())
);

create trigger studio_members_set_updated_at
before update on public.studio_members
for each row execute function private.set_updated_at();

-- Teammates can see each other's profile (name, avatar, email).
create policy "Members can view their teammates' profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.studio_members m
    where m.user_id = profiles.id
      and m.studio_id = (select private.current_studio_id())
  )
);

-- create_studio: the first owner membership cannot pass the insert policy
-- above (nobody is a team manager yet), so onboarding goes through this
-- function. It only ever acts for the calling user.
create or replace function public.create_studio(studio_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_studio_id bigint;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.studio_members where user_id = caller) then
    raise exception 'This account already belongs to a studio' using errcode = '23505';
  end if;

  insert into public.studios (name, owner_id)
  values (btrim(studio_name), caller)
  returning id into new_studio_id;

  insert into public.studio_members (user_id, studio_id, role)
  values (caller, new_studio_id, 'owner');

  return new_studio_id;
end;
$$;

revoke execute on function public.create_studio(text) from public, anon;
grant execute on function public.create_studio(text) to authenticated;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id bigint generated always as identity primary key,
  studio_id bigint not null references public.studios (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text check (
    email is null
    or (char_length(email) <= 320 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  phone text check (char_length(phone) <= 40),
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, studio_id)
);

create index clients_studio_id_full_name_idx on public.clients (studio_id, full_name);
create index clients_created_by_idx on public.clients (created_by);

-- ---------------------------------------------------------------------------
-- boards, board_stages, cards, card_events
-- ---------------------------------------------------------------------------

create table public.boards (
  id bigint generated always as identity primary key,
  studio_id bigint not null references public.studios (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, studio_id)
);

create index boards_studio_id_created_at_idx on public.boards (studio_id, created_at);
create index boards_created_by_idx on public.boards (created_by);

create table public.board_stages (
  id bigint generated always as identity primary key,
  board_id bigint not null,
  studio_id bigint not null,
  name text not null check (char_length(name) between 1 and 60),
  position double precision not null,
  notify_client boolean not null default true,
  client_message text check (char_length(client_message) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (board_id, studio_id) references public.boards (id, studio_id) on delete cascade,
  unique (id, board_id)
);

comment on column public.board_stages.notify_client is 'Email the client when a card enters this stage.';
comment on column public.board_stages.client_message is 'Body of the email sent to the client when a card enters this stage.';

create index board_stages_board_id_position_idx on public.board_stages (board_id, position);
create index board_stages_studio_id_idx on public.board_stages (studio_id);

create table public.cards (
  id bigint generated always as identity primary key,
  studio_id bigint not null references public.studios (id) on delete cascade,
  board_id bigint not null,
  stage_id bigint not null,
  client_id bigint,
  title text not null check (char_length(title) between 1 and 120),
  session_at timestamptz,
  gallery_url text check (
    gallery_url is null
    or (char_length(gallery_url) <= 2048 and gallery_url ~* '^https?://')
  ),
  notes text check (char_length(notes) <= 5000),
  assigned_to uuid,
  position double precision not null,
  stage_entered_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (board_id, studio_id) references public.boards (id, studio_id) on delete cascade,
  -- The stage must belong to the card's board. NO ACTION (not RESTRICT) so
  -- deleting a whole board can cascade to its stages and cards together.
  foreign key (stage_id, board_id) references public.board_stages (id, board_id),
  foreign key (client_id, studio_id) references public.clients (id, studio_id) on delete set null (client_id),
  foreign key (assigned_to, studio_id) references public.studio_members (user_id, studio_id) on delete set null (assigned_to),
  unique (id, studio_id)
);

comment on column public.cards.gallery_url is 'Delivery link (e.g. a Google Drive folder) included in client emails.';

create index cards_stage_id_position_idx on public.cards (stage_id, position);
create index cards_board_id_studio_id_idx on public.cards (board_id, studio_id);
create index cards_studio_id_idx on public.cards (studio_id);
create index cards_client_id_idx on public.cards (client_id);
create index cards_assigned_to_idx on public.cards (assigned_to);
create index cards_created_by_idx on public.cards (created_by);

create table public.card_events (
  id bigint generated always as identity primary key,
  studio_id bigint not null,
  card_id bigint not null,
  actor_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kind text not null check (kind in ('created', 'moved', 'email_sent', 'email_failed')),
  from_stage_id bigint references public.board_stages (id) on delete set null,
  to_stage_id bigint references public.board_stages (id) on delete set null,
  detail text check (char_length(detail) <= 500),
  created_at timestamptz not null default now(),
  foreign key (card_id, studio_id) references public.cards (id, studio_id) on delete cascade
);

comment on table public.card_events is 'Append-only history of a card: creation, stage moves and notification results.';

create index card_events_card_id_created_at_idx on public.card_events (card_id, created_at);
create index card_events_studio_id_idx on public.card_events (studio_id);
create index card_events_actor_id_idx on public.card_events (actor_id);
create index card_events_from_stage_id_idx on public.card_events (from_stage_id);
create index card_events_to_stage_id_idx on public.card_events (to_stage_id);

-- clients RLS ----------------------------------------------------------------

alter table public.clients enable row level security;

revoke all on table public.clients from anon, authenticated;
grant select, delete on table public.clients to authenticated;
grant insert (studio_id, full_name, email, phone, notes) on table public.clients to authenticated;
grant update (full_name, email, phone, notes) on table public.clients to authenticated;
grant select, insert, update, delete on table public.clients to service_role;

create policy "Members can view the studio's clients"
on public.clients for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (
    (select private.has_permission('boards.view'))
    or (select private.has_permission('clients.view'))
  )
  and (
    not (select private.only_assigned())
    or exists (
      select 1 from public.cards c
      where c.client_id = clients.id
        and c.assigned_to = (select auth.uid())
    )
  )
);

create policy "Members can add clients"
on public.clients for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (
    (select private.has_permission('cards.create'))
    or (select private.has_permission('clients.manage'))
  )
);

create policy "Members can edit clients"
on public.clients for update
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (
    (select private.has_permission('cards.edit'))
    or (select private.has_permission('clients.manage'))
  )
)
with check (
  studio_id = (select private.current_studio_id())
  and (
    (select private.has_permission('cards.edit'))
    or (select private.has_permission('clients.manage'))
  )
);

create policy "Client managers can delete clients"
on public.clients for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('clients.manage'))
);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function private.set_updated_at();

-- boards RLS -----------------------------------------------------------------

alter table public.boards enable row level security;

revoke all on table public.boards from anon, authenticated;
grant select, delete on table public.boards to authenticated;
grant insert (studio_id, name, description) on table public.boards to authenticated;
grant update (name, description) on table public.boards to authenticated;
grant select, insert, update, delete on table public.boards to service_role;

create policy "Members can view boards"
on public.boards for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.view'))
);

create policy "Board managers can create boards"
on public.boards for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.manage'))
);

create policy "Board managers can update boards"
on public.boards for update
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.manage'))
)
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.manage'))
);

create policy "Board managers can delete boards"
on public.boards for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.manage'))
);

create trigger boards_set_updated_at
before update on public.boards
for each row execute function private.set_updated_at();

-- board_stages RLS -------------------------------------------------------------

alter table public.board_stages enable row level security;

revoke all on table public.board_stages from anon, authenticated;
grant select, delete on table public.board_stages to authenticated;
grant insert (board_id, studio_id, name, position, notify_client, client_message) on table public.board_stages to authenticated;
grant update (name, position, notify_client, client_message) on table public.board_stages to authenticated;
grant select, insert, update, delete on table public.board_stages to service_role;

create policy "Members can view stages"
on public.board_stages for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.view'))
);

create policy "Board managers can create stages"
on public.board_stages for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.manage'))
);

create policy "Board managers can update stages"
on public.board_stages for update
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.manage'))
)
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.manage'))
);

create policy "Board managers can delete stages"
on public.board_stages for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.manage'))
);

create trigger board_stages_set_updated_at
before update on public.board_stages
for each row execute function private.set_updated_at();

-- cards RLS --------------------------------------------------------------------

alter table public.cards enable row level security;

revoke all on table public.cards from anon, authenticated;
grant select, delete on table public.cards to authenticated;
grant insert (studio_id, board_id, stage_id, client_id, title, session_at, gallery_url, notes, assigned_to, position) on table public.cards to authenticated;
grant update (stage_id, client_id, title, session_at, gallery_url, notes, assigned_to, position) on table public.cards to authenticated;
grant select, insert, update, delete on table public.cards to service_role;

create policy "Members can view cards"
on public.cards for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('boards.view'))
  and (
    not (select private.only_assigned())
    or assigned_to = (select auth.uid())
  )
);

create policy "Members can create cards"
on public.cards for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('cards.create'))
  and (
    not (select private.only_assigned())
    or assigned_to = (select auth.uid())
  )
);

-- Column-level rules (move vs edit) are enforced by cards_check_update below.
create policy "Members can update cards"
on public.cards for update
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (
    (select private.has_permission('cards.edit'))
    or (select private.has_permission('cards.move'))
  )
  and (
    not (select private.only_assigned())
    or assigned_to = (select auth.uid())
  )
)
with check (
  studio_id = (select private.current_studio_id())
  and (
    (select private.has_permission('cards.edit'))
    or (select private.has_permission('cards.move'))
  )
);

create policy "Members can delete cards"
on public.cards for delete
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and (select private.has_permission('cards.delete'))
  and (
    not (select private.only_assigned())
    or assigned_to = (select auth.uid())
  )
);

-- Moving (stage/position) needs cards.move; changing details needs
-- cards.edit. Requests without a user (service role) are trusted.
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

    if (new.client_id, new.title, new.session_at, new.gallery_url, new.notes, new.assigned_to)
       is distinct from
       (old.client_id, old.title, old.session_at, old.gallery_url, old.notes, old.assigned_to)
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

create trigger cards_check_update
before update on public.cards
for each row execute function private.cards_check_update();

create trigger cards_set_updated_at
before update on public.cards
for each row execute function private.set_updated_at();

-- History is written by triggers so every path (app, SQL) is recorded.
-- SECURITY DEFINER: it only writes the event for the row that already passed
-- the cards policies, and must not fail when a restricted member creates a
-- card they cannot see afterwards. actor_id still comes from auth.uid().
create or replace function private.cards_log_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.card_events (studio_id, card_id, kind, to_stage_id)
    values (new.studio_id, new.id, 'created', new.stage_id);
  elsif new.stage_id is distinct from old.stage_id then
    insert into public.card_events (studio_id, card_id, kind, from_stage_id, to_stage_id)
    values (new.studio_id, new.id, 'moved', old.stage_id, new.stage_id);
  end if;

  return null;
end;
$$;

revoke execute on function private.cards_log_event() from public, anon, authenticated;

create trigger cards_log_event
after insert or update of stage_id on public.cards
for each row execute function private.cards_log_event();

-- card_events RLS ----------------------------------------------------------------

alter table public.card_events enable row level security;

revoke all on table public.card_events from anon, authenticated;
grant select on table public.card_events to authenticated;
grant insert (studio_id, card_id, kind, from_stage_id, to_stage_id, detail) on table public.card_events to authenticated;
grant select, insert, update, delete on table public.card_events to service_role;

-- Visible when the card itself is visible (cards RLS applies in the subquery).
create policy "Members can view card history"
on public.card_events for select
to authenticated
using (
  studio_id = (select private.current_studio_id())
  and exists (select 1 from public.cards c where c.id = card_events.card_id)
);

create policy "Members can append card history"
on public.card_events for insert
to authenticated
with check (
  studio_id = (select private.current_studio_id())
  and actor_id = (select auth.uid())
  and exists (select 1 from public.cards c where c.id = card_events.card_id)
);
