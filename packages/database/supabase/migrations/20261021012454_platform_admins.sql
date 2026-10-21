-- Platform panel (superadmin): Upgradix staff who can see every studio.
-- It sits beside studio tenancy, not inside it: a platform admin is not a
-- studio member, and no RLS policy mentions them. The /admin pages check the
-- caller against this table and then read with the service role, so the
-- policies that keep studios apart stay exactly as they are.

-- ---------------------------------------------------------------------------
-- platform_admins: who may open /admin
-- ---------------------------------------------------------------------------

create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is 'Users who can open the platform panel (/admin). Granted by hand with SQL; service role only.';

alter table public.platform_admins enable row level security;

-- No policies: invisible to anon and authenticated, read by trusted server
-- code with the service role.
revoke all on table public.platform_admins from anon, authenticated;
grant select, insert, delete on table public.platform_admins to service_role;

-- ---------------------------------------------------------------------------
-- Counts for the platform panel. Grouped in SQL because the Data API caps a
-- select at 1000 rows. Security invoker and callable by the service role
-- only (the panel's admin client).
-- ---------------------------------------------------------------------------

create or replace function public.platform_studio_stats(since timestamptz)
returns table (
  studio_id bigint,
  members bigint,
  boards bigint,
  cards bigint,
  clients bigint,
  galleries_sent bigint,
  galleries_submitted bigint,
  photos bigint,
  storage_bytes bigint,
  edits_since bigint,
  ai_cost_since numeric,
  ai_cost_total numeric,
  last_activity timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    s.id,
    (select count(*) from public.studio_members m where m.studio_id = s.id),
    (select count(*) from public.boards b where b.studio_id = s.id),
    (select count(*) from public.cards c where c.studio_id = s.id),
    (select count(*) from public.clients c where c.studio_id = s.id),
    (select count(*) from public.galleries g where g.studio_id = s.id and g.sent_at is not null),
    (select count(*) from public.galleries g where g.studio_id = s.id and g.status = 'submitted'),
    (select count(*) from public.gallery_photos p where p.studio_id = s.id),
    (
      select coalesce(sum(p.bytes), 0)::bigint
      from public.gallery_photos p
      join public.galleries g on g.id = p.gallery_id
      where p.studio_id = s.id
        and p.uploaded_at is not null
        and g.purged_at is null
    ),
    (
      select count(*) from public.edit_usage u
      where u.studio_id = s.id and u.succeeded and u.created_at >= since
    ),
    (
      select coalesce(sum(u.cost), 0) from public.edit_usage u
      where u.studio_id = s.id and u.created_at >= since
    ),
    (select coalesce(sum(u.cost), 0) from public.edit_usage u where u.studio_id = s.id),
    greatest(
      (select max(e.created_at) from public.card_events e where e.studio_id = s.id),
      (select max(g.updated_at) from public.galleries g where g.studio_id = s.id),
      (select max(u.created_at) from public.edit_usage u where u.studio_id = s.id)
    )
  from public.studios s
  order by s.created_at;
$$;

comment on function public.platform_studio_stats(timestamptz) is 'Platform panel: size, activity and AI cost (since the given date and in total) of every studio. Service role only.';

revoke execute on function public.platform_studio_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.platform_studio_stats(timestamptz) to service_role;

create or replace function public.platform_stage_counts(target_studio bigint)
returns table (stage_id bigint, cards bigint)
language sql
stable
set search_path = ''
as $$
  select c.stage_id, count(*)
  from public.cards c
  where c.studio_id = target_studio
  group by c.stage_id;
$$;

comment on function public.platform_stage_counts(bigint) is 'Platform panel: cards per stage of one studio. Service role only.';

revoke execute on function public.platform_stage_counts(bigint) from public, anon, authenticated;
grant execute on function public.platform_stage_counts(bigint) to service_role;

create or replace function public.platform_studio_usage(target_studio bigint, since timestamptz)
returns table (month timestamptz, runs bigint, photos bigint, cost numeric)
language sql
stable
set search_path = ''
as $$
  select
    date_trunc('month', u.created_at, 'UTC'),
    count(*),
    count(*) filter (where u.succeeded),
    sum(u.cost)
  from public.edit_usage u
  where u.studio_id = target_studio
    and u.created_at >= since
  group by 1
  order by 1 desc;
$$;

comment on function public.platform_studio_usage(bigint, timestamptz) is 'Platform panel: Editor runs, successful photos and cost of one studio per UTC month. Service role only.';

revoke execute on function public.platform_studio_usage(bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.platform_studio_usage(bigint, timestamptz) to service_role;
