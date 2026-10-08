# Uphotox — sistema de interfaz

Dirección: **"Mesa de luz"**. El HUD cyberpunk del template Tokyo Store
(`template tokyo store/`) llevado a claro: el panel de neón deja de flotar sobre
negro y pasa a flotar sobre la mesa de luz de un fotógrafo. Brillante, preciso,
técnico; acentos con energía sobre superficies tranquilas. El cian y el magenta
del original son las tintas CMY de impresión.

Persona: dueño/a o miembro de un estudio fotográfico, en su escritorio entre
sesiones, organizando proyectos y editando. La interfaz es su herramienta diaria:
los efectos ambientales van suaves donde se trabaja y completos donde se entra.

## Tokens (packages/design-system/styles/globals.css)

| Token | Uso | Regla |
| --- | --- | --- |
| `lightbox` | Fondo (blanco frío) | `bg-background` |
| `ink` | Texto principal (azul marino) | `text-foreground` |
| `signal` | Cian de acción: rellenos, estados activos, glow | **Nunca como color de texto en claro** |
| `signal-ink` | Cian legible como texto/iconos (AA sobre blanco) | `text-signal-ink` |
| `flare` | Violeta secundario: botón secundario, acento puntual | Con moderación |
| `bloom` | Magenta | Solo atmósfera y glitch |
| `field` | Fondo de inputs (un punto más oscuro que el panel) | `bg-field` |
| `glow` / `glow-soft` | Halo cian | Sombras de interacción |
| `grid-line` / `grid-line-coarse` | Retícula 48px cian + 240px violeta | `bg-hud-grid` |

Los tokens de shadcn apuntan a estos (`primary` = `signal`, `ring` = `signal-ink`…).
Oscuro (`.dark`) = Tokyo original con los mismos nombres. Tema por defecto: claro.

Distribución: ~60 % superficie clara, ~30 % tinta/grises, ~10 % cian. Un solo
acento principal (signal); flare solo para lo secundario.

## Profundidad, forma y espaciado

- **Profundidad: solo bordes** (`border-border`, tinta al 10 %). El glow cian se
  reserva para interacción y énfasis, nunca como sombra decorativa permanente.
- **Radio**: `--radius: 0.25rem` → sm 0 · md 2px · lg 4px · xl 8px. HUD, casi recto.
- **Esquinas recortadas**: `corner-notch` (`--notch`, por defecto 12px; Panel usa
  14px) en arriba-derecha y abajo-izquierda. Mejora progresiva con `corner-shape`;
  sin soporte quedan rectas.
- **Paralelogramo**: forma de los botones, hecha con `::before` + `skewX(-18deg)`.
  No usar `clip-path` en nada que necesite glow o anillo de foco (lo recorta).
- **Base de espaciado 4px.** Página `px-4 md:px-10`, entre secciones `gap-12`,
  rejillas `gap-5`, tarjetas `p-4`, formularios en panel `p-8`.

## Tipografía y jerarquía

- **Geist Mono** = capa HUD: títulos display, etiquetas, botones, navegación, números.
- **Geist Sans** = contenido: párrafos, descripciones, valores de inputs.
- Título de página: mono black, mayúsculas, `text-4xl md:text-5xl`, `tracking-[-0.02em]`;
  el dato clave (nombre) en `text-signal-ink text-glow`.
- Etiqueta de sección: `HudLabel` — mono 10px, mayúsculas, `tracking-[0.3em]`, signal-ink.
- Label de formulario: mono 11px semibold, mayúsculas, `tracking-[0.16em]`, muted.
- Números dinámicos: `tabular` y con ceros a la izquierda (`03 ACTIVOS`, `P-01`).
- Ornamento de marca: 写真 ("fotografía") encima del nombre, como 東京 en Tokyo.
- Texto de la interfaz en **español**.

## Componentes

Primitivas HUD en `packages/design-system/components/hud/`:

| Componente | Medidas / comportamiento |
| --- | --- |
| `Button` (ui) | h-9 · px-5 · mono 12px bold mayúsculas `tracking-[0.14em]` · paralelogramo. `default` relleno signal + texto ink + glow al hover · `outline` texto signal-ink, fondo signal/8, borde signal-ink/35 · `secondary` igual en flare · `ghost`/`link` sin paralelogramo · sm h-8 px-4 11px · lg h-11 px-7 13px · press `scale(0.97)` |
| `Input`/`Textarea` (ui) | h-9 · `bg-field` · radio md · foco: borde signal-ink/60, fondo blanco, halo `0 0 0 3px glow-soft` |
| `Panel` | Vidrio `bg-card` (blanco 78 %) + `backdrop-blur-md`, borde, esquinas recortadas 14px. `interactive`: sube 4px, borde signal-ink/40, glow, línea de escaneo 2.4s. `stream`: barra data-stream arriba |
| `StudioBackdrop` | `full` solo en login y landing (atmósfera, orbes, 50 partículas, escaneo 3.2s, textura CRT). `calm` dentro de la app: **solo la retícula estática** con desvanecido en los bordes. Va dentro de un contenedor `relative isolate` |
| `CropMarks` | Esquinas de visor; **firma visual**. Marco de la zona de trabajo (`inset-3`), tarjetas (`size-3`), panel de marca (`size-8`) |
| `Wordmark` | UPHO + TOX (signal-ink con glow). sm/md/xl, `glitch`, `kanji` |
| `HudLabel` | `── LABEL ──` (center) o etiqueta + línea (start) |
| `ScanLine` | Barrido animando solo transform |

Patrones de la app:
- **Shell**: sidebar `inset`; el `SidebarInset` es la mesa de luz (`StudioBackdrop calm`
  = retícula estática + `CropMarks inset-3`, sombra de anillo con el borde).
