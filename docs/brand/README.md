# Marca de Uphotox

Logo e iconos (octubre 2026). Los originales los generó el usuario con IA; aquí
están ya sin fondo y ajustados a los colores exactos de la marca.

## Archivos maestros (esta carpeta)

| Archivo | Qué es | Uso |
| --- | --- | --- |
| `logo-symbol.png` | Símbolo sin fondo (corchetes de visor + «U» con diafragma + punto violeta), 1016×765 | Base para cualquier pieza nueva (redes, presentaciones…) |
| `app-icon.png` | Icono de app: el símbolo sobre un cuadro azul marino redondeado, sin fondo, 1123×1123 | Base para iconos de tiendas, perfiles, etc. |
| `og.png` | Imagen para compartir enlaces, 1200×630 | Versión sin comprimir de `og.jpg` |

## Dónde está cada cosa en la app

| Archivo | Para qué |
| --- | --- |
| `apps/app/app/icon.png` (512×512, sin fondo) | Icono de la pestaña del navegador (favicon) |
| `apps/app/app/apple-icon.png` (180×180, opaco) | Icono al añadir la app a la pantalla de inicio del iPhone (iOS redondea las esquinas solo) |
| `apps/app/app/manifest.ts` + `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Instalar la app en Android / Chrome; el «maskable» deja margen para que Android lo recorte en círculo o cuadro |
| `public/brand/logo-symbol.png` y `logo-symbol-dark.png` | Símbolo junto al nombre UPHOTOX en el menú y el login (`components/brand-logo.tsx`); el «dark» tiene los corchetes blancos para el modo oscuro |
| `public/brand/og.jpg` (65 KB) | Imagen que sale al compartir el enlace en WhatsApp, Instagram, Google… (WhatsApp no la muestra si pesa más de ~300 KB) |
| `apps/app/lib/metadata.ts` | Título y descripción que salen al compartir el enlace |
| `apps/api/app/icon.png`, `apple-icon.png`, `opengraph-image.jpg` | Lo mismo para la API |

Los correos a los clientes **no** llevan el logo de Uphotox a propósito: van con
el nombre del estudio, que es la marca que conoce el cliente.

## Colores

| Nombre | Hex | Dónde |
| --- | --- | --- |
| Azul marino (ink) | `#101b2b` | Corchetes, fondo del icono, textos |
| Cian (signal) | `#13e1f2` | La «U», botones |
| Cian oscuro (signal-ink) | `#006f8c` | «TOX» del nombre, textos en cian sobre blanco |
| Violeta (flare) | `#7b3de9` | El punto (luz de grabación), acentos |
| Mesa de luz (fondo) | `#f5fafc` | Fondo de la app |

Tipografías: **Geist Mono** (nombre UPHOTOX, etiquetas) y **Geist** (textos).
Sin caracteres chinos ni japoneses.

## Textos para compartir el enlace

- Título: «Uphotox · Gestiona tu estudio de fotografía»
- Descripción: «Lleva cada sesión de tu estudio en un tablero: clientes, etapas,
  avisos automáticos por correo y WhatsApp, y entregas en un solo lugar.»
- Lema: «Encuadra. Edita. Entrega.»

## Si se cambia el logo

Pasar las dos imágenes nuevas (icono con fondo y símbolo sobre blanco): se
quita el fondo, se ajustan los colores y se regeneran todos los tamaños y la
imagen de compartir, como en la v0.2.0. Después, WhatsApp puede tardar en
mostrar la imagen nueva porque guarda en caché las vistas previas.
