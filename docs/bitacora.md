# Bitácora de Uphotox

Registro de lo que se ha hecho, en orden de más reciente a más antiguo. Se
actualiza al terminar cada tarea. Para retomar en otra sesión, lee primero
**Estado actual** y **Pendientes**.

Documentos relacionados:
- `docs/deploy-vercel.md`: cómo publicar la app y la API en Vercel.
- `CLAUDE.md`: reglas técnicas del proyecto (base de datos, permisos, correo…).
- `docs/flujo-estudio.md`: cómo trabaja el estudio, análisis del formulario de
  reserva y hoja de ruta de automatización con IA.
- `.interface-design/system.md`: estilo visual y patrones de pantalla.

---

## Estado actual (8 oct 2026)

| Módulo | Estado | Dónde |
| --- | --- | --- |
| Login, registro y onboarding | Hecho | `/sign-in`, `/sign-up`, `/onboarding` |
| Panel | Hecho: saludo, avisos de configuración, embudo de cada tablero | `/` |
| Tableros (tipo Trello) | Hecho: etapas, arrastrar o «Mover a…», foto, avisos por correo, historial | `/tableros` |
| Clientes | Hecho: lista, ficha, importación CSV | `/clientes`, `/clientes/importar` |
| Equipo | Hecho: usuarios con rol y permisos tipo GoHighLevel | `/equipo` |
| Ajustes | Hecho: nombre, WhatsApp, entrada de clientes (webhook) | `/ajustes` |
| Entrada de clientes (Make/Typeform) | Hecho y publicado | `apps/api` |
| Editor de imágenes | Pendiente («Pronto» en el menú) | — |

Publicado en Vercel (equipo «Upgradix's projects», plan Hobby):
- **App**: https://uphotox-app.vercel.app (proyecto `uphotox-app`, carpeta `apps/app`).
- **API**: https://uphotox-api.vercel.app (proyecto `uphotox-api`, carpeta `apps/api`).
- Cada `git push` a `main` publica solo; los proyectos sin cambios se saltan y
  un commit con `[skip ci]` en el mensaje no publica nada.

Configuración:
- **Supabase**: proyecto enlazado (`cdkosqookglkyrjazmho`), migraciones al día.
- **Resend**: configurado en `apps/app/.env.local`, así que **los correos salen
  de verdad** al mover tarjetas. Para probar, usar solo `delivered+algo@resend.dev`.
- **GitHub**: https://github.com/OsvaldoELR/uphotox (rama `main`).

## Pendientes

Del usuario:
- [ ] Importar el CSV real de clientes agendados (Clientes → Importar CSV).
- [ ] **Supabase → URL Configuration**: Site URL `https://uphotox-app.vercel.app`
      y Redirect URLs `https://uphotox-app.vercel.app/**` (más
      `http://localhost:3000/**`). Sin esto, los enlaces de los correos de
      registro y de contraseña llevan a localhost. (Paso 2 de
      `docs/deploy-vercel.md`.)
- [ ] Usar Resend como SMTP de Supabase Auth, para que los nuevos dueños
      reciban el correo de confirmación (paso 3 de la guía; no está
      confirmado que se haya hecho).
- [ ] En Make, pegar la URL definitiva del webhook (Ajustes → Entrada de
      clientes en la app publicada; empieza por `https://uphotox-api.vercel.app`).
- [ ] Autenticar la conexión MCP de Supabase (ver Historial, «Conexión MCP de
      Supabase»).
- [ ] Opcional: volver a autorizar la conexión MCP de Vercel eligiendo el
      equipo «Upgradix's projects» (ahora solo ve la cuenta personal; la CLI
      sí tiene acceso al equipo, así que no bloquea nada).
- [ ] Antes de vender a otros estudios: plan Pro de Vercel (el Hobby es solo
      para uso no comercial) y, si se quiere, dominio `app.uphotox.com`.
- [ ] Opcional: activar en Supabase la protección de contraseñas filtradas
      (único aviso del revisor de seguridad).
- [ ] Opcional: etapa «Solicitud recibida» antes de «Agendado» y apuntar ahí
      el webhook (el correo de «Agendado» dice que la sesión está confirmada).
- [ ] Responder las preguntas abiertas de `docs/flujo-estudio.md` (paquetes,
      dónde se guardan los RAW, sesiones al mes, editores externos).

Ideas para los siguientes módulos (detalle en `docs/flujo-estudio.md`):
Google Calendar, recordatorios por WhatsApp, galería de selección propia (en
lugar de Pixieset) con plugin de Lightroom, IA para preseleccionar y editar,
paquetes y pagos.

## Cómo retomar

- Arrancar la app: `npm run dev -- --filter=app` (puerto 3000).
- Cambios en la base de datos: `npm run db:new -- <nombre>`, luego
  `npm run db:push` y `npm run db:types`.
- Comprobar antes de subir: `npm run build -- --filter=app --filter=api`
  (también ejecuta las pruebas).

