# Uphotox

Plantilla base de Upgradix para arrancar proyectos SaaS. Parte de [next-forge](https://github.com/vercel/next-forge) v6 (Turborepo + Next.js 16) con estos cambios:

| Pieza | next-forge | Esta plantilla |
| --- | --- | --- |
| Base de datos | Prisma + Neon | **Supabase Postgres** (supabase-js, migraciones SQL, RLS) |
| Auth | Clerk | **Supabase Auth** (`@supabase/ssr`, formularios propios) |
| Pagos | Stripe | **Sin pagos** (se añade por proyecto si hace falta) |
| Gestor de paquetes | bun | **npm** |

El resto de integraciones de next-forge (Resend, PostHog, Sentry, BetterStack, Arcjet, Liveblocks, Knock, Svix, BaseHub, Languine, Vercel Blob…) siguen ahí y **se desactivan solas** si su variable de entorno está vacía.

## Requisitos

- Node.js 22+ (las librerías de Supabase ya no soportan Node 20)
- npm 10+
- Un proyecto de Supabase (gratis en [supabase.com](https://supabase.com))

## Arrancar un proyecto nuevo

1. **Copia la plantilla** (o úsala como template repo en GitHub) y renombra `name` en `package.json`.
2. **Instala dependencias:**
   ```sh
   npm install
   ```
   `.npmrc` activa `legacy-peer-deps`; sin eso npm 10 no resuelve el árbol de peer deps del monorepo.
3. **Variables de entorno.** Copia los ejemplos:
   ```sh
   cp apps/app/.env.example apps/app/.env.local
   cp apps/api/.env.example apps/api/.env.local
   cp apps/web/.env.example apps/web/.env.local
   ```
   Rellena en `apps/app/.env.local` y `apps/api/.env.local` (Supabase → Project Settings → API Keys):
   ```sh
   NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
   SUPABASE_SECRET_KEY="sb_secret_..."   # opcional: solo para el cron keep-alive y tareas admin
   ```
4. **Aplica el esquema** a tu proyecto de Supabase:
   ```sh
   npx supabase login                                   # o exporta SUPABASE_ACCESS_TOKEN con un token con permisos limitados
   npm run db:link -- --project-ref <project-ref>       # pide la contraseña de la base de datos
   npm run db:push                                      # aplica packages/database/supabase/migrations
   npm run db:types                                     # regenera packages/database/types.ts
   ```
5. **Configura Auth en Supabase** (Authentication → URL Configuration):
   - Site URL: `http://localhost:3000` (en producción, la URL de `app`)
   - Redirect URLs: `http://localhost:3000/**` y `https://<tu-dominio-app>/**`
6. **Arranca la app:**
   ```sh
   npm run dev -- --filter=app      # http://localhost:3000
   ```
   `npm run dev` sin filtro levanta todas las apps; `web` necesita `BASEHUB_TOKEN` y `docs` el CLI de Mintlify.

## Estructura

```
apps/
  app/        App principal autenticada (3000)
  web/        Web de marketing (3001)
  api/        Cron jobs y webhooks (3002)
  email/      Preview de emails con React Email (3003)
  docs/       Documentación con Mintlify (3004)
  storybook/  Catálogo de componentes (6006)
packages/
  auth/       Sesión, server actions, proxy y formularios de Supabase Auth
  database/   Clientes de Supabase, tipos generados y migraciones (supabase/)
  design-system/, analytics/, email/, observability/, security/, …
```

### `@repo/database`

| Import | Úsalo en |
| --- | --- |
| `@repo/database/server` → `createClient()` | Server Components, Server Actions, Route Handlers. Corre como el usuario: aplica RLS. |
| `@repo/database/client` → `createClient()` | Client Components (realtime, subir archivos a Storage). |
| `@repo/database/admin` → `createAdminClient()` | Solo servidor y tareas de confianza. Usa la secret key y **se salta RLS**. |
| `@repo/database/proxy` → `updateSession()` | Lo usa el proxy de auth; normalmente no lo llamas tú. |
| `@repo/database` | Tipos: `Database`, `Tables<"projects">`, `TablesInsert<…>`, `User`. |

### `@repo/auth`

- `auth()` → `{ userId, claims }`. Verifica el JWT; es barato. Úsalo para proteger páginas y acciones.
- `currentUser()` → usuario completo de Supabase Auth (hace una llamada de red).
- `authMiddleware()` en `apps/app/proxy.ts`: refresca la sesión en cada request, redirige a `/sign-in` las páginas privadas y devuelve 401 en `/api/*` sin sesión. Los layouts y route handlers comprueban `auth()` igualmente: el proxy es solo la primera barrera.
- Rutas incluidas: `/sign-in`, `/sign-up`, `/forgot-password`, `/update-password`, `/auth/callback` (OAuth y enlaces de email por defecto) y `/auth/confirm` (enlaces con `token_hash`).

## Base de datos

Esquema inicial (`packages/database/supabase/migrations/*_init.sql`):

- `profiles`: una fila por usuario, creada por trigger al registrarse. Cada usuario solo ve y edita la suya (y solo `full_name`/`avatar_url`).
- `projects`: tabla **de ejemplo** de datos por usuario. Cópiala como patrón o bórrala cuando tengas tu modelo real.

### Añadir una tabla

```sh
npm run db:new -- add_invoices        # crea packages/database/supabase/migrations/<timestamp>_add_invoices.sql
# escribe el SQL
npm run db:push
npm run db:types
```

Cada tabla nueva en `public` necesita, en la misma migración:

1. `alter table … enable row level security;`
2. Políticas con `to authenticated` **y** comprobación de propiedad (`(select auth.uid()) = user_id`). Las de `update` llevan `using` y `with check`.
3. `revoke all … from anon, authenticated;` y luego `grant` explícito de lo necesario. Desde el 30-oct-2026, Supabase ya no expone automáticamente las tablas nuevas a la Data API.
4. Índice en las columnas de las políticas y de las foreign keys.

No uses `user_metadata` para decisiones de autorización: el usuario puede editarlo. Usa `app_metadata` o tablas propias.

## Emails de Auth

Con las plantillas por defecto de Supabase, los enlaces de confirmación y de recuperación de contraseña pasan por `/auth/callback` y solo funcionan en el mismo navegador donde se pidieron (PKCE). Para que funcionen desde cualquier dispositivo, cambia las plantillas en Authentication → Email Templates para que apunten a `/auth/confirm`. Por ejemplo, en "Confirm signup":

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmar email</a>
```

Y en "Reset password": `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.

El SMTP integrado de Supabase tiene límites muy bajos. En producción, configura un SMTP propio (por ejemplo, Resend).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Todas las apps en modo desarrollo (`-- --filter=app` para una sola) |
| `npm run build` | Build de todo (ejecuta los tests antes) |
| `npm run test` | Tests con Vitest |
| `npm run typecheck` | Typecheck de todos los paquetes |
| `npm run check` / `npm run fix` | Lint y formato con Ultracite (Biome) |
| `npm run db:link` / `db:new` / `db:push` / `db:types` | Supabase CLI (se ejecuta en `packages/database`) |
| `npm run bump-ui` | Actualiza los componentes de shadcn/ui |

## Despliegue (Vercel)

Crea un proyecto de Vercel por cada app (`apps/app`, `apps/web`, `apps/api`) con su Root Directory. Añade las variables de Supabase a `app` y `api`, y actualiza `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_WEB_URL` a los dominios reales. En Supabase, añade el dominio de `app` a Site URL y Redirect URLs.

`apps/api` trae un cron diario (`/cron/keep-alive`) que evita que los proyectos gratuitos de Supabase se pausen. Necesita `SUPABASE_SECRET_KEY`.

## Pendientes conocidos (vienen de next-forge)

- `npm run typecheck` falla en `@repo/ai`, `@repo/design-system` (`chart.tsx`, `resizable.tsx`), `@repo/notifications`, `storybook` y `email`. Son incompatibilidades de next-forge con las versiones actuales de sus dependencias (AI SDK, recharts, react-resizable-panels, Knock). No afectan al build de `app` ni de `api`.
- `web` no compila sin `BASEHUB_TOKEN`: el CMS es obligatorio en el build de la web de marketing.
- `npm run analyze` usa `ANALYZE=true …`, que no funciona en `cmd.exe` de Windows.
