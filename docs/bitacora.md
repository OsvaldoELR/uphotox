# Bitácora de Uphotox

Registro de lo que se ha hecho, en orden de más reciente a más antiguo. Se
actualiza al terminar cada tarea. Para retomar en otra sesión, lee primero
**Estado actual** y **Pendientes**.

Documentos relacionados:
- `CHANGELOG.md`: versiones publicadas.
- `docs/deploy-vercel.md`: cómo publicar la app y la API en Vercel.
- `docs/cloudflare-r2.md`: almacenamiento de las fotos de las galerías.
- `docs/brand/README.md`: logo, iconos, colores y textos para compartir.
- `CLAUDE.md`: reglas técnicas del proyecto (base de datos, permisos, correo…).
- `docs/flujo-estudio.md`: cómo trabaja el estudio, análisis del formulario de
  reserva y hoja de ruta de automatización con IA.
- `.interface-design/system.md`: estilo visual y patrones de pantalla.

---

## Estado actual (13 oct 2026 · versión 0.4.0)

Versión publicada: **v0.4.0** (historial de versiones en `CHANGELOG.md`).

| Módulo | Estado | Dónde |
| --- | --- | --- |
| Login, registro y onboarding | Hecho | `/sign-in`, `/sign-up`, `/onboarding` |
| Panel | Hecho: saludo, avisos de configuración, embudo de cada tablero | `/` |
| Tableros (tipo Trello) | Hecho: etapas (se pueden reordenar), arrastrar o «Mover a…», añadir arriba o abajo, foto, avisos por correo, historial | `/tableros` |
| Clientes | Hecho: lista, ficha, importación CSV | `/clientes`, `/clientes/importar` |
| Equipo | Hecho: usuarios con rol y permisos tipo GoHighLevel | `/equipo` |
| Ajustes | Hecho: nombre, WhatsApp, entrada de clientes (webhook) | `/ajustes` |
| Entrada de clientes (Make/Typeform) | Hecho y publicado | `apps/api` |
| Galerías (selección, sustituye a Pixieset) | Publicado (v0.4.0): subir fotos a Cloudflare R2, enviar al cliente, página del cliente con guía de primera visita, confirmar, lista para Lightroom, reabrir. Falta el borrado automático diario | `/galerias`, `/g/<código>` |
| Editor de imágenes | Pendiente («Pronto» en el menú) | — |

Publicado en Vercel (equipo «Upgradix's projects», plan Hobby):
- **App**: https://uphotox-app.vercel.app (proyecto `uphotox-app`, carpeta `apps/app`).
- **API**: https://uphotox-api.vercel.app (proyecto `uphotox-api`, carpeta `apps/api`).
- Cada `git push` a `main` publica solo; los proyectos sin cambios se saltan y
  un commit con `[skip ci]` en el mensaje no publica nada.

Configuración:
- **Supabase**: proyecto enlazado (`cdkosqookglkyrjazmho`), migraciones al día.
- **Cloudflare R2**: bucket privado `uphotox-galerias` con CORS para la app y
  localhost; claves `R2_*` en `apps/app/.env.local` y en Vercel (`uphotox-app`).
  Guía: `docs/cloudflare-r2.md`.
- **Resend**: configurado en `apps/app/.env.local`, así que **los correos salen
  de verdad** al mover tarjetas. Para probar, usar solo `delivered+algo@resend.dev`.
- **GitHub**: https://github.com/OsvaldoELR/uphotox (rama `main`).

## Pendientes

Del usuario:
- [ ] Galerías ya está publicada: activar «Galerías» a la fotógrafa en
      Equipo (los usuarios ya creados no lo tienen) y probar una galería real
      antes de cancelar Pixieset. Decidir antes qué hacer con la web del
      estudio, que también está en Pixieset.
- [ ] Importar el CSV real de clientes agendados (Clientes → Importar CSV).
- [ ] En Make, pegar la URL definitiva del webhook (Ajustes → Entrada de
      clientes en la app publicada; empieza por `https://uphotox-api.vercel.app`).
- [ ] Opcional: volver a autorizar la conexión MCP de Vercel eligiendo el
      equipo «Upgradix's projects» (ahora solo ve la cuenta personal; la CLI
      sí tiene acceso al equipo, así que no bloquea nada).
