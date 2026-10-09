# Publicar Uphotox en Vercel

Guía paso a paso para poner la app en internet. Se hace una vez; después,
**cada `git push` a `main` publica solo** (salvo los commits que lleven
`[skip ci]` en el mensaje).

## Estado actual (8 oct 2026)

| Paso | Estado |
| --- | --- |
| 1. Proyecto de la app | ✅ `uphotox-app` → https://uphotox-app.vercel.app |
| 2. Direcciones en Supabase | ✅ Hecho y comprobado (9 oct) |
| 3. Correo de registro con Resend | ✅ Hecho y comprobado (9 oct) |
| 4. Proyecto de la API | ✅ `uphotox-api` → https://uphotox-api.vercel.app |
| 5. Dominio propio | — No por ahora |

Ambos proyectos están en el equipo «Upgradix's projects» de Vercel y
conectados a `OsvaldoELR/uphotox` (rama `main`). Las variables ya están
cargadas en cada proyecto (producción y preview).

> Las pruebas se ejecutan antes de compilar. Vercel compila con
> `NODE_ENV=production`, así que `apps/app/vitest.config.mts` fuerza
> `NODE_ENV=test`; sin eso fallan las pruebas de componentes y el deploy se
> detiene.

El repositorio tiene varias apps. Solo hacen falta dos proyectos en Vercel:

| Proyecto en Vercel | Carpeta | Para qué | ¿Obligatorio? |
| --- | --- | --- | --- |
| `uphotox-app` | `apps/app` | La aplicación (login, tableros, clientes…) | Sí |
| `uphotox-api` | `apps/api` | Recibe las reservas de Make/Typeform y mantiene despierta la base de datos | Recomendado |

`apps/web` (la web pública de la plantilla) y `apps/email` no se publican por
ahora.

> **Plan de Vercel**: el plan gratuito (Hobby) sirve para probar, pero Vercel
> solo lo permite para uso personal y no comercial. Para vender Uphotox a
> estudios hace falta el plan Pro.

---

## 1. Proyecto de la app (`uphotox-app`)

1. Entra en https://vercel.com/new e inicia sesión con tu cuenta de GitHub.
2. En «Import Git Repository» elige **OsvaldoELR/uphotox** (si no aparece,
   pulsa «Adjust GitHub App Permissions» y dale acceso a ese repositorio).
3. Nombre del proyecto: `uphotox-app`.
4. **Root Directory**: pulsa «Edit» y elige `apps/app`. El framework se
   detecta solo (Next.js). No cambies los comandos de build ni de instalación.
5. Abre **Environment Variables** y añade estas (puedes pegar varias líneas
   de golpe con el formato `NOMBRE=valor`):

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | copia de `apps/app/.env.local` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | copia de `apps/app/.env.local` |
   | `SUPABASE_SECRET_KEY` | copia de `apps/app/.env.local` (márcala como *Sensitive*) |
   | `RESEND_TOKEN` | copia de `apps/app/.env.local` (*Sensitive*) |
   | `RESEND_FROM` | copia de `apps/app/.env.local` |
   | `NEXT_PUBLIC_APP_URL` | la dirección pública de la app, p. ej. `https://uphotox-app.vercel.app` |
   | `NEXT_PUBLIC_WEB_URL` | la misma que `NEXT_PUBLIC_APP_URL` (es obligatoria pero no se usa) |
   | `NEXT_PUBLIC_API_URL` | la dirección del proyecto de la API (paso 4); déjala para después si aún no existe |

   **No copies** `VERCEL_PROJECT_PRODUCTION_URL` (Vercel la pone sola) ni las
   variables vacías del `.env.local`.

6. Pulsa **Deploy**. Tarda unos minutos (antes de compilar pasa las pruebas).
   Al terminar te da la dirección, del tipo `https://uphotox-app.vercel.app`.
7. Si la dirección final no es la que pusiste en `NEXT_PUBLIC_APP_URL`,
   corrígela en *Settings → Environment Variables* y haz **Redeploy**: las
   variables `NEXT_PUBLIC_*` se graban al compilar, así que cualquier cambio
   necesita volver a publicar.

## 2. Supabase: direcciones de inicio de sesión