---

## Historial

### 8 oct 2026 · Conexión MCP de Supabase
**Qué se hizo**: añadido el servidor MCP de Supabase para este proyecto
(`.mcp.json`, proyecto `uphotox` = `cdkosqookglkyrjazmho`, con documentación,
cuenta, base de datos, depuración, desarrollo, funciones y ramas). Aprobado en
`.claude/settings.local.json` (local, no se sube). Las «skills» de Supabase ya
estaban instaladas en el proyecto (`.claude/skills/supabase` y
`supabase-postgres-best-practices`), así que el paso 3 de Supabase no hacía
falta.

**Decisión**: el MCP sirve para consultar datos, registros, avisos y
documentación; los cambios de esquema siguen yendo por migraciones (anotado en
`CLAUDE.md`).

**Pendiente**: autenticar la conexión (`/mcp` → `supabase` → Authenticate) y
comprobarla.

### 8 oct 2026 · Uphotox publicado en Vercel
**Qué se hizo**
- Proyectos creados en el equipo «Upgradix's projects» y conectados a GitHub
  (`OsvaldoELR/uphotox`, rama `main`): `uphotox-app` (carpeta `apps/app`) y
  `uphotox-api` (carpeta `apps/api`), ambos como Next.js.
- Variables de entorno subidas desde `apps/app/.env.local` sin mostrarlas
  (producción y preview): 8 en la app y 5 en la API. Las claves secretas
  (`SUPABASE_SECRET_KEY`, `RESEND_TOKEN`) como *Sensitive*. Direcciones:
  `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_WEB_URL` = https://uphotox-app.vercel.app,
  `NEXT_PUBLIC_API_URL` = https://uphotox-api.vercel.app.
- El primer deploy de la app falló en las pruebas: Vercel compila con
  `NODE_ENV=production` y React cargaba su versión de producción (sin `act`),
  que rompe las pruebas de login y registro. Arreglado forzando
  `NODE_ENV=test` en `apps/app/vitest.config.mts`.

**Comprobado**
- API: `/health` responde OK; la entrada de clientes contesta 405 a GET y 404
  a un token falso.
- App: inicio de sesión real con un usuario temporal en la dirección pública;
  panel, tablero, clientes y ajustes abren sin errores (usuario borrado).
- Un `git push` publica solo (probado con el arreglo de las pruebas).

**Detalle técnico**: el proyecto `uphotoxv2` que ya existía en el equipo es de
otro repositorio (`OsvaldoELR/uphotoxv2`) y no se tocó.