- [ ] Antes de vender a otros estudios: plan Pro de Vercel (el Hobby es solo
      para uso no comercial) y, si se quiere, dominio `app.uphotox.com`.
- [ ] Opcional: que el enlace de recuperación de contraseña funcione también
      en otro navegador/dispositivo (cambiar la plantilla del correo; ver
      Historial, 11 oct). Hoy funciona si se abre en el mismo navegador.
- [ ] Opcional: activar en Supabase la protección de contraseñas filtradas
      (único aviso del revisor de seguridad).
- [ ] Crear la etapa «Solicitud recibida» («Nueva etapa», sin aviso al
      cliente), ponerla la primera con «Ordenar etapas» y elegirla en Ajustes → Entrada de clientes
      → «Etapa de entrada» (hoy apunta a «Agendado», cuyo correo dice que la
      sesión está confirmada). Pasos de Make en el Historial, 11 oct (v0.3.0).
- [ ] Decidir copias de seguridad de la base de datos (Supabase Pro con copias
      diarias, o una copia semanal automática).
- [ ] Responder las preguntas abiertas de `docs/flujo-estudio.md` (fotos de
      cada paquete, dónde se guardan los RAW, sesiones al mes, editores
      externos).

De Galerías (por programar, en este orden):
- [ ] Tarea diaria en `apps/api`: borrar fotos a los 60 días de confirmar
      o caducar (`purged_at`), filas sin terminar de más de un día y lo que
      quede en `storage_deletions`. Añadir `R2_*` al proyecto `uphotox-api`
      de Vercel y `@repo/storage` a la API.
- [ ] Ajustes: campo «Precio por foto extra» (hoy $20 fijo por defecto).
- [ ] Probar en producción con una galería real antes de cancelar Pixieset.
- [ ] Opcional: estado de la galería en la tarjeta del tablero (chip «Esperando
      · 5/12», «Selección recibida»).

Detectado al probar (no es de Galerías):
- [ ] Si se borra un usuario con la sesión abierta (p. ej. un miembro del
      equipo), su navegador entra en un bucle de redirecciones hasta que caduca
      la sesión (≈1 h): el proxy ve la sesión válida, la página no encuentra el
      usuario y manda a /sign-in, que a su vez devuelve a /. Se resolvió en la
      prueba borrando las cookies.
- [ ] En desarrollo, el primer tablero que se abre tras iniciar sesión (o el
      mismo tablero cargado dos veces a la vez) da un aviso de hidratación de
      React (ids distintos). No aparece al recargar y no es de este cambio.

Ideas para los siguientes módulos (detalle en `docs/flujo-estudio.md`):
Google Calendar, recordatorios por WhatsApp, plugin de Lightroom y galería de
entrega, Google Drive para los DNG de los editores, IA para preseleccionar y
editar, paquetes y pagos.

## Cómo retomar

- Arrancar la app: `npm run dev -- --filter=app` (puerto 3000).
- Cambios en la base de datos: `npm run db:new -- <nombre>`, luego
  `npm run db:push` y `npm run db:types`.
- Comprobar antes de subir: `npm run build -- --filter=app --filter=api`
  (también ejecuta las pruebas).

---

## Historial

### 13 oct 2026 · v0.4.0 publicada y comprobada en producción
**Qué se hizo**: versión 0.4.0 (`package.json`, `CHANGELOG.md`, etiqueta
`v0.4.0`) subida a GitHub; Vercel publicó la app y la API (ambas READY). Las
migraciones ya estaban aplicadas y las variables `R2_*` ya estaban en el
proyecto `uphotox-app`.

**Comprobado en https://uphotox-app.vercel.app**
- La API responde (`/health` 200); `/g/<código inexistente>` da 404 con «Este
  enlace no existe» sin pedir sesión; `/galerias` sin sesión manda al login;
  la página lleva `Cross-Origin-Embedder-Policy: require-corp`.
- Con un estudio temporal (ya borrado, sin restos en la base de datos ni en
  R2) y una galería de 4 fotos preparada por script: la página del cliente
  carga las 4 fotos desde R2 (CORS correcto para el dominio publicado),
  título «Elige tus fotos · <estudio>», la guía sale sola; elegir 3 con
  paquete de 2 → «3 / 2 · 1 extra · $20»; confirmar con comentario → página
  «¡Listo!», galería confirmada, tarjeta en «Escogidas», historial «3 fotos (1
  extra)» y aviso al equipo enviado.