Sin esto, los enlaces de confirmación de registro y de «¿Olvidaste tu
contraseña?» llevarían a `localhost`.

En https://supabase.com/dashboard/project/cdkosqookglkyrjazmho/auth/url-configuration
(Authentication → URL Configuration):

- **Site URL**: la dirección de la app, p. ej. `https://uphotox-app.vercel.app`.
- **Redirect URLs**: añade `https://uphotox-app.vercel.app/**` y deja también
  `http://localhost:3000/**` para seguir trabajando en local.

## 3. Supabase: enviar los correos de acceso con Resend

Desde el 26-09-2026 el correo propio de Supabase solo llega a los miembros de
tu organización de Supabase. Para que **cualquier dueña de estudio que se
registre** reciba el correo de confirmación, Supabase tiene que enviar con
Resend.

En Authentication → Emails → **SMTP Settings** («Enable custom SMTP»):

| Campo | Valor |
| --- | --- |
| Sender email | la misma dirección que `RESEND_FROM` (dominio `uphotox.com`) |
| Sender name | `Uphotox` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | tu clave de Resend (la de `RESEND_TOKEN`) |

Los usuarios que crea el equipo desde `/equipo` no dependen de esto: se crean
ya confirmados.

## 4. Proyecto de la API (`uphotox-api`) — recomendado

Hace dos cosas: recibe las reservas que manda Make (Ajustes → Entrada de
clientes) y **todas las noches hace una consulta a la base de datos para que
Supabase gratuito no se pause** tras una semana sin uso.

1. De nuevo en https://vercel.com/new, el mismo repositorio, nombre
   `uphotox-api`, **Root Directory** `apps/api`.
2. Variables:

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | igual que en la app |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | igual que en la app |
   | `SUPABASE_SECRET_KEY` | igual que en la app (*Sensitive*) |
   | `NEXT_PUBLIC_APP_URL` | la dirección de la app |
   | `NEXT_PUBLIC_WEB_URL` | la dirección de la app |

3. **Deploy**. Comprueba que `https://<tu-api>.vercel.app/health` responde.
4. Vuelve al proyecto **uphotox-app**, pon `NEXT_PUBLIC_API_URL` con la
   dirección de la API y haz **Redeploy**. En Ajustes → Entrada de clientes
   aparecerá la URL definitiva para pegarla en Make.

## 5. Dominio propio (opcional)

Si quieres `app.uphotox.com` y `api.uphotox.com` en lugar de `*.vercel.app`:

1. En cada proyecto: *Settings → Domains → Add* y escribe el subdominio.
2. Vercel te dice qué registro DNS crear (normalmente un `CNAME` a
   `cname.vercel-dns.com`) en el proveedor donde compraste `uphotox.com`.
3. Cuando el dominio esté activo, actualiza `NEXT_PUBLIC_APP_URL`,
   `NEXT_PUBLIC_WEB_URL` y `NEXT_PUBLIC_API_URL`, haz Redeploy, y cambia la
   Site URL y las Redirect URLs de Supabase (paso 2) al nuevo dominio.

## 6. Comprobar que todo funciona

- [ ] La app abre en su dirección y se puede iniciar sesión.
- [ ] Registro de una cuenta nueva: llega el correo de confirmación y el
      enlace lleva a la app (no a `localhost`).
- [ ] «¿Olvidaste tu contraseña?» envía el correo y el enlace funciona.
- [ ] Mover una tarjeta envía el aviso al cliente (probar con
      `delivered+prueba@resend.dev`).
- [ ] Si publicaste la API: `/health` responde y en Ajustes aparece la URL
      del webhook con `https://`.

## Si algo falla

- **El build falla por variables**: suele faltar `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL` o
  `NEXT_PUBLIC_WEB_URL` (son las obligatorias) o tienen un formato que no es
  una URL.
- **Los enlaces de los correos llevan a localhost**: falta el paso 2 o
  `NEXT_PUBLIC_APP_URL` todavía apunta a localhost (cámbiala y Redeploy).
- **No llegan los correos de registro**: falta el paso 3.
- **Crear usuarios en Equipo da error**: falta `SUPABASE_SECRET_KEY`.
