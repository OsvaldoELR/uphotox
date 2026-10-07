-- Follow-up to studios_team_boards, from `supabase db advisors`:
--   * create_studio no longer needs SECURITY DEFINER: a "bootstrap" policy
--     lets a user with no studio create their own studio and owner row.
--   * Composite foreign keys get covering indexes.
--   * profiles gets a single SELECT policy instead of two permissive ones.

-- ---------------------------------------------------------------------------
-- Studio bootstrap through RLS
-- ---------------------------------------------------------------------------

grant insert (name, owner_id) on table public.studios to authenticated;

drop policy "Members can view their studio" on public.studios;

-- The owner must see the row right after inserting it (before the owner
-- membership exists), so ownership also grants visibility.
create policy "Members and the owner can view their studio"
on public.studios for select
to authenticated
using (
  id = (select private.current_studio_id())
  or owner_id = (select auth.uid())
);

create policy "People without a studio can create one they own"
on public.studios for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and (select private.current_studio_id()) is null
);

drop policy "Team managers can add members" on public.studio_members;

create policy "Team managers add members; owners bootstrap their studio"
on public.studio_members for insert
to authenticated
with check (
  (
    studio_id = (select private.current_studio_id())
    and (select private.has_permission('team.manage'))
    and role <> 'owner'
  )
  or (
    role = 'owner'
    and user_id = (select auth.uid())
    and (select private.current_studio_id()) is null
    and exists (
      select 1 from public.studios s
      where s.id = studio_members.studio_id
        and s.owner_id = (select auth.uid())
    )
  )
);

create or replace function public.create_studio(studio_name text)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_studio_id bigint;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if (select private.current_studio_id()) is not null then
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
-- profiles: one SELECT policy
-- ---------------------------------------------------------------------------

drop policy "Users can view their own profile" on public.profiles;
drop policy "Members can view their teammates' profiles" on public.profiles;

create policy "Users can view their own and their teammates' profiles"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.studio_members m
    where m.user_id = profiles.id
      and m.studio_id = (select private.current_studio_id())
  )
);

-- ---------------------------------------------------------------------------
-- Covering indexes for composite foreign keys
-- ---------------------------------------------------------------------------

drop index public.board_stages_board_id_position_idx;
create index board_stages_board_id_studio_id_position_idx
on public.board_stages (board_id, studio_id, position);

drop index public.card_events_card_id_created_at_idx;
create index card_events_card_id_studio_id_created_at_idx
on public.card_events (card_id, studio_id, created_at);

drop index public.cards_assigned_to_idx;
create index cards_assigned_to_studio_id_idx on public.cards (assigned_to, studio_id);

drop index public.cards_client_id_idx;
create index cards_client_id_studio_id_idx on public.cards (client_id, studio_id);

drop index public.cards_stage_id_position_idx;
create index cards_stage_id_board_id_position_idx
on public.cards (stage_id, board_id, position);