- La parte del estudio (crear, subir, enviar) no se repitió en producción: el
  navegador tenía abierta la sesión real de «Lente Libre Photography» y no se
  tocó. Quedó probada en local el mismo día.

### 13 oct 2026 · Galerías: página del cliente, guía de primera visita, enviar y confirmar (sin publicar)
**Qué se hizo**
- **Enviar al cliente** (bloque «Cliente» en la página de la galería): abre
  la galería 60 días, mueve la tarjeta a la etapa marcada como «envío»
  («Enviadas para escoger») y manda al cliente el correo «Tus fotos están
  listas para elegir» (paquete, precio del extra, fecha límite y botón
  «Elegir mis fotos»). Según el estado, el bloque ofrece «Copiar enlace»,
  «WhatsApp» (mensaje ya escrito al teléfono del cliente, si trae código de
  país), «Ver como cliente», «Enviar de nuevo» / «Renovar y enviar de nuevo»
  (renueva 60 días) y, cuando el cliente confirma, la **lista para Lightroom**
  con «Copiar para Lightroom» y «Reabrir selección» (vuelve a la etapa de
  envío, sin correo).
- **Página del cliente** `/g/<código>` (sin cuenta; el código es la llave):
  cabecera con el estudio, la sesión, el paquete, el precio del extra y la
  fecha límite; pestañas «Todas / Mis favoritas»; fotos enteras en filas
  justificadas, en el orden de los archivos (dos por fila en el móvil);
  corazón en cada foto (se guarda al instante y vuelve atrás con aviso si
  falla); vista ampliada con deslizar, flechas, teclado y «Elegir esta foto»
  (muestra la miniatura al momento y la foto grande al llegar); barra fija
  abajo con «5 / 12», lo que falta o los extras con su importe, y
  «Confirmar». Al confirmar: resumen, comentario opcional y aviso de que ya no
  se puede cambiar; después la página muestra «¡Listo! Recibimos tu
  selección» con sus fotos. Caducada, sin enviar o borrada: mensaje claro con
  el WhatsApp del estudio; código inexistente: «Este enlace no existe» (404).
  Al compartir el enlace se ve el nombre del estudio y una foto de la sesión
  (no la imagen de Uphotox) y la página no aparece en buscadores.
- **Guía de primera visita** con **driver.js** 1.8.0 (MIT, ~25 KB, solo se
  descarga en esta página): oscurece la página y resalta, en 8 pasos, el
  saludo, el paquete, cómo ampliar una foto, el corazón, el contador (y que
  todo se guarda solo), «Mis favoritas», «Confirmar» y el botón «?» para verla
  otra vez. Sale sola la primera vez en cada dispositivo (se recuerda en el
  navegador) y no deja tocar la página mientras explica. Estilo de la app en
  `gallery-tour.css`.
- **Al confirmar** (función `submit_gallery_selection`, una sola transacción):
  cierra la galería, guarda el comentario, mueve la tarjeta a la etapa de
  «recibida» («Escogidas») y lo apunta en el historial («6 fotos (3
  extras)»). Después: correo de esa etapa al cliente (si avisa) y «Selección
  recibida» a la dueña y a la responsable de la tarjeta (con extras,
  comentario y botón a la galería).
- Correos de etapa: mientras la galería espera al cliente, cualquier correo de
  etapa lleva también el botón «Elegir mis fotos».
- Texto por defecto de «Enviadas para escoger» cambiado (ya no pide
  «avísanos con tu selección»); migración que lo actualiza en los tableros
  que tenían el texto original (el tablero 6 lo tenía; el otro usa el texto
  automático).
- Historial: un movimiento sin persona (el del cliente) se lee «Pasó de… a…».

