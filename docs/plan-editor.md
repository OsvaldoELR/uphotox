# Plan del módulo Editor (limpieza de fondos con IA)

Propuesta del 18 oct 2026; el usuario eligió procesar en Cloudflare y la
fase 1 está construida (falta desplegarla). Sale de la prueba de
`tools/fondo-lab` (historial en `docs/bitacora.md`) y de las decisiones del
usuario: se limpian **solo las fotos que el cliente elige en la galería**, con
**GPT Image 2**, y enderezar y encuadrar es **opcional** en los ajustes.

## Qué hace la primera versión

Desde una galería ya confirmada por el cliente:

1. **«Limpiar fondos»** en la galería (o en su tarjeta). Uphotox muestra la
   lista de fotos elegidas por el cliente (`gallery_photos.picked_at`).
2. **Subir los originales**: el estudio exporta esas fotos a tamaño completo
   desde Lightroom (preset que daremos: JPEG calidad 95, sRGB, mismo nombre) y
   las arrastra. Uphotox las empareja por nombre con la selección y avisa de
   las que faltan o sobran. Suben directo a R2 desde el navegador, como en
   Galerías.
3. **Cola**: cada foto pasa por el proceso de la prueba: analista → zonas y
   caras → recorte de personas → GPT Image 2 → montaje a 40 MP (fondo completo,
   personas originales, manos de ayuda quitadas) → revisor → encuadre si está
   activado. Varias fotos a la vez (hasta 8). **Reintento automático** si la
   API falla o el modelo mueve el encuadre (hasta 2 veces). Si la IA cambia
   poco no se reintenta (en un fondo blanco limpio es lo correcto): el
   revisor marca para revisar lo que quede mal.
4. **Revisión antes/después** en una cuadrícula: mantener pulsado para ver la
   original, ver zonas, abrir a tamaño real. Estados: *lista*, *revisar* (nota
   baja del revisor o avisos), *falló*. Acciones por foto: **aprobar**,
   **rehacer con una nota** («quita también el cable de la izquierda», se
   añade a las instrucciones) o **descartar** (se queda la original).
5. **Descargar las aprobadas**: en Chrome o Edge, de una vez en una carpeta
   que elijas (sin zip), con el nombre original y un sufijo (`DSCF7325-fondo.jpg`)
   para importarlas en Lightroom junto a la original. Conservan los datos de la
   cámara (EXIF) y el perfil de color.
6. **Aviso** al terminar (correo al miembro que lo lanzó: «Tus 30 fotos están
   listas para revisar») y una línea en la actividad de la tarjeta con el
   número de fotos y el coste. La tarjeta no se mueve sola de etapa.

**Ajustes → Editor** (permiso `settings.manage`):
- **Enderezar y encuadrar** (apagado por defecto): aplica el encuadre al
  resultado. Mientras no haya plugin, se guarda también la versión sin
  encuadrar.
- **Quitar manos de ayuda** (encendido por defecto).
- **Límite de gasto al mes** (aviso al 80 % y bloqueo al 100 %).
- **Días que se guardan las fotos** del editor (30 por defecto; luego se
  borran solas).

**Permisos**: ya existe `editor.access` («Usar el editor»): subir, lanzar,
revisar y descargar. Solo ve las galerías que ya puede ver (si la tarjeta no
es suya con «solo asignados», no la ve).

**Fuera de la primera versión**: el plugin de Lightroom (fase 2), aprender el
encuadre del catálogo, editar color o piel, elegir otros modelos, cobrar a
otros estudios.

## Cómo se conecta con lo que ya hay

- **Galerías**: el editor parte de `galleries` (estado `submitted`) y de
  `gallery_photos` con `picked_at`. Las fotos de la galería (200 KB con marca
  de agua) no sirven para editar: por eso se suben los originales.
- **Tarjetas**: el trabajo cuelga de la tarjeta de la galería (misma
  visibilidad y permisos) y deja actividad en ella.
- **R2**: mismo bucket, otra carpeta: `editor/<studio_id>/<job_id>/<photo_id>/`
  (`original.jpg`, `result.jpg`, `preview.jpg`, `zones.jpg`). Al borrar
  trabajos, galerías, tarjetas, tableros o clientes, las claves van a
  `storage_deletions` como ya pasa con Galerías; la tarea diaria pendiente de
  Galerías barre también las del editor (se hace una vez para los dos).
