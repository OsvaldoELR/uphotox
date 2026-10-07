-- Initial schema for the Upgradix SaaS template.
--
-- Every table in `public` can be reached through the Data API, so each one
-- gets RLS plus explicit grants. Grants are revoked first so the result is the
-- same on older projects (which auto-grant everything to anon/authenticated)
-- and newer ones (where tables are no longer exposed by default).

-- Internal helpers live in a schema the Data API does not expose.
create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on sign up.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  avatar_url text check (char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public profile for each auth user. Rows are created by the on_auth_user_created trigger.';

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
-- Users may only edit these columns; id and timestamps stay server-controlled.
grant update (full_name, avatar_url) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- user_metadata is user-editable: it is only used here to prefill display
-- fields, never for authorization.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- projects: example of user-owned data. Copy this pattern for new tables,
-- or drop it once the real domain model exists.
-- ---------------------------------------------------------------------------

create table public.projects (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is 'Example user-owned table. Replace with your own domain model.';

-- Covers the user_id foreign key, the RLS predicate and "latest first" lists.
create index projects_user_id_created_at_idx on public.projects (user_id, created_at desc);

alter table public.projects enable row level security;

revoke all on table public.projects from anon, authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.projects to service_role;

create policy "Users can view their own projects"
on public.projects for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own projects"
on public.projects for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own projects"
on public.projects for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own projects"
on public.projects for delete
to authenticated
using ((select auth.uid()) = user_id);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function private.set_updated_at();