**Dónde está el código**: página del cliente en `apps/app/app/g/[token]/`
(`data.ts`, `page.tsx`, `not-found.tsx`, `components/client-gallery.tsx`,
`photo-viewer.tsx`, `gallery-tour.ts` + `.css`, `gallery-unavailable.tsx`);
acciones del cliente en `app/actions/client-gallery.ts` (servicio, acotadas a
la galería del código); enviar/reabrir en `app/actions/galleries.ts`; correos
en `lib/gallery-notify.tsx` y `packages/email/templates/gallery-ready.tsx`,
`selection-received.tsx` (bloque de WhatsApp compartido en `shell.tsx`);
bloque «Cliente» en `galerias/[galleryId]/components/client-share.tsx`;
`/g` público en `apps/app/proxy.ts`; migraciones
`20261013190350_gallery_selection.sql` y `20261013191439_gallery_stage_message.sql`.

**Comprobado** en el navegador con un estudio temporal (borrado después, sin
restos en la base de datos ni en R2): crear galería (paquete de 3 leído de las
notas) y subir 8 fotos; «Enviar al cliente» → tarjeta en «Enviadas para
escoger», correo aceptado por Resend y caducidad a 60 días; como cliente, la
guía sale sola y recorre los 8 pasos (también a 390 px), elegir 5 → «5 / 3 · 2
extras · $40», vista ampliada (siguiente, elegir, cerrar) → «6 / 3 · 3 extras
· $60», «Mis favoritas» con 6; confirmar con comentario → página «¡Listo!»,
tarjeta en «Escogidas», historial «6 fotos (3 extras)» y dos correos
aceptados (cliente y equipo); en el estudio, la lista para Lightroom
`IMG_0003, …, IMG_0018`, «Copiar enlace» (con clic real) y el enlace de
WhatsApp; «Reabrir selección» → vuelve a «Enviadas para escoger» conservando
las favoritas; caducada → la página del cliente avisa y «Renovar y enviar de
nuevo» la reabre; código inexistente → 404 en español; título, vista previa
y `noindex` correctos. Biome, tipos, 31 pruebas de la app y 8 de la API, y
compilación de app y API. Revisor de Supabase sin avisos nuevos.

**Decisiones**
- Al enviar, el correo es el de la galería (no el de la etapa) para no mandar
  dos; la dueña no recibe aviso por ese movimiento.
- Reabrir no escribe al cliente: el estudio le avisa por WhatsApp.
- El cliente ve el nombre de archivo (IMG_0012) en la vista ampliada, para
  que pueda referirse a una foto al escribir al estudio.
- Si el navegador bloquea el almacenamiento local, la guía sale en cada
  visita (se puede cerrar).

### 13 oct 2026 · Galerías: Cloudflare R2 y subida de fotos (sin publicar)
**Qué se hizo**
- El usuario creó la cuenta de Cloudflare, el bucket `uphotox-galerias` con su
  CORS y la clave «Object Read & Write» solo de ese bucket. Comprobado: sube,
  lee con enlace firmado, borra en bloque y rechaza lo que no va firmado; el
  CORS deja entrar a la app y a `localhost:3000` y rechaza otras webs. Las 4
  variables `R2_*` están en `apps/app/.env.local` y en Vercel (`uphotox-app`,
  producción y preview; la clave y el secreto como *Sensitive*).
- Paquete nuevo `@repo/storage` (`packages/storage`): conexión con R2 por su
  API S3 con `aws4fetch` (enlaces firmados de subida y de descarga, tamaño de
  un archivo, borrado en bloque), rutas de cada foto (`gallery.ts`) y
  `flushStorageDeletions` (vacía la cola `storage_deletions` borrando en R2).
  Los enlaces de descarga se firman desde el inicio del día y duran 2 días:
  la misma foto tiene la misma dirección todo el día y el navegador la guarda.
- **Menú «Galerías»** (`/galerias`): lista con estado, fotos, elegidas y
  fecha. Se ve con cualquiera de los dos permisos de galerías.
- **Ficha de la tarjeta**: bloque «Galería de selección» con el estado y
  «Abrir galería», o «Crear galería» (rellena las fotos incluidas leyendo
  «12 FOTOS» de las notas y copia el precio del extra del estudio).
- **Página de la galería** (`/galerias/<id>`): resumen (fotos, elegidas,
  incluidas, extras y su importe), comentario del cliente, zona para
  arrastrar las fotos con barra de progreso, paquete editable, cuadrícula de
  miniaturas con nombre de archivo, corazón en las elegidas, filtros
  «Todas / Elegidas / Sin terminar», quitar una foto, quitar todas y
  eliminar la galería.