- **Base de datos** (con las reglas de siempre: RLS, permisos, claves
  compuestas por estudio):
  - `edit_jobs`: estudio, galería, tarjeta, estado, ajustes usados (copia),
    quién lo lanzó, coste total, fechas.
  - `edit_photos`: trabajo, foto de la galería, nombre, estado, intentos,
    nota del estudio, nota y comentario del revisor, encuadre, coste, tiempos.
  - `studios`: los ajustes del editor.

## Dónde se procesa (decidido: Cloudflare)

El usuario no quiere sumar plataformas: todo va en la **cuenta de Cloudflare
que ya tiene R2** (plan Workers de pago, $5 al mes). Vercel sigue con la app;
para el montaje a 40 MP se queda corto (2 GB y sin cola de verdad en su plan).

- **Worker `uphotox-editor`** (`services/editor/src/index.ts`): recibe cada
  foto de la app (con un token), la pone en una **cola** (Cloudflare Queues)
  y, al sacarla, lee el original de R2, se lo pasa a un **contenedor** y
  guarda en R2 lo que vuelve (`result.jpg`, `preview.jpg`, `zones.jpg`,
  `info.json`, `status.json`). Reintenta si el contenedor no responde.
- **Contenedor «motor»** (`services/editor/engine/`, Docker, 2 vCPU y 8 GB):
  el proceso de la prueba en Node (sharp + recorte MODNet), dos fotos a la
  vez por contenedor y hasta 4 contenedores. No tiene claves de R2: solo las
  de las IAs. Reintenta la edición si la API falla o la IA mueve el
  encuadre.
- **Despliegue** con Workers Builds: Cloudflare construye el contenedor
  desde GitHub en cada cambio de `services/editor` (en este PC no hay Docker).
- `tools/fondo-lab` usa el mismo motor para experimentar con varios modelos.
- Alternativa para más adelante: un motor en el PC del estudio junto al
  plugin, que solo mandaría a la nube la copia de 2048 px.

## Costes estimados (30 fotos elegidas)

| Concepto | Por foto | Por sesión (30) |
| --- | --- | --- |
| GPT Image 2 (alta) | ~$0,18 | ~$5,40 |
| Gemini (análisis, zonas, revisión, encuadre) | ~$0,02 | ~$0,60 |
| Reintentos (estimado +15 %) | — | ~$0,90 |
| Cloudflare (Workers de pago, cola y contenedores) | — | $5 al mes fijos; incluye de sobra para el estudio |
| R2 (fotos guardadas 30 días) | — | céntimos |
| **Total** | | **~$7 por sesión** |

Tiempo: ~70 s por foto en GPT; con 5–6 a la vez, 30 fotos en ~8–10 minutos
(OpenAI limita imágenes por minuto según el nivel de la cuenta). Subida: unos
600 MB por sesión (a 20 Mbps, ~4 minutos); bajada parecida.

A tener en cuenta para venderlo: el plan Hobby de Vercel es para uso no
comercial (Pro cuesta ~$20 al mes), y cada estudio debería avisar a sus
clientes de que sus fotos pasan por servicios de IA (cláusula en el contrato;
las APIs de pago no entrenan con ellas).

## Fases

1. **Motor y servicio en Cloudflare** (hecho, falta desplegar): motor con el
   proceso de la prueba (fondo completo, manos de ayuda, caras, reintentos,
   conserva EXIF y perfil de color), Worker con cola y contenedor, y una foto
   de punta a punta con `npm run try` en `services/editor`.
2. **Datos y subida**: tablas, permisos, R2, pantalla «Limpiar fondos» en la
   galería con emparejado por nombre, cola y progreso en vivo.
3. **Revisión y descarga**: cuadrícula antes/después, aprobar, rehacer con
   nota, descartar, descargar a una carpeta, aviso por correo, ajustes del
   editor, límite de gasto y borrado automático.
4. **Prueba real** con una sesión completa del estudio y ajustes; versión
   publicada.
5. **Plugin de Lightroom Classic**: «Marcar las elegidas por el cliente»
   (sustituye copiar los nombres al filtro), «Limpiar fondos de las
   seleccionadas» (exporta, sube, espera, descarga e importa apiladas junto a
   la original) y el encuadre como ajuste de recorte de Lightroom (movible).
   Más adelante, aprender el encuadre de los recortes que el estudio ya tiene
   en su catálogo.

## Lo que necesito del usuario

- **Aprobar el plan** (o cambiar el orden: por ejemplo, plugin antes que la
  pantalla web).
- **Cloudflare**: activar el plan Workers de pago, conectar el repositorio con
  Workers Builds y poner tres secretos (pasos en `services/editor/README.md`).
- **OpenAI**: mirar el nivel de la cuenta (límites de imágenes por minuto).
