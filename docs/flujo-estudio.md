# Flujo del estudio y hoja de ruta de automatización

Documento vivo. Recoge cómo trabaja hoy el estudio para el que se construye
Uphotox (caso real, octubre 2026) y qué se puede automatizar, con o sin IA.
Sirve de referencia para priorizar módulos. Lo marcado «por verificar» no
está comprobado todavía.

## Personas que intervienen

| Persona | Qué hace | Rol en Uphotox |
| --- | --- | --- |
| Dueña | Revisa y retoca la edición final, entrega, decide | Owner |
| Comercial | Atiende la reserva, propone fecha, agenda | Assistant |
| Fotógrafa | Coordina con el cliente, hace la sesión, vuelca las tarjetas | Photographer |
| Quien escoge | Preselecciona las mejores fotos y hace ajustes básicos | Editor (o Photographer) |
| Editores externos | Editan las fotos escogidas (fuera del país) | Editor con «solo asignados» (por decidir) |
| Cliente | Reserva, elige favoritas, recibe el álbum | No entra a la app (recibe correos) |

## Flujo actual, paso a paso

1. **Solicitud.** Se envía un Typeform al cliente; al llenarlo, el estudio
   recibe un correo de Typeform.
2. **Agenda.** La comercial escribe al cliente, busca una fecha libre, se la
   propone y la agenda **a mano** en Google Calendar copiando las respuestas
   del Typeform.
3. **Preparación.** Cerca de la sesión, la fotógrafa escribe al cliente
   (WhatsApp) para acordar ropa, accesorios y escenografía.
4. **Sesión y pago.** Se hace la sesión; el cliente paga ese mismo día al
   terminar.
5. **Volcado.** La fotógrafa copia las tarjetas de la cámara al PC (cuando se
   acuerda).
6. **Preselección.** Una persona escoge las mejores según criterios del
   estudio, hace ajustes básicos en Lightroom y exporta en baja calidad con
   marca de agua.
7. **Galería de selección.** Se suben a Pixieset (comprimidas). El cliente
   marca favoritas con corazones según su paquete; a veces compra extras.
8. **Aviso de selección.** El cliente le dice a la fotógrafa que ya eligió.
9. **Filtrado.** La fotógrafa copia los números de las fotos elegidas y las
   filtra en Lightroom.
10. **Edición (≈ 1 mes).** Se envían a editores fuera del país, por Google
    Fotos o WhatsApp, los DNG exportados de Lightroom (comprimidos).
11. **Vuelta.** El editor devuelve las fotos (subida o WhatsApp).
12. **Revisión.** La dueña las revisa en Lightroom y da los toques finales.
13. **Entrega.** Las sube a un álbum de Google Fotos y envía el enlace al
    cliente.

## Cómo encaja hoy en Uphotox

| Paso | Hoy en Uphotox |
| --- | --- |
| 1 Solicitud | Typeform → Make → webhook de Uphotox: crea cliente y tarjeta con todas las respuestas en las notas (Ajustes → Entrada de clientes). No envía correo al cliente. |
| 2 Agenda | Fecha de sesión en la tarjeta (sin Google Calendar todavía). Los clientes que ya estaban agendados antes de Uphotox se cargan con **Clientes → Importar CSV** directamente en «Agendado». |
| 3 Preparación | Correo de etapa al cliente; botón de WhatsApp del estudio en cada correo. |
| 6–9 | **Galerías** (sin publicar): se suben los JPG de Lightroom a la tarjeta, «Enviar al cliente» le manda el enlace, el cliente elige con corazones (guía la primera vez, extras a $20) y confirma; la tarjeta pasa sola a «Escogidas», llega aviso al estudio y «Copiar para Lightroom» da la lista de nombres para filtrar. |
| 4–13 | Etapas del tablero «Sesiones» con aviso al cliente en cada una; responsable por tarjeta; foto de la tarjeta (miniatura); álbum de Google Fotos en «Álbum de entrega». |