- **Subida**: el navegador lee cada JPG, hace la miniatura (600 px, ~32 KB) y
  deja la foto tal cual si pesa menos de 1,5 MB y no pasa de 3000 px (si no,
  la reduce a 2048 px). Registra las fotos de 24 en 24, las sube directo a
  R2 de 4 en 4 y el servidor confirma que llegaron enteras. Las repetidas se
  saltan, lo que no es JPG se rechaza con su motivo y lo fallido se reintenta
  arrastrándolo otra vez. Avisa si se intenta cerrar la página a medias.
- **Borrado**: al quitar fotos o eliminar galería, tarjeta, tablero o cliente,
  el servidor vacía la cola y borra los archivos de R2 justo después de
  responder (`lib/storage-cleanup.ts`).
- Reglas puras en `apps/app/lib/gallery.ts` con 14 pruebas: estado de la
  galería, paquete leído de las notas, lista para Lightroom, extras, nombres.

**Dónde está el código**: `packages/storage/`, `apps/app/app/actions/galleries.ts`,
`apps/app/app/(authenticated)/galerias/` (lista, página, subida y
cuadrícula), `tableros/[boardId]/components/card-gallery.tsx`,
`apps/app/components/gallery-state-chip.tsx`, `apps/app/lib/gallery.ts` y
`lib/storage-cleanup.ts`; el menú en `components/sidebar.tsx` (un elemento
puede pedir uno de varios permisos).

**Comprobado** en el navegador con un usuario temporal (ya borrado, sin
restos en la base de datos ni en R2): crear la galería desde la tarjeta (12
incluidas leídas de las notas); subir 32 archivos → «30 subidas · 1 ya estaba
· 1 con error» (el PNG), 62 archivos en R2; la foto de 6000 px quedó en 2048 px
(112 KB); miniaturas visibles sin errores de CORS; con 14 elegidas (marcadas
a mano en la base de datos) salen los corazones, el filtro y «2 · $40» de
extras, y con 15 incluidas pasa a 0; la lista y la ficha muestran «30 fotos ·
14 elegidas»; quitar una foto, quitar todas, eliminar la galería y eliminar
la tarjeta dejan R2 y la cola vacíos. Biome, tipos, 31 pruebas de la app y 8
de la API, y la compilación de app y API. Un aviso de hidratación que aparece
al cargar dos veces el mismo tablero a la vez en desarrollo también sale sin
el bloque de galería (no es de este cambio).

**Sin publicar**: no se ha hecho `git push`; se publicará como v0.4.0 cuando
el cliente pueda elegir sus fotos.

### 13 oct 2026 · Módulo Galerías: plan y base de datos
**Decisiones (con el usuario)**
- Es un módulo propio, **Galerías**; «Editor» sigue «Pronto» para la edición
  (editores externos, IA). Primera versión: galería de selección que
  sustituye a Pixieset ($10/mes, 10 GB, solo se usa para galerías y una web
  del estudio desactualizada).
- Volumen: 100–200 fotos por sesión de ~200 KB (ya salen de Lightroom en baja
  calidad, con marca de agua y el nombre original `IMG_1234.jpg`): ~30 MB por
  galería con miniaturas. La marca de agua se sigue poniendo en Lightroom.
- El cliente puede elegir extras: siempre **$20** por foto (ajuste del
  estudio que se copia a cada galería); se cobra fuera de Uphotox.
- Plazos: el enlace caduca a los **60 días** sin elegir y las fotos se borran
  **60 días** después de confirmar (o de caducar); se conserva la lista.
- Almacenamiento: **Cloudflare R2** (10 GB gratis y descargas sin coste: $0 al
  mes hasta más de 100 sesiones al mes). Supabase sigue en el plan gratis.
  Descartados: Supabase Storage (1 GB gratis no alcanza, Pro $25/mes), Google
  Drive (desde 2024 Google bloquea las imágenes de Drive en otras webs, habría
  que pasarlas por el servidor y depende de la cuenta; útil más adelante para
  los DNG de los editores y la entrega) y Amazon Photos (sin API desde 2023).
