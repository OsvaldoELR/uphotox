# Uphotox

SaaS to run a photography studio. next-forge v6 monorepo (Turborepo + Next.js 16) with these deviations. Generic next-forge docs and skills assume the originals, so prefer this file when they disagree:

- **Database:** Supabase Postgres via supabase-js, not Prisma. Clients live in `packages/database` (`server.ts`, `client.ts`, `admin.ts`, `proxy.ts`). Schema changes are SQL migrations in `packages/database/supabase/migrations`, created with `npm run db:new -- <name>`, applied with `npm run db:push`, then `npm run db:types` to regenerate `packages/database/types.ts` (never hand-edit it once generated). After schema changes run `npx supabase db advisors --linked` from `packages/database`.
- **Auth:** Supabase Auth, not Clerk. `auth()` / `currentUser()` from `@repo/auth/server`; server actions in `packages/auth/actions.ts`; route guard in `packages/auth/proxy.ts`.
- **Tenancy:** one account = one studio. Every person belongs to exactly one studio (`studio_members.user_id` is the primary key); all studio data carries `studio_id`. A member has a role (`owner | photographer | editor | assistant`, names stay in English) plus GoHighLevel-style permission keys; the owner implicitly has all of them, and `only_assigned` limits a member to cards assigned to them. New users sign up as owners and create their studio at `/onboarding`; team members are created by a `team.manage` member from `/equipo` (auth user via the admin client, membership row through RLS).
- **Permissions in the app:** `getStudioContext()` / `requireStudio()` / `requirePermission()` in `apps/app/lib/studio.ts`. The permission catalog (`apps/app/lib/permissions.ts`) must stay in sync with the `studio_members.permissions` check constraint. UI checks are for UX only — RLS is the real gate.
- **Email:** Resend through `@repo/email` (React Email templates in `packages/email/templates`). `apps/app/lib/email.ts` skips sending until `RESEND_TOKEN` and `RESEND_FROM` are set; always pass an idempotency key. Client emails are automatic notifications: never ask clients to reply — contact goes through the studio's WhatsApp (`studios.whatsapp`, digits only, helpers in `apps/app/lib/whatsapp.ts`). The Resend key is sending-only, so the API can't list or read sent emails; test with `delivered@resend.dev` (labels like `delivered+x@resend.dev` work), never with fake addresses.
- **Storage:** card cover photos live in the private `card-covers` bucket at `<studio_id>/<card_id>/<file>` (RLS on `storage.objects` checks the first folder against `current_studio_id()`). Images are compressed in the browser before upload (`compress-image.ts`) and shown through batched signed URLs. The app sends `Cross-Origin-Embedder-Policy: require-corp`, so any cross-origin image needs `crossOrigin="anonymous"` (the host must send CORS headers, as Supabase Storage does) or the browser blocks it. Removing a card/board must also remove its storage objects.
- **Inbound webhook (API app):** `POST {NEXT_PUBLIC_API_URL}/webhooks/clients/<token>` in `apps/api` turns a form response (Typeform via Make, Zapier, n8n…) into a client + card. The secret URL token lives in `studio_integrations`; the route uses the service-role client, so every write must be scoped to the integration's studio. Pure parsing lives in `apps/api/lib/inbound-client.ts` (tested). It never emails the client.
- **Clients module and CSV import:** `/clientes` lists clients with their cards; `/clientes/importar` turns a CSV of already-booked clients into cards in a chosen stage. Parsing, column guessing, date reading and row checks are pure code in `apps/app/lib/csv.ts` + `apps/app/lib/client-import.ts` (tested, run in the browser for the live preview); the server action calls the `public.import_cards` RPC (security invoker, one transaction): it reuses a client with the same email (case-insensitive) or phone digits, sets `cards.source = 'import'`, and skips rows whose `external_id` already exists (the file's ID column, or a `csv:` hash), so re-importing is safe. Importing never emails anyone. A session at 00:00 local means "day only" (`lib/session-date.ts`). Boards accept `?tarjeta=<id>` to open a card.
- **Payments:** none. Don't reintroduce Stripe unless asked.
- **Studio workflow and automation roadmap:** `docs/flujo-estudio.md` (real studio process, which Uphotox module covers each step, AI ideas). Read it before planning a new module.
- **Package manager:** npm (not bun). `.npmrc` sets `legacy-peer-deps=true`.
- **UI copy** is Spanish. Design rules live in `.interface-design/system.md`.

## Database rules

- Every table in `public` gets, in the same migration: RLS enabled, `revoke all … from anon, authenticated`, explicit (column-level where sensible) grants, and policies scoped `to authenticated`. Studio data checks `studio_id = (select private.current_studio_id())` plus `(select private.has_permission('…'))`; use `(select private.only_assigned())` where assignment applies. Update policies need both `using` and `with check`.
- Keep related rows in one studio with composite foreign keys (`(board_id, studio_id) → boards (id, studio_id)` etc.) and give each composite FK a covering index.
- Index foreign keys and columns used in policies.
- Helper functions go in the `private` schema with `set search_path = ''`. Revoke `execute` from `public, anon`; trigger functions also from `authenticated`. The RLS helpers (`current_studio_id`, `has_permission`, `only_assigned`) are `security definer` and granted to `authenticated` because policies call them as the querying role. Avoid `security definer` anywhere else unless required.
- Never use `user_metadata` for authorization. Use the admin client (secret key, bypasses RLS) only in trusted server code, after checking the caller's permission.

## Commands

- `npm run dev -- --filter=app` — main app on :3000
- `npm run build -- --filter=app --filter=api` — builds and runs tests first
- `npm run check` / `npm run fix` — Ultracite (Biome)
- Env vars live in `apps/*/.env.local`; each package validates its own in `keys.ts`, and empty strings count as unset.