**Recomendación de etapas.** La tarjeta llega del Typeform *antes* de
acordar fecha, y el correo por defecto de «Agendado» dice «¡Tu sesión está
confirmada!». Conviene añadir una etapa **«Solicitud recibida»** antes de
«Agendado», sin aviso al cliente, y apuntar ahí el webhook. La comercial la
pasa a «Agendado» cuando cierra la fecha (y entonces sí sale el correo).

## Fricciones detectadas

- **Doble tecleo**: respuestas de Typeform copiadas a mano en Calendar.
- **Depende de la memoria**: volcar tarjetas, escribir al cliente antes de la
  sesión, saber qué toca después.
- **Números de Pixieset → Lightroom** a mano (lento y propenso a errores).
- **Envío a editores por WhatsApp / Google Fotos**: compresión, archivos
  perdidos, sin seguimiento de plazos.
- **Plazos invisibles**: ya se ve «días en esta etapa» en cada tarjeta; falta
  alertar cuando algo se atasca.
- **Pagos y paquetes** fuera del sistema (cuántas fotos incluye, extras).

## Hoja de ruta propuesta

Cada fase es independiente; el orden es una propuesta.

### Hecho (octubre 2026)
Tableros con etapas y avisos por correo, equipo con roles y permisos, WhatsApp
del estudio en los correos, entrada de clientes por webhook (Make), foto de la
tarjeta, uso en móvil sin arrastrar. Módulo **Clientes**: lista con búsqueda
(también por el nombre del niño/a), ficha con sus sesiones y botones de
WhatsApp/llamar, e importación de CSV con revisión fila a fila (sin correos,
sin duplicados al repetir la importación).

### 1. Agenda con Google Calendar
- Conectar la cuenta de Google del estudio (OAuth) y crear/actualizar el
  evento al fijar la fecha en la tarjeta, con los datos del cliente y las
  respuestas del formulario en la descripción.
- Ver disponibilidad al proponer fecha.

### 2. Recordatorios al cliente
- Paso barato: botón «Escribir al cliente» en la tarjeta que abre WhatsApp con
  un mensaje ya escrito según la etapa (sin API).
- Paso completo: WhatsApp Business Cloud API con plantillas aprobadas (p. ej.
  3 días antes: «coordinemos vestuario»). Requiere número de empresa
  verificado; coste por conversación.

### 3. Galería de selección propia (sustituir Pixieset) — hecha en local (13 oct), falta el borrado automático y publicarla
Módulo **Galerías** (menú propio; «Editor» queda para la edición). Decidido
con el usuario el 13 oct 2026:
- Hoy: Pixieset a $10/mes (10 GB), solo para galerías (y una web del estudio
  desactualizada, que se pierde al cancelarlo).
- Se suben las fotos tal como salen de Lightroom: 100–200 por sesión, ~200 KB
  cada una, con la marca de agua de Lightroom y el **nombre original**
  (IMG_1234.jpg). Uphotox solo hace la miniatura.
- El cliente abre un enlace privado (sin cuenta), marca favoritas y confirma.
  Puede pasar del paquete: cada extra cuesta **$20** (ajuste del estudio); el
  cobro va fuera de Uphotox.
- Al enviar, la tarjeta pasa a «Enviadas para escoger» y al confirmar a
  «Escogidas» (etapas configurables por tablero); la dueña y el responsable
  reciben aviso.
- **Lista para Lightroom**: nombres sin extensión separados por comas
  (`IMG_0012, IMG_0045`), para Biblioteca → Filtro de texto → Nombre de archivo
  → Contiene. Así encuentra el RAW/DNG del catálogo.
- Plazos: el enlace caduca a los 60 días sin elegir; las fotos se borran 60
  días después de confirmar o caducar. Se guarda qué se preseleccionó y qué
  eligió el cliente (dato para la IA).