- No cancelar Pixieset hasta probar una galería real; con él se va también la
  web del estudio.

**Qué se hizo**
- Migración `20261013174108_galleries.sql`, aplicada:
  - Permisos `galleries.view` («Ver galerías y copiar la selección para
    Lightroom») y `galleries.manage` («Crear galerías, subir fotos y
    enviarlas al cliente»). Vienen marcados al crear un Photographer o un
    Editor; a los usuarios existentes hay que activárselos en Equipo.
  - `studios.extra_photo_price` (20 por defecto).
  - `board_stages.gallery_role` (`sent` / `submitted`): etapa a la que pasa la
    tarjeta al enviar la galería y al confirmar el cliente. Los dos tableros
    existentes quedaron marcados por nombre («Enviadas para escoger» y
    «Escogidas») y la plantilla «Flujo completo» lo trae al crear tableros.
  - Tablas `galleries` (una por tarjeta: código secreto del enlace, estado
    borrador/abierta/confirmada, fotos incluidas, precio del extra, fechas,
    comentario del cliente, fecha de borrado de las fotos) y
    `gallery_photos` (nombre del archivo, tamaño, subida, favorita). Una
    galería solo se ve si se ve su tarjeta.
  - `storage_deletions`: cola de rutas de R2 por borrar; la llena un trigger
    al borrar fotos, también en cascada al borrar galería, tarjeta, tablero o
    cliente.
  - Historial de la tarjeta: «envió la galería», «el cliente confirmó su
    selección», «reabrió la selección» (ya con su texto en la ficha).
- Pasos de Cloudflare dados al usuario y guardados en `docs/cloudflare-r2.md`
  (bucket privado `uphotox-galerias`, clase Standard, CORS para la app y
  localhost, clave «Object Read & Write» solo de ese bucket).
- `CLAUDE.md` y `docs/flujo-estudio.md` actualizados.

**Dónde está el código**: la migración, `packages/database/types.ts`
(regenerado), `apps/app/lib/permissions.ts`, `apps/app/lib/board-templates.ts`
+ `lib/boards.ts` (`gallery_role`), `apps/app/app/actions/cards.ts` y
`card-sheet.tsx` (historial).

**Comprobado**: migración aplicada; revisor de Supabase sin avisos nuevos
(solo el conocido de contraseñas filtradas); leídos los datos: etapas
marcadas en los dos tableros y extra = 20 en los dos estudios; Biome, tipos y
17 pruebas OK. Sin publicar (no cambia nada visible todavía).

### 11 oct 2026 · v0.3.0 · Ordenar etapas y añadir clientes arriba
**Qué se hizo**
- **Ordenar etapas**: menú `…` del tablero → «Ordenar etapas». Se arrastra cada
  etapa o se usan las flechas ↑ ↓ (más cómodo en el móvil) y se pulsa «Guardar
  orden». Todas las pantallas que listan etapas las ordenan por posición, así
  que el orden nuevo aparece solo en el tablero, «Mover a…», la importación de
  CSV («Etapa de destino»), el panel y Ajustes (entrada de clientes). Las
  etapas nuevas también salen en todos esos sitios.
- **Añadir arriba**: botón «+» en la cabecera de cada etapa; abre el formulario
  encima de las tarjetas y el cliente queda el primero. «Añadir cliente» del
  pie sigue añadiendo al final.
- Arreglo: las pruebas automáticas fallaban en el PC desde la v0.2.0 porque no
  leían `apps/app/.env.local` (en Vercel sí había variables, por eso la
  publicación salió bien). Ahora `vitest.config.mts` las carga con `loadEnv`.

**Dónde está el código**
- Acción `reorderStages` en `apps/app/app/actions/boards.ts`: solo con permiso
  de gestionar tableros, comprueba que la lista sea exactamente las etapas del
  tablero (si alguien añadió o borró una mientras tanto, pide recargar) y
  renumera las posiciones (1024, 2048…).
- Diálogo `tableros/[boardId]/components/stage-order-dialog.tsx` (abierto desde
  `board-menu.tsx`).
- `createCard` en `apps/app/app/actions/cards.ts` acepta `placement`
  (`start`/`end`); `quick-add.tsx` separa el formulario (`QuickAddForm`) del
  botón del pie, y `stage-column.tsx` añade el «+» de la cabecera.
