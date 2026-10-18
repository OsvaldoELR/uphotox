# Servicio del Editor (Cloudflare)

Limpia el fondo de las fotos elegidas por el cliente sin tocar a las
personas. Plan del módulo: `docs/plan-editor.md`.

- `src/index.ts`: **Worker** `uphotox-editor`. `POST /photos` (con el token)
  pone una foto en la cola; el consumidor de la cola lee el original de R2,
  lo pasa al motor y guarda el resultado junto al original. `GET
  /photos/status?prefix=…` devuelve su estado.
- `engine/`: **motor** (contenedor Docker con Node, sharp y el recorte de
  personas MODNet). `lib/pipeline.mjs` hace una foto de principio a fin; el
  resto de `lib/` son los pasos (los mismos que usa `tools/fondo-lab`).
- `scripts/try.mjs`: prueba de punta a punta con una foto contra el
  servicio publicado.

Las fotos de prueba se guardan en R2 en `editor/pruebas/…` y el script las
borra al terminar.

## Puesta en marcha (una vez)

1. **Plan Workers de pago** ($5 al mes): en Cloudflare, *Workers y Pages* →
   *Planes* → *Workers Paid*. Los contenedores lo necesitan.
2. **Conectar el repositorio** (Cloudflare construye el contenedor, no hace
   falta Docker en el PC): *Workers y Pages* → *Crear* → *Importar un
   repositorio* → GitHub `OsvaldoELR/uphotox`:
   - Nombre del proyecto: `uphotox-editor` (el mismo que en `wrangler.jsonc`).
   - Directorio raíz: `services/editor`.
   - Comando de compilación: vacío. Comando de despliegue: `npx wrangler deploy`.
   - Rutas de compilación (*Build watch paths*): `services/editor/*`, para
     que los cambios de la app no lo vuelvan a construir.
3. **Secretos** del Worker (*Configuración* → *Variables y secretos*, tipo
   *Secreto*), con los mismos valores que en `apps/app/.env.local`:
   `EDITOR_TOKEN`, `GEMINI_API_KEY`, `OPENAI_API_KEY`.
4. Copiar la dirección del Worker (`https://uphotox-editor.<tu-subdominio>.workers.dev`)
   en `EDITOR_URL` de `apps/app/.env.local`.

## Probar

```
cd services/editor
npm install
npm run try -- "D:/PROGRAMACION/uphotox/FOTOS PARA PRUEBA DE EDICON/sin editar/DSCF6322.jpg"
```

El resultado queda en `resultados-editor/` junto a la foto.

## Desarrollo local

- Motor sin Docker: `cd engine && npm install`, bajar el modelo
  (`curl -L -o models/modnet.onnx https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx`)
  y `npm run dev` (puerto 8080; `POST /process` con el JPEG en el cuerpo).
- Worker: `npm run types` (tipos de `wrangler.jsonc`) y `npm run typecheck`.
  `npx wrangler deploy --dry-run --containers-rollout=none` empaqueta el
  Worker sin construir el contenedor.