- Fotos en **Cloudflare R2** ($0/mes con este volumen; guía en
  `docs/cloudflare-r2.md`). Descartados: Supabase Storage (1 GB gratis no
  alcanza; Pro $25/mes), Google Drive (desde 2024 no sirve imágenes a otras
  webs y dependería de la cuenta de Google) y Amazon Photos (sin API).
- Después: **plugin de Lightroom Classic** (SDK en Lua) que cree una colección
  con las elegidas, y galería de **entrega** en alta calidad.

### 4. IA en la preselección (culling)
- Descartar automáticamente: desenfocadas, ojos cerrados, duplicados y
  ráfagas, exposición fallida; puntuar el resto y proponer las N mejores para
  revisión humana.
- Opciones: servicios existentes (Aftershoot, Imagen, FilterPixel, Narrative
  Select — por evaluar) o un proceso propio (nitidez, detección de caras y
  ojos, hash perceptual para duplicados, puntuación estética con un modelo de
  visión).
- Decidir dónde corre: en el PC del estudio (los RAW pesan mucho) o en la nube
  (subida lenta, coste).

### 5. IA en la edición (módulo Editor) — en prueba
**Primera tarea elegida por el usuario (18 oct 2026): limpiar el fondo y el
suelo sin tocar a las personas** (quitar franjas de otro fondo, focos, pies de
luz, huecos; suavizar arrugas, costuras, manchas y brillos). Se vende después
con Uphotox. Lightroom Classic; hoy la limpieza va después del color, pero
puede ir antes.
- **Regla clave:** la IA nunca entrega a las personas. Se recortan con un
  modelo local (MODNet; BiRefNet en servidor), la IA trabaja sobre una copia
  de 2048 px y el montaje a resolución completa (40 MP) solo usa píxeles de la
  IA en las zonas de problemas; personas y decorados se quedan originales.
- **Agentes:** analista (qué arreglar y qué respetar) → localizador
  (recuadros, «quitar» o «suavizar») → editor (varios modelos, del barato al
  caro) → montaje (código, sin IA) → revisor (nota y fallos) → aprobación
  humana.
- **Modelos probados:** Nano Banana 2 (~$0,10), Nano Banana Pro (~$0,14) y
  GPT Image 2 alta (~$0,18) por foto, más ~$0,01 de análisis y revisión.
  Gemini mantiene el encuadre; GPT Image 2 lo mueve un 1–2 % (hay que
  alinearlo).
- **Prueba de concepto:** `tools/fondo-lab` (informe para votar a ciegas en
  la carpeta de fotos). Siguiente paso: votos del estudio → elegir modelos →
  módulo en Uphotox con cola en paralelo y revisión antes/después → plugin de
  Lightroom Classic para enviar y traer las fotos apiladas.
- Más adelante: aprender el estilo del estudio a partir de ediciones
  anteriores y aplicarlo a las escogidas (perfiles tipo Imagen AI), con
  revisión humana; o generar ajustes/presets por foto.
- Objetivo realista: reducir el mes de espera o dar al editor externo un punto
  de partida. Mientras tanto, los editores externos pueden ser usuarios
  «Editor» con «solo asignados» para seguir plazos en el tablero.

### 6. Entrega
- Google Fotos: desde el 31-03-2025 la API permite crear álbumes y subir fotos
  creadas por la app, **pero ya no permite compartir álbumes**; la dueña sigue
  compartiendo el álbum y pegando el enlace en la tarjeta.
- Alternativa: galería de entrega propia en Uphotox (descarga en alta
  calidad). Implica coste de almacenamiento.

### 7. Paquetes y pagos (cuando se pida)
Paquete contratado, fotos incluidas, extras y estado del pago en la tarjeta.

## Qué recoge hoy el formulario de reserva (Typeform)

Análisis de la exportación a Google Sheets (respuestas desde finales de 2023
hasta octubre de 2026). Sirve para la integración con Make, el módulo de
paquetes y las automatizaciones.

**Lo que usa Uphotox** (entrada por Make o importación):

