# Versiones de Uphotox

Cada versión publicada en producción (https://uphotox-app.vercel.app) tiene
aquí su entrada y una etiqueta en Git (`vX.Y.Z`). El detalle de cada tarea está
en `docs/bitacora.md`.

Numeración: el primer número cambia con cambios grandes que rompen la forma de
trabajar, el segundo con funciones nuevas y el tercero con arreglos.

## [0.4.1] · 18 oct 2026 · Correos de cuenta

**Corregido**
- El enlace para restablecer la contraseña y el de confirmar la cuenta ahora
  funcionan desde cualquier dispositivo o navegador (antes solo en el mismo
  donde se pidieron, y fallaban al abrirlos desde el móvil o la app de
  Gmail).
- Crear una cuenta con un correo que ya está registrado decía «Revisa tu
  correo», pero no llegaba nada. Ahora avisa de que ese correo ya tiene
  cuenta.

**Cambiado**
- Los correos de confirmar cuenta y de restablecer contraseña llegan en
  español y con la imagen de Uphotox (antes, en inglés).
- Los errores al entrar, crear cuenta o cambiar la contraseña salen en
  español (antes, p. ej., «Invalid login credentials»).

## [0.4.0] · 13 oct 2026 · Galerías de selección

**Añadido**
- Módulo **Galerías** (menú propio): sustituye a Pixieset para que el cliente
  elija sus fotos.
  - Desde la tarjeta del cliente, «Crear galería» y subir los JPG exportados
    de Lightroom (se guardan en Cloudflare R2; las repetidas se saltan).
  - «Enviar al cliente»: correo con «Elegir mis fotos», su paquete, el precio
    de cada foto extra ($20) y 60 días para elegir; la tarjeta pasa a
    «Enviadas para escoger». También «Copiar enlace» y WhatsApp.
  - Página del cliente sin cuenta: fotos enteras, corazones, vista ampliada,
    «Mis favoritas», contador con extras y «Confirmar» con comentario.
  - Guía de primera visita que resalta cada parte de la página y explica qué
    tocar (se puede volver a ver con «?»).
  - Al confirmar, la tarjeta pasa sola a «Escogidas», el estudio recibe aviso
    y aparece «Copiar para Lightroom» con los nombres de archivo para filtrar.
  - «Reabrir selección» y «Renovar y enviar de nuevo» si el enlace caduca.
- Permisos nuevos «Galerías» en Equipo (ver y gestionar).

**Cambiado**
- El texto por defecto de «Enviadas para escoger» ya no pide al cliente que
  avise con su selección.
- En el historial, los movimientos que hace el sistema se leen «Pasó de… a…».

## [0.3.0] · 11 oct 2026 · Ordenar etapas

**Añadido**
- «Ordenar etapas» en el menú `…` del tablero: se arrastran las etapas o se
  mueven con flechas (cómodo en el móvil). El nuevo orden se ve en el tablero,
  en «Mover a…», en la importación de CSV, en el panel y en Ajustes.
- Botón «+» en la cabecera de cada etapa para añadir un cliente arriba del
  todo, sin bajar hasta el final de la columna.

**Corregido**
- Las pruebas automáticas fallaban en el PC (no leían `.env.local`); en Vercel
  no afectaba.

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