- **Navegación**: etiquetas de grupo mono 10px `tracking-[0.3em]` signal-ink/80;
  ítem activo con raíl `inset 2px` signal-ink; módulos aún no construidos sin URL,
  deshabilitados y con badge "PRONTO".
- **Tarjeta de proyecto**: Panel interactivo, cabecera `aspect-[16/7]` con degradado
  de una de las tres tintas (signal/flare/bloom, rotando), retícula, CropMarks e
  índice `P-01`; cuerpo con nombre mono bold.
- **Estado vacío**: Panel con borde discontinuo, icono, título mono tracked, CTA si el rol puede actuar.
- **Embudo de tablero** (`BoardPipeline`): Panel interactivo a ancho completo; una fila
  `grid-flow-col auto-cols-[minmax(6.5rem,1fr)]` de celdas separadas por `gap-px bg-border`;
  número mono black `text-xl` (signal-ink si > 0, muted/50 si 0) + nombre de etapa mono 10px
  en 2 líneas. Nunca partir el embudo en varias filas.
- **Kanban**: columna `w-72` `bg-secondary/90` con borde, cabecera sticky (índice `01`
  signal-ink, nombre mono bold 11px, icono de correo si avisa al cliente, contador, ajustes).
  Tarjeta `bg-popover` borde + `corner-notch` 8px, título sans 14px medium, cliente muted
  12px, meta mono 10px (fecha, enlace, «sin correo» en flare, días en etapa, iniciales del
  responsable). Arrastrando: `rotate-2` + anillo signal + glow. Sin hover-lift ni escaneo
  (uso repetido). **Ningún ancestro de un draggable puede tener transform, filter ni
  backdrop-filter** (rompe el `position: fixed` del arrastre), y un solo contenedor de
  scroll para todo el tablero.
- **Kanban en móvil (< md)**: nada depende de arrastrar. Barra de pestañas de etapas
  (chips con índice, nombre y contador; la activa en signal/15 con borde signal-ink) y una
  sola columna a ancho completo. Cada tarjeta tiene el botón ⇄ «Mover a…» (siempre visible
  en móvil, al pasar el ratón en escritorio) y el panel de detalle un select «Etapa». Al
  mover, el aviso ofrece «Ver etapa».
- **Foto de tarjeta**: miniatura `aspect-[16/9] object-cover` arriba de la tarjeta (como
  portada), comprimida en el navegador a ≤ 640 px WebP. Recuadro discontinuo «Añadir foto»
  cuando no hay.
- **Panel lateral de detalle** (Sheet derecha, `sm:max-w-lg`/`xl`): cabecera con borde,
  secciones con etiqueta mono 10px `tracking-[0.3em]` signal-ink, sin autofoco al abrir.
  Lo que se aplica al instante (etapa, foto) va en una sección propia sobre el formulario.
- **Permisos tipo GHL**: un bloque por grupo (switch del grupo = alguno activo, contador
  `x/y` mono), permisos individuales con switch indentados `pl-14`; interruptor
  «Solo datos asignados» en caja con borde y explicación.
- **Lista de clientes**: `ul divide-y border bg-card` como Equipo; fila = iniciales (solo
  letras) + nombre/contacto + a la derecha la sesión destacada (la próxima, o la última) con
  fecha corta y etapa en signal-ink. Orden con chips (`Próxima sesión` por defecto,
  `Recientes`, `A–Z`), mismo estilo que las pestañas del kanban móvil. La búsqueda ignora
  acentos y encuentra por nombre, correo, dígitos del teléfono y títulos de tarjeta (niño/a).
- **Ficha de cliente** (Sheet derecha): botones de contacto (WhatsApp solo si el número
  trae código de país, Llamar, Correo), sesiones como tarjetas `corner-notch` con «Abrir»
  (`/tableros/<id>?tarjeta=<id>`), formulario de datos y Eliminar (borra también sus tarjetas).
- **Asistente de importación**: pasos numerados (`01 Archivo`, `02 Columnas`, `03 Revisión y
  destino`), título mono bold con el índice en signal-ink. Zona de archivo = botón con borde
  discontinuo que acepta arrastrar. Cada columna: cabecera + 3 valores de ejemplo + select de
  destino; las columnas clave llevan el raíl `inset 2px` signal-ink. Revisión: chips de filtro
  (`Todas`, `Revisar`, `Se omiten`) y filas con estado `Lista` (signal-ink), `Revisar`
  (flare) o `Se omite` (tachada, motivo en destructive). Resultado en un Panel con borde
  signal-ink/30, sin animación.
- **Chips de estado** (`Correos activos`, `Ves solo tus tarjetas`): borde, mono 10px
  mayúsculas `tracking-[0.16em]`; signal-ink = activo, flare = requiere atención.

## Movimiento

- Curva `ease-snap` = `cubic-bezier(0.23, 1, 0.32, 1)`. Nunca `ease-in` para entradas.
- Entrada: `animate-fade-in-up` (550ms, sube 24px), escalonado 60ms, máximo 12 elementos.
- Hover de superficies 300ms; botones 150–200ms.
- **Bucles ambientales (orbes, línea de escaneo, partículas, glitch) solo en login
  y landing.** Dentro de los módulos nada se mueve solo: retícula estática, y el
  movimiento únicamente como respuesta a la interacción (hover, entrada de la
  página). Decisión del usuario: en el día a día "está muy cargado".
- Todo bucle ambiental se desactiva con `prefers-reduced-motion`.
- Animar solo `transform` y `opacity`. Nada de `Math.random()` en render: usar el
  PRNG con semilla de `backdrop.tsx` (si no, falla la hidratación).
- Acciones muy repetidas (atajos, menús del tablero) sin animación decorativa.
