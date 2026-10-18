# Versiones de Uphotox

Cada versión publicada en producción (https://uphotox-app.vercel.app) tiene
aquí su entrada y una etiqueta en Git (`vX.Y.Z`). El detalle de cada tarea está
en `docs/bitacora.md`.

Numeración: el primer número cambia con cambios grandes que rompen la forma de
trabajar, el segundo con funciones nuevas y el tercero con arreglos.

## [0.6.1] · 18 oct 2026 · Editor: ver las fotos en grande

**Añadido**
- Un clic en una foto limpia la abre **en grande en la misma página**; otro
  clic la amplía a **tamaño real** justo donde se pulsó (y se recorre
  arrastrando o con la rueda). Con «Ver original», «Zonas», aprobar,
  rehacer o descartar ahí mismo, y flechas (o ← →) para pasar de foto.
- **Quitar a una persona entera** pidiéndolo en la nota de «Rehacer» (por
  ejemplo, la madre que sujeta a la niña): se quita y se rehace el fondo,
  y las caras de quienes se quedan siguen intactas.

**Corregido**
- Una foto aprobada o descartada ya no sigue marcada como «Revisar».
- Las fotos limpiadas antes de la v0.6.0 no tienen vista de la original:
  al mantenerlas pulsadas ya no sale una imagen rota.

## [0.6.0] · 18 oct 2026 · Editor: revisar, descargar y ajustes

**Añadido**
- **Revisar cada foto limpia**: mantener pulsada para ver la original,
  «Ver zonas» (lo que vino de la IA), «Tamaño real», y **Aprobar**,
  **Rehacer con una nota** («quita también la línea del suelo», se añade a
  las instrucciones de la IA) o **Descartar** (se queda la original). Con
  «Deshacer» y «Aprobar las listas» para todas las que el revisor no marcó.
- **Descargar las aprobadas** en la carpeta de la sesión, al lado de cada
  original (`DSCF7325-fondo.jpg`), en Chrome o Edge; en otros navegadores,
  a Descargas. Después, en Lightroom, «Sincronizar carpeta…».
- **Correo al terminar**: «N fotos están listas para revisar», aunque la
  página esté cerrada (el servicio de limpieza avisa a la app).
- **Ajustes → Editor**: quitar manos de ayuda (sí/no), **enderezar y
  encuadrar** como suele hacerlo el estudio (sin IA, sin coste), límite de
  gasto al mes (aviso al 80 % y parada al llegar) y días que se guardan las
  fotos en la nube (30 por defecto).
- **Borrado automático** cada noche de las fotos del editor pasados esos
  días (y de las subidas que se quedaron a medias).

## [0.5.1] · 18 oct 2026 · Editor: subida más segura

**Corregido**
- Si el servicio de limpieza no acepta la conexión, cada foto dice por qué
  (por ejemplo, «rechazó la clave») en vez de «No se pudo enviar al editor».
- Al reintentar, las fotos que ya habían subido no se vuelven a subir: van
  directas a la cola.
- Una subida cortada se reintenta sola dos veces.
- Las fotos que se quedaron «sin subir» salen aparte, en una franja
  «Sin terminar de enviar», con «Reintentar envío» (manda las que ya
  subieron, sin volver a arrastrarlas) y «Quitar».

**Añadido**
- Uphotox no deja enviar copias pequeñas (por ejemplo, las de la galería con
  marca de agua): avisa «Es una copia pequeña: expórtala a tamaño completo».
- Ajuste de exportación para Lightroom «Uphotox - Limpieza de fondos»
  (JPEG 95, sRGB, tamaño completo, nombre original), descargable desde la
  página de limpieza.

## [0.5.0] · 18 oct 2026 · Editor: limpieza de fondos (primera parte)

**Añadido**
- Módulo **Editor** (menú propio, permiso «Usar el editor»): la IA limpia el
  fondo y el suelo de las fotos que eligió el cliente sin tocar a las
  personas (siempre son los píxeles originales). También quita la mano de un
  adulto que sujeta al niño; las caras nunca se tocan.
  - En una galería con la selección recibida, «Limpiar fondos»: se arrastran
    las elegidas exportadas a tamaño completo, Uphotox las empareja por
    nombre con la selección y avisa de las que faltan o sobran.
  - Las fotos suben directas al almacenamiento y se limpian en la nube
    (Cloudflare, con GPT Image 2): se puede cerrar la página.
  - Lista con el estado en vivo (en cola, limpiando, lista, revisar, falló),
    la vista previa limpia, la nota del revisor automático y el coste.
  - **Consumo** del estudio: por galería y por mes en la página del Editor.
- Las fotos limpias conservan los datos de la cámara y el perfil de color.

**Pendiente** (próxima versión): aprobar o rehacer cada foto, descargarlas a
tamaño completo en la carpeta de la sesión, aviso por correo y ajustes del
editor.

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
