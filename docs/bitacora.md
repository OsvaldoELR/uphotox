# Bitácora de Uphotox

Registro de lo que se ha hecho, en orden de más reciente a más antiguo. Se
actualiza al terminar cada tarea. Para retomar en otra sesión, lee primero
**Estado actual** y **Pendientes**.

Documentos relacionados:
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
| Entrada de clientes (Make/Typeform) | Hecho en local; falta publicar la API | `apps/api` |
| Editor de imágenes | Pendiente («Pronto» en el menú) | — |

Configuración:
- **Supabase**: proyecto enlazado (`cdkosqookglkyrjazmho`), migraciones al día.
- **Resend**: configurado en `apps/app/.env.local`, así que **los correos salen
  de verdad** al mover tarjetas. Para probar, usar solo `delivered+algo@resend.dev`.
- **GitHub**: https://github.com/OsvaldoELR/uphotox (rama `main`).

## Pendientes

Del usuario:
- [ ] Importar el CSV real de clientes agendados (Clientes → Importar CSV).
- [ ] Publicar `apps/api` en Vercel (HTTPS) y poner `NEXT_PUBLIC_API_URL` en
      producción, para que Make pueda enviar las reservas. *Pospuesto.*
- [ ] Usar Resend como SMTP de Supabase Auth, para que los nuevos dueños
      reciban el correo de confirmación (no está confirmado que se haya hecho).
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
