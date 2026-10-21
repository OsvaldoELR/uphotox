-- Platform panel, phase 2: what each studio has access to. Uphotox (not the
-- studio) switches modules off, caps the AI spend and pauses a studio. The
-- studio can read these columns but never change them: its update grants on
-- studios are per column and none of these is granted.

-- ---------------------------------------------------------------------------
-- studios: modules, platform AI cap and pause
-- ---------------------------------------------------------------------------

alter table public.studios
  -- Modules that can be switched off. Boards, clients, team and settings are
  -- always on. Keep in sync with MODULES in apps/app/lib/permissions.ts and
  -- with private.has_permission below.
  add column modules text[] not null default array['galleries', 'editor']::text[]
    check (modules <@ array['galleries', 'editor']::text[]),
  -- Monthly AI cap (USD) set by the platform; null = no cap. The studio's own
  -- editor_monthly_limit still applies: the lower one wins.
  add column editor_platform_limit numeric(10, 2)
    check (editor_platform_limit between 0 and 100000),
  -- Paused: members cannot work, client galleries and the inbound webhook
  -- stop. The reason is shown to the studio.
  add column suspended_at timestamptz,
  add column suspended_reason text check (char_length(suspended_reason) <= 300);

comment on column public.studios.modules is 'Modules the platform left on for this studio (galleries, editor). Set by the platform panel only.';
comment on column public.studios.editor_platform_limit is 'Monthly AI cap in USD set by the platform (null = none). The lower of this and editor_monthly_limit applies.';
comment on column public.studios.suspended_at is 'When the platform paused the studio (null = active). Set by the platform panel only.';
comment on column public.studios.suspended_reason is 'Message shown to the members of a paused studio.';

-- ---------------------------------------------------------------------------
-- has_permission: the member's permission, in an active studio, for a module
-- that is on. Every RLS policy already asks this function, so switching a
-- module off or pausing a studio is enforced by the database without touching
-- a single policy. Same signature, so the existing grants stay.
-- ---------------------------------------------------------------------------

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
    join public.studios s on s.id = m.studio_id
    where m.user_id = (select auth.uid())
      and s.suspended_at is null
      and (m.role = 'owner' or permission = any (m.permissions))
      and (
        split_part(permission, '.', 1) not in ('galleries', 'editor')
        or split_part(permission, '.', 1) = any (s.modules)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- platform_audit: every change made from the platform panel
-- ---------------------------------------------------------------------------

create table public.platform_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  studio_id bigint not null references public.studios (id) on delete cascade,
  action text not null check (char_length(action) <= 60),
  -- {"before": {...}, "after": {...}}
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.platform_audit is 'Changes made from the platform panel (who, which studio, before and after). Service role only.';

create index platform_audit_studio_id_created_at_idx on public.platform_audit (studio_id, created_at);
create index platform_audit_actor_id_idx on public.platform_audit (actor_id);

alter table public.platform_audit enable row level security;

-- No policies: written and read by the platform panel with the service role.
revoke all on table public.platform_audit from anon, authenticated;
grant select, insert on table public.platform_audit to service_role;

-- ---------------------------------------------------------------------------
-- platform_set_studio_access: change a studio's access and log it in one
-- transaction. Returns {before, after}, or null when the studio does not
-- exist. Service role only (the platform panel, after requirePlatformAdmin).
-- ---------------------------------------------------------------------------

create or replace function public.platform_set_studio_access(
  target_studio bigint,
  actor uuid,
  new_modules text[],
  new_ai_limit numeric,
  suspend boolean,
  reason text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  previous_access jsonb;
  new_access jsonb;
begin
  select jsonb_build_object(
    'modules', s.modules,
    'editor_platform_limit', s.editor_platform_limit,
    'suspended_at', s.suspended_at,
    'suspended_reason', s.suspended_reason
  )
  into previous_access
  from public.studios s
  where s.id = target_studio
  for update;

  if previous_access is null then
    return null;
  end if;

  update public.studios s
  set modules = coalesce(new_modules, '{}'::text[]),
      editor_platform_limit = new_ai_limit,
      -- Keep the original date while it stays paused.
      suspended_at = case when suspend then coalesce(s.suspended_at, now()) end,
      suspended_reason = case when suspend then nullif(btrim(reason), '') end
  where s.id = target_studio
  returning jsonb_build_object(
    'modules', s.modules,
    'editor_platform_limit', s.editor_platform_limit,
    'suspended_at', s.suspended_at,
    'suspended_reason', s.suspended_reason
  )
  into new_access;

  if new_access is distinct from previous_access then
    insert into public.platform_audit (actor_id, studio_id, action, detail)
    values (
      actor,
      target_studio,
      'access',
      jsonb_build_object('before', previous_access, 'after', new_access)
    );
  end if;

  return jsonb_build_object('before', previous_access, 'after', new_access);
end;
$$;

comment on function public.platform_set_studio_access(bigint, uuid, text[], numeric, boolean, text) is 'Platform panel: sets modules, AI cap and pause of a studio and logs the change in platform_audit. Service role only.';

revoke execute on function public.platform_set_studio_access(bigint, uuid, text[], numeric, boolean, text) from public, anon, authenticated;
grant execute on function public.platform_set_studio_access(bigint, uuid, text[], numeric, boolean, text) to service_role;
