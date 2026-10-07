# Template Tokyo Store — referencia visual

Material de referencia, **no se compila ni se importa**. Es el origen del estilo
de Uphotox: el HUD cyberpunk de Tokyo Store (export de Figma Make) llevado a una
versión clara ("mesa de luz"). Biome lo ignora (`biome.jsonc`).

Se borró todo lo que no aportaba al estilo: infraestructura de Vite/Firebase,
los ~50 componentes shadcn duplicados (ya viven en `packages/design-system`),
los datos de productos y el CSS compilado de Figma Sites (sus clases propias se
rescataron al final de `src/styles/globals.css`).

## Qué mirar y dónde quedó en Uphotox

| Referencia | Efecto | Implementación en Uphotox |
| --- | --- | --- |
| `src/styles/globals.css` | Keyframes y clases de efectos (Tokyo + SEN-NIN) | `packages/design-system/styles/globals.css` (sección "Efectos Tokyo" y "Utilidades HUD") |
| `CyberpunkBackground.tsx` | Atmósfera, orbes, retícula, partículas que suben, escaneo, viñeta | `components/hud/backdrop.tsx` → `<StudioBackdrop variant="full" \| "calm">` |
| `Hero.tsx` | Título con glitch, divisores `── LABEL ──`, esquinas de encuadre, botones paralelogramo | `hud/wordmark.tsx`, `hud/hud-label.tsx`, `hud/crop-marks.tsx`, `ui/button.tsx` |
| `ProductCard.tsx` / `ProductGrid.tsx` | Tarjeta con esquina recortada, hover que sube + glow + escaneo, entrada escalonada, filtros en píldora | `hud/panel.tsx` (`interactive`), `animate-fade-in-up` con delay; las píldoras de filtro servirán para el tablero |
| `AgeGate.tsx` | Modal con barra data-stream, retícula hex, esquinas cortadas | `<Panel stream>` en el login |
| `CartDrawer.tsx` | Drawer lateral con spring y lista animada | Pendiente: detalle de tarjeta del tablero |
| `HUDPanel.tsx` | Panel de vidrio con esquinas, barras con glow, puntos que pulsan | Pendiente: widgets del panel (`animate-pulse-dot` ya existe) |
| `Navbar.tsx` | Logo 東京 + nombre, enlaces mono con glow al pasar | Sidebar de la app |
| `App.tsx` | Composición: puerta de edad con desenfoque, toasts estilo HUD | — |
| `SEN-NIN DASH.html` | Maqueta de dashboard (tiles con data-stream, panel holográfico, log de terminal) | Ideas para el panel; requiere JS remoto de Figma para verse |

## Traducción oscuro → claro

| Tokyo (oscuro) | Uphotox (claro) | Token |
| --- | --- | --- |
| Negro `#000` | Blanco frío de mesa de luz | `--lightbox` |
| Blanco | Tinta azul marino | `--ink` |
| Cian neón `#00ffff` (relleno) | Cian brillante para rellenos | `--signal` |
| Cian neón (texto) | Cian oscuro legible (AA) | `--signal-ink` |
| Violeta `#c084fc` | Violeta | `--flare` |
| Rosa `#f472b6` | Magenta, solo atmósfera | `--bloom` |
| Glow con `text-shadow` | Texto en `signal-ink` + halo `signal` | `.text-glow` |

El modo oscuro de la app reproduce el Tokyo original con los mismos tokens.
