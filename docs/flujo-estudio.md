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
| 2 Agenda | Fecha de sesión en la tarjeta (sin Google Calendar todavía). |
| 3 Preparación | Correo de etapa al cliente; botón de WhatsApp del estudio en cada correo. |
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
tarjeta, uso en móvil sin arrastrar.

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

### 3. Galería de selección propia (sustituir Pixieset)
- Subir las previsualizaciones con marca de agua a Uphotox; el cliente abre un
  enlace privado y marca favoritas con un límite según su paquete, con opción
  de comprar extras.
- Al confirmar: la tarjeta pasa sola a «Escogidas» y se genera la **lista de
  nombres de archivo** para Lightroom (por verificar el mejor formato para el
  filtro de texto de Lightroom Classic).
- **Plugin de Lightroom Classic** (SDK en Lua): importar esa lista y crear una
  colección con las elegidas, sin copiar números a mano.

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

### 5. IA en la edición
- Aprender el estilo del estudio a partir de ediciones anteriores y aplicarlo
  a las escogidas (perfiles tipo Imagen AI), con revisión humana; o generar
  ajustes/presets por foto.
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

## Datos que conviene guardar ya (para la IA)
- Qué fotos preselecciona el estudio y cuáles elige el cliente (señal de
  calidad y de gusto).
- Antes y después de la edición final (para aprender el estilo).

## Preguntas abiertas
- Paquetes: cuántas fotos incluye cada uno y precio de los extras.
- Dónde se guardan los RAW/DNG (disco, NAS, nube) y cuánto ocupan por sesión.
- Sesiones al mes (dimensiona almacenamiento y coste de IA).
- ¿Los editores externos tendrán usuario en Uphotox?
- Criterios de selección del estudio (base para la IA de preselección).