| Dato | Columna del formulario | En Uphotox |
| --- | --- | --- |
| Cliente | «Cuál es su nombre?» (en bodas, «Nombre de la novia») | Nombre del cliente |
| Teléfono | «Cual es su número de teléfono?» (ya viene con +código) | Teléfono; botón de WhatsApp |
| Correo | «Déjanos tu correo…» (bodas: «Cual es tu email») | Correo (avisos) |
| Niño/a | «Cual es el nombre del niño/a?» | Título: «Mateo · Smash Cake» |
| Tipo de sesión | «Qué tipo de sesión fotográfica desea?» | Título |
| ID de respuesta | «Token» | `external_id` (evita duplicados) |
| Resto | formato, paquete, extras, lugar, edad, cumpleaños, semanas de embarazo, artículo de regalo, dudas | Notas: «• Pregunta: respuesta» |

Se ignoran «Submitted At» (fecha de la solicitud, no de la sesión), las
casillas de aceptación (TRUE) y las columnas ocultas `name`/`email`, que
siempre llegan vacías.

**Observaciones:**
- **La fecha de la sesión no está en el formulario**: solo existe en Google
  Calendar. Por eso los clientes ya agendados se importan desde otra hoja que
  sí la tenga, y a partir de ahora la fecha se pone en la tarjeta.
- **Tipos de sesión**: Niños y familia (la mayoría), Smash Cake, Embarazadas,
  Recién nacidos, Navidad, Día de las madres, San Valentín, Retratos/Headshots y
  algunas bodas (casi todas de prueba).
- **Paquetes**: hay una columna «Qué oferta desea?» por tipo y formato
  (digital o impreso), y el texto empieza por el precio («$345 - 12 FOTOS…»).
  Los precios han subido varias veces en 2026 (p. ej. 12 fotos digitales de
  niños: $250 → $285 → $315 → $345). Extras: decoración Smash Cake $200, Milk
  Bath $100 y maquillaje $180. Base para el módulo de paquetes.
- **Calidad de los datos**: muchas personas envían el formulario varias veces
  (cambian de paquete o de fecha); hay filas de prueba; algunos correos traen
  errores de dominio (gamil.com, gmial.com, .con), y el importador los corrige
  y lo avisa; a veces ponen el nombre del niño como nombre propio o dos niños
  en el mismo campo.
- **Cumpleaños del niño/a**: se pide, pero en texto libre («18 enero», «01/24»,
  «Marzo 6», «No es ahora»). Si en Typeform pasa a ser un campo de fecha, se
  podría avisar al cliente antes del siguiente cumpleaños (el negocio fuerte es
  el primer año / Smash Cake).
- **Dudas frecuentes** («¿Alguna duda?»): maquillaje y peinado, si el estudio
  pone la ropa, fechas disponibles, dirección, depósito y cancelación,
  ampliaciones, mascotas o abuelos en las fotos. Candidatas a respuestas
  automáticas o a una página de preguntas frecuentes enlazada desde el aviso.
- **Artículos de regalo** (lienzo, acrílico, taza, cojín, bola de nieve): señal
  de venta adicional que hoy se pierde en las respuestas.

## Datos que conviene guardar ya (para la IA)
- Qué fotos preselecciona el estudio y cuáles elige el cliente (señal de
  calidad y de gusto).
- Antes y después de la edición final (para aprender el estilo).

## Preguntas abiertas
- Paquetes: cuántas fotos incluye cada uno (el extra ya está decidido: $20).
- Dónde se guardan los RAW/DNG (disco, NAS, nube) y cuánto ocupan por sesión.
  Idea: Google Drive (la cuenta tiene ~2 TB) para mandar los DNG a los
  editores externos y para la entrega final.
- Sesiones al mes (dimensiona el coste de IA; para las galerías ya no hace
  falta: R2 gratis aguanta más de 100 sesiones al mes).
- ¿Los editores externos tendrán usuario en Uphotox?
- Criterios de selección del estudio (base para la IA de preselección).