### 8 oct 2026 · Herramientas de Vercel en el PC
**Qué se hizo** (siguiendo la guía oficial https://vercel.com/get-started.md):
- CLI de Vercel actualizada de 54.14.0 a **63.1.0** y con sesión iniciada como
  **osvaldo-2335**. Equipo disponible: «Upgradix's projects» (plan Hobby).
- Plugin oficial de Vercel instalado en Claude Code para todos los proyectos
  (`vercel-plugin@vercel` 0.54.1): guías, comandos de publicación y la
  conexión MCP con `https://mcp.vercel.com`.
- La conexión MCP la aporta el plugin; no se añadió otra para no duplicarla.

**Después**: la conexión MCP quedó autorizada y comprobada (búsqueda en la
documentación y lista de equipos), pero solo con la cuenta personal; para el
equipo se usa la CLI. Los proyectos se crearon en la entrada siguiente.

**Nota**: el plugin envía estadísticas mínimas de uso (nombres de las guías
usadas e identificadores aleatorios). Se desactivan con la variable de entorno
`VERCEL_PLUGIN_TELEMETRY=off`.

### 8 oct 2026 · Guía para publicar en Vercel
**Qué se hizo**: guía paso a paso en `docs/deploy-vercel.md` para publicar la
app (`apps/app`) y la API (`apps/api`) desde el panel de Vercel conectado a
GitHub: variables de entorno exactas, direcciones de Supabase, correo de
registro con Resend, dominio propio y lista de comprobación.

**Decisiones**
- Dos proyectos en Vercel desde el mismo repositorio (`uphotox-app` y
  `uphotox-api`); la web pública de la plantilla (`apps/web`) no se publica.
- Variables obligatorias: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL` y
  `NEXT_PUBLIC_WEB_URL` (esta última no se usa: va con la misma dirección de la
  app). `SUPABASE_SECRET_KEY` hace falta para crear usuarios en Equipo y para
  la API.
- La API se recomienda aunque no se use Make: su tarea nocturna evita que
  Supabase gratuito se pause.
- El plan gratuito de Vercel es solo para uso no comercial; para vender
  Uphotox hará falta el plan Pro.

**Estado**: la CLI de Vercel está instalada pero sin sesión, así que la
publicación la hace el usuario desde el panel (o se puede hacer por CLI tras
`vercel login`). Pendiente de hacerse.

### 8 oct 2026 · Fuera las letras japonesas (写真)
**Qué se hizo**: se quitó el adorno 写真 («fotografía» en japonés) de todas las
pantallas: encima del logo en el menú lateral y en el login, en la etiqueta
del login (ahora «Estudio fotográfico») y en la del panel (ahora solo el
nombre del estudio). El logo ya no tiene la opción de mostrarlo.

**Decisión**: ningún carácter chino ni japonés en la app (anotado en
`.interface-design/system.md`). La web pública de la plantilla (`apps/web`)
conserva el idioma chino en su selector de idiomas porque es un idioma, no un
adorno; se quita si se pide.

**Código**: `packages/design-system/components/hud/wordmark.tsx`,
`apps/app/app/(unauthenticated)/layout.tsx`, `apps/app/app/(authenticated)/page.tsx`,
`apps/app/app/(authenticated)/components/sidebar.tsx`.

**Comprobado**: búsqueda en el código (0 caracteres), login y panel en el
navegador sin ninguno, Biome y tipos sin errores.

### 7–8 oct 2026 · Módulo Clientes e importación de CSV
**Qué se hizo**
- `/clientes`: lista de clientes ordenada por próxima sesión, búsqueda por
  nombre, teléfono, correo o nombre del niño/a, y ficha con sus sesiones
  (botón «Abrir» que lleva a la tarjeta), WhatsApp/llamar/correo, edición y
  borrado (borra también sus tarjetas).
- `/clientes/importar`: archivo → columnas → revisión → destino. Adivina las
  columnas (probado con los encabezados reales del Typeform), lee fechas en
  día/mes o mes/día con hora aparte o junto, corrige dominios de correo mal
  escritos y explica cada fila que se omite.
- Tablero: `?tarjeta=<id>` abre esa tarjeta; una sesión sin hora se muestra
  solo con el día.
- Análisis del formulario de reserva guardado en `docs/flujo-estudio.md`.

**Decisiones**
- Al importar **no se envía ningún correo**; los avisos salen al mover tarjetas.
- La etapa de destino es «Agendado» por defecto (se puede cambiar).
- Título de la tarjeta = «Niño/a · Tipo de sesión»; el resto de columnas va a
  las notas como «• Pregunta: respuesta».
- Un cliente se reconoce por el mismo correo o los mismos dígitos de teléfono.
- Reimportar el mismo archivo no duplica nada (columna ID o huella de la fila).
- El formulario no guarda la fecha de la sesión (está en Google Calendar), así
  que el CSV a importar debe salir de una hoja que sí la tenga.

**Código**: `apps/app/lib/csv.ts`, `apps/app/lib/client-import.ts` (con
pruebas), `apps/app/app/actions/clients.ts`, `apps/app/app/(authenticated)/clientes/`,
migración `20261008032019_client_import.sql` (función `import_cards`).

**Comprobado**: 31 comprobaciones en el navegador, 17 pruebas automáticas y la
compilación. Datos de prueba borrados.

### 7 oct 2026 · Móvil, foto de tarjeta, Google Fotos y entrada por Make
- En el móvil: pestañas de etapas y botón «Mover a…» (no hace falta arrastrar);
  selector «Etapa» en el detalle de la tarjeta.
- Foto de la tarjeta comprimida en el navegador (p. ej. 110 KB → 8 KB), en
  almacenamiento privado; se borra con la tarjeta o el tablero.
- El enlace de entrega es un álbum de Google Fotos («Ver mi álbum» en el correo).
  La API de Google Fotos ya no permite compartir álbumes: el enlace se pega a mano.
- Entrada de clientes por webhook (Typeform → Make → Uphotox), configurable en
  Ajustes; crea cliente y tarjeta con todas las respuestas en las notas, sin
  duplicar reintentos. Solo funciona en local hasta publicar `apps/api`.
- Documentado el flujo real del estudio en `docs/flujo-estudio.md`.

### 7 oct 2026 · WhatsApp en los avisos
- Los correos al cliente ya no dicen «responde a este correo»: llevan un botón
  al WhatsApp del estudio (campo en el onboarding y en Ajustes).

### 7 oct 2026 · Estudios, equipo, tableros y correos
- Una cuenta = un estudio; cada persona pertenece a un solo estudio.
- Roles en inglés (owner, photographer, editor, assistant) más permisos
  activables por usuario, como en GoHighLevel; «solo datos asignados».
- Tableros tipo Trello con 7 etapas por defecto (Agendado → Entregadas); cada
  etapa puede avisar al cliente por correo y la dueña recibe aviso cuando otro
  mueve una tarjeta.
- Correos con Resend; seguridad por RLS en todas las tablas.

### 7 oct 2026 · Estilo visual y limpieza de la plantilla
- Estilo «mesa de luz»: el HUD de Tokyo Store en versión clara.
- Efectos animados solo en el login y la landing; dentro de la app, solo la
  retícula estática.
- Quitados los webhooks de Svix y las piezas de la plantilla que no se usan.
