# Uphotox

next-forge v6 monorepo (Turborepo + Next.js 16) with these deviations. Generic next-forge docs and skills assume the originals, so prefer this file when they disagree:

- **Database:** Supabase Postgres via supabase-js, not Prisma. Clients live in `packages/database` (`server.ts`, `client.ts`, `admin.ts`, `proxy.ts`). Schema changes are SQL migrations in `packages/database/supabase/migrations`, created with `npm run db:new -- <name>`, applied with `npm run db:push`, then `npm run db:types` to regenerate `packages/database/types.ts` (never hand-edit it once generated).
- **Auth:** Supabase Auth, not Clerk. `auth()` / `currentUser()` from `@repo/auth/server`; server actions in `packages/auth/actions.ts`; route guard in `packages/auth/proxy.ts`. There are no organizations: data is owned per user (`user_id`).
- **Payments:** none. Don't reintroduce Stripe unless asked.
- **Package manager:** npm (not bun). `.npmrc` sets `legacy-peer-deps=true`.

## Database rules

- Every table in `public` gets, in the same migration: RLS enabled, `revoke all … from anon, authenticated`, explicit grants, and policies scoped `to authenticated` with an ownership check using `(select auth.uid())`. Update policies need both `using` and `with check`.
- Index foreign keys and columns used in policies.
- Helper functions go in the `private` schema with `set search_path = ''`; revoke `execute` from `public, anon, authenticated`. Avoid `security definer` unless required (e.g. the `auth.users` trigger).
- Never use `user_metadata` for authorization. Use the admin client (secret key, bypasses RLS) only in trusted server code.

## Commands

- `npm run dev -- --filter=app` — main app on :3000
- `npm run build -- --filter=app --filter=api` — builds and runs tests first
- `npm run check` / `npm run fix` — Ultracite (Biome)
- Env vars live in `apps/*/.env.local`; each package validates its own in `keys.ts`, and empty strings count as unset.