- Sin cambios en la base de datos.

**Entrada automática desde Make (respuesta a la pregunta del usuario)**
1. En el tablero (en el ordenador): «Nueva etapa» → «Solicitud recibida»
   (nace con «Avisar al cliente» **apagado**; dejarlo así) y con «Ordenar
   etapas» subirla la primera.
2. Ajustes → Entrada de clientes: «Tablero de destino» = el tablero y «Etapa de
   entrada» = «Solicitud recibida» (al activarla se guardó la primera etapa de
   entonces, «Agendado»; hay que cambiarla a mano). Copiar la URL: es
   `https://uphotox-api.vercel.app/webhooks/clients/<código secreto>`.
3. En Make: Typeform «Watch responses» → HTTP «Make a request»: método POST,
   cuerpo JSON (Content-Type `application/json`) con `name` (obligatorio),
   `email`, `phone`, `title` (p. ej. el nombre del niño y el tipo de sesión),
   `answers` (preguntas y respuestas; van a las notas) y `external_id` = el
   «Response ID» de Typeform (evita duplicados si Make reintenta).
4. La entrada **nunca** manda correo al cliente; el aviso sale cuando se mueve
   la tarjeta a una etapa con aviso (p. ej. «Agendado»).
5. Detalles aclarados después con el usuario:
   - Los campos van en inglés: `notes`, no `notas`. Los nombres que la API no
     conoce se ignoran sin dar error, así que esa nota se perdería sin aviso.
   - `name` = solo el nombre del cliente (padre/madre/novios): el correo
     empieza con «Hola, {name}». El nombre del niño va en `title`; si está
     vacío (bodas), la tarjeta usa el nombre del cliente.
   - Typeform con varias rutas («Qué oferta desea?» repetida por tipo de
     sesión): en Make basta poner seguidas todas las versiones de la pregunta
     en `notes` (`Oferta: {A}{B}{C}…`). Solo una tiene respuesta y las vacías
     no escriben nada, así que no hace falta un if (alternativa:
     `ifempty(A; ifempty(B; C))`). Para separar líneas se escribe `\n` dentro
     del texto.
   - Si una respuesta trae comillas, el JSON se rompe y la API responde 400 (el
     error queda en Ajustes → Entrada de clientes); en ese caso, usar el
     módulo «JSON → Create JSON» de Make.

**Qué falta en esta fase (antes del siguiente módulo)**: copias de seguridad
de la base de datos, plan Pro de Vercel antes de cobrar a otros estudios,
conectar Make en producción, y opcionales (plantilla del correo de
contraseña, protección de contraseñas filtradas, base de datos aparte para
pruebas). Propuesta para el siguiente módulo: **galería de selección**
(sustituye a Pixieset y a copiar números a Lightroom; base para la IA de
preselección y edición), pendiente de que el usuario la confirme.

**Comprobado**: Biome, tipos y 17 pruebas (en modo normal y con
`NODE_ENV=production` como en Vercel). En el navegador, con un usuario temporal
ya borrado: el diálogo ordena con flechas y arrastrando, el orden se guarda y
se ve en el tablero y en la importación de CSV («01 · Solicitud recibida…»);
el «+» crea la tarjeta la primera (posición 0 frente a 1024); en el móvil el
«+» se ve en la cabecera. Sin errores en la consola.
Publicado (app y API en READY, etiqueta `v0.3.0`) y la misma prueba completa
pasó en `https://uphotox-app.vercel.app` (13 de 13, usuario temporal borrado).

### 11 oct 2026 · Enlace de «olvidé mi contraseña»: diagnóstico (sin cambios)
**Qué pasaba**: el usuario vio que el enlace del correo de recuperación «no
funcionaba».

**Diagnóstico** (reproducido en producción con usuarios temporales, ya
borrados, construyendo el mismo enlace del correo):
- Abierto en el **mismo navegador** donde se pidió: funciona entero (abre
  «Elige una contraseña nueva», guarda la contraseña y se puede entrar con
  ella).
