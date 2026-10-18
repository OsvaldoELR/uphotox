# fondo-lab · prueba de limpieza de fondos con IA

Prueba de concepto del módulo **Editor**: limpiar el fondo y el suelo de las
fotos de estudio con modelos de IA **sin tocar a las personas**. No es parte
de la app; sirve para decidir qué modelos y qué reglas usar antes de
construir el módulo.

## Cómo funciona (por foto)

1. **Analista** (Gemini Flash, ~$0,003): mira la foto y lista qué hay que
   arreglar del fondo (franjas de otro fondo, focos, arrugas, costuras…) y qué
   decorados hay que respetar.
2. **Localizador** (Gemini Flash, ~$0,005): devuelve un recuadro por cada
   problema y cada decorado, y si el problema es de «quitar» o de «suavizar».
3. **Recorte de personas** (MODNet, local, gratis): máscara de las personas.
4. **Edición** con cada modelo (Nano Banana 2, Nano Banana Pro, GPT Image 2)
   sobre una copia de 2048 px.
5. **Montaje a resolución completa** (`lib/composite.mjs`): se alinea la
   salida del modelo con la original, se iguala el color y solo se usan
   píxeles de la IA dentro de los recuadros de problemas y donde de verdad
   cambió algo; en las zonas de «suavizar» se usa la IA entera. **Las personas
   siempre son los píxeles originales** y los decorados también, salvo que
   cambien mucho de color (p. ej. una franja azul pintada encima).
6. **Revisor** (Gemini Flash): compara original y resultado y pone nota.
7. **Informe** `resultados-ia/informe.html` para votar a ciegas.

## Uso

Requisitos: `GEMINI_API_KEY` y `OPENAI_API_KEY` en `apps/app/.env.local`, y
el modelo de recorte en `tools/fondo-lab/models/` (no se sube a Git):

```
cd tools/fondo-lab
npm install
curl -L -o models/modnet.onnx https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx
npm run lab -- --fotos "D:/PROGRAMACION/uphotox/FOTOS PARA PRUEBA DE EDICON"
```

La carpeta de fotos necesita `sin editar/` (JPG) y, para comparar,
`editadas/` (la versión de tu editor, mismo nombre). Todo se guarda en
`resultados-ia/` dentro de esa carpeta, **fuera del repositorio**: son fotos de
clientes y no se suben a ningún sitio salvo a las APIs de los modelos.

Opciones: `--solo DSCF6279,DSCF7317`, `--variantes nb2,nbpro,gpt2`,
`--concurrencia 3`, `--rehacer analysis,zones,mask,edit,final,review` (cada
paso queda guardado y no se repite si no se pide).

Recorte alternativo: `FONDO_LAB_MASK=birefnet` o `portrait` usa BiRefNet (MIT,
mejores bordes de pelo) si se descarga en `models/`, pero necesita varios GB
de memoria libre.
