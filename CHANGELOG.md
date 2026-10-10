# Versiones de Uphotox

Cada versión publicada en producción (https://uphotox-app.vercel.app) tiene
aquí su entrada y una etiqueta en Git (`vX.Y.Z`). El detalle de cada tarea está
en `docs/bitacora.md`.

Numeración: el primer número cambia con cambios grandes que rompen la forma de
trabajar, el segundo con funciones nuevas y el tercero con arreglos.

## [0.2.0] · 10 oct 2026 · Marca

**Añadido**
- Logo de Uphotox junto al nombre en el menú lateral y en el login (con versión
  para el modo oscuro).
- Icono en la pestaña del navegador, al añadir la app a la pantalla de inicio
  del iPhone y para instalarla en Android.
- Imagen, título y descripción al compartir el enlace (WhatsApp, Instagram,
  Google): «Uphotox · Gestiona tu estudio de fotografía».
- Archivos maestros de la marca y guía en `docs/brand/`.

**Cambiado**
- La app declara el idioma español (antes decía inglés).
- La API usa el mismo icono e imagen de compartir.

**Corregido**
- Al compartir el enlace no salía ninguna imagen y el texto era el del login.

## [0.1.0] · 8 oct 2026 · Primera versión publicada

- Tableros tipo Trello: etapas, arrastrar o «Mover a…» (también en el móvil),
  foto de la tarjeta, avisos automáticos por correo con botón de WhatsApp,
  historial.
- Clientes: lista, búsqueda, ficha e importación de CSV.
- Equipo con roles y permisos por usuario; ajustes del estudio.
- Entrada de clientes por webhook (Typeform vía Make).
- Publicada en Vercel: app y API, con publicación automática al subir a GitHub.
