# Cloudflare R2 para las galerías

Las fotos de las galerías de selección se guardan en Cloudflare R2, no en
Supabase Storage: 10 GB gratis al mes y las descargas no se cobran, así que
con el volumen del estudio (100–200 fotos de ~200 KB por sesión, borradas a
los 60 días) cuesta $0. Las fotos de las tarjetas siguen en Supabase.

## Crear la cuenta y el bucket (una vez)

1. **Cuenta**: https://dash.cloudflare.com/sign-up. Si ofrece añadir un
   dominio, se salta.
2. **Activar R2**: menú izquierdo → *Storage & databases* → *R2 Object
   Storage*. Pide tarjeta o PayPal para el plan **R2 Free ($0)**; es una
   verificación y no cobra mientras se esté dentro de lo gratis.
3. **Bucket**: *Create bucket* → nombre `uphotox-galerias`, *Location*
   **Automatic**, *Default storage class* **Standard** (no *Infrequent
   Access*: cobra cada lectura y no tiene parte gratis). Acceso público
   **desactivado** y sin dominio `r2.dev`: las fotos son privadas.
4. **CORS** (el bucket → *Settings* → *CORS Policy*):

   ```json
   [
     {
       "AllowedOrigins": ["https://uphotox-app.vercel.app", "http://localhost:3000"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   La app envía `Cross-Origin-Embedder-Policy: require-corp`, así que sin
   esta regla el navegador bloquea las fotos. **Si la app cambia de dominio**
   (p. ej. `app.uphotox.com`), hay que añadirlo aquí.
5. **Clave**: portada de R2 → *Manage API tokens* → *Create Account API
   token*: nombre `uphotox-app`, permiso **Object Read & Write** (no
   *Admin*), *Apply to specific buckets only* → `uphotox-galerias`, TTL
   *Forever*, sin filtro de IP (Vercel no tiene IP fija). La clave secreta se
   ve una sola vez.

## Variables de entorno

En `apps/app/.env.local` (y en el proyecto `uphotox-app` de Vercel como
*Sensitive*; también en `uphotox-api` para el borrado automático):

```
R2_ACCOUNT_ID=          # Account ID (también sale en el S3 endpoint)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=uphotox-galerias
```

Las claves nunca se pegan en el chat ni se suben a Git.

## Cómo lo usa Uphotox

- Rutas: `<studio_id>/<gallery_id>/<photo_id>.jpg` (la foto tal como sale
  de Lightroom) y `<photo_id>_t.jpg` (miniatura hecha en el navegador).
- R2 no tiene RLS: el servidor solo entrega enlaces temporales (firmados)
  después de comprobar los permisos del miembro, o el código de la galería
  en el caso del cliente. Los datos (qué fotos hay y cuáles eligió el
  cliente) están en Supabase con RLS.
- El navegador sube directo a R2 con un enlace firmado de subida; las fotos
  no pasan por Vercel.
- Al borrar fotos, galerías, tarjetas, tableros o clientes, un trigger deja
  las rutas en la tabla `storage_deletions`; el servidor las borra de R2 justo
  después y una tarea diaria repasa lo que quede.
- Coste si algún día se pasa de 10 GB: $0,015 por GB al mes. Precios:
  https://developers.cloudflare.com/r2/pricing