- Abierto en **otro navegador o dispositivo** (p. ej. el móvil o la app de
  Gmail): vuelve al login con «Ese enlace no es válido o ha caducado». Es el
  diseño de seguridad de Supabase (PKCE): el código del correo solo se puede
  canjear en el navegador que guardó la clave al pedirlo.

**Solución probada pero no aplicada** (el usuario prefirió dejarlo así):
cambiar en Supabase → Authentication → Emails → Templates → «Reset password»
el enlace por
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password`.
La ruta `/auth/confirm` ya existe en la app y con ella el cambio de contraseña
funcionó desde otro navegador. No requiere tocar código.

### 10 oct 2026 · v0.2.0 · Logo, iconos y vista previa del enlace
**Qué se hizo**
- El usuario pasó el logo y el icono (PNG con fondo blanco, hechos con IA). Se
  les quitó el fondo y se ajustó cada píxel a los colores exactos de la marca
  (bordes suaves conservados, sin el «ruido» de la IA). Maestros en
  `docs/brand/` con su guía.
- Iconos: pestaña del navegador (`app/icon.png`), iPhone
  (`app/apple-icon.png`, opaco porque iOS no admite transparencia) y Android
  (`app/manifest.ts` + `public/brand/icon-*.png`, con versión «maskable»), y lo
  mismo en la API.
- Logo (símbolo + UPHOTOX) en el menú lateral y en el login, con versión de
  corchetes blancos para el modo oscuro (`components/brand-logo.tsx`).
- Vista previa al compartir el enlace: título «Uphotox · Gestiona tu estudio de
  fotografía», la descripción y una imagen de 1200×630 hecha con las
  tipografías y el fondo de la app (`public/brand/og.jpg`, 65 KB). Textos en
  `apps/app/lib/metadata.ts`.
- La página declara idioma español (`lang="es"`).
- Versiones: nace `CHANGELOG.md`; esta es la **v0.2.0** (la v0.1.0 es la
  primera publicación del 8 oct). Etiquetas `v0.1.0` y `v0.2.0` en Git y versión
  en `package.json`.

**Arreglos encontrados al probar**
- Antes, al compartir el enlace no salía imagen: las páginas públicas
  sobrescribían la de la plantilla. Ahora todas usan `publicPageMetadata`.
- La dirección de la imagen salía mal formada en local
  (`http://http/localhost…`) por cómo la plantilla arma la URL; ahora siempre
  se construye con `NEXT_PUBLIC_APP_URL`.

**Decisiones**
- Los correos a los clientes no llevan el logo de Uphotox: van con el nombre
  del estudio.
- La web pública (`apps/web`) no se tocó; sigue siendo la plantilla y no está
  publicada.

**Comprobado**: Biome, tipos y 17 pruebas; en el navegador, el logo en login
(claro, oscuro y móvil) y en el menú; metadatos con título, descripción e
imagen; icono, icono de iPhone, manifest e imágenes responden 200.
Publicado (app y API en estado READY) y comprobado en la dirección pública: lo
que lee WhatsApp al abrir `https://uphotox-app.vercel.app` trae el título, la
descripción y la imagen `https://uphotox-app.vercel.app/brand/og.jpg`.

### 9 oct 2026 · Supabase apunta a la app publicada y envía con Resend
**Qué se hizo** (lo hizo el usuario en el panel de Supabase): Site URL
`https://uphotox-app.vercel.app`, Redirect URLs con
`https://uphotox-app.vercel.app/**` y SMTP personalizado con Resend.

**Comprobado** (con usuarios temporales, ya borrados):
- Un enlace de acceso con la dirección de la app la respeta
  (`/auth/callback`); uno con una dirección ajena cae en la Site URL. Ninguno
  lleva a localhost.
- Un registro real a `delivered+…@resend.dev` (fuera de la organización de
  Supabase) se acepta y queda registrado el envío del correo de confirmación;
  con el correo propio de Supabase eso fallaría, así que sale por Resend.

Con esto, cualquier dueña de estudio puede registrarse en la app publicada.

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

**Comprobado (9 oct)**: autenticada y funcionando. La dirección del proyecto es
la de Uphotox, se ven las 9 tablas (todas con RLS), las 6 migraciones
aplicadas coinciden con las del repositorio y el revisor de seguridad solo
muestra el aviso conocido de contraseñas filtradas.

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
