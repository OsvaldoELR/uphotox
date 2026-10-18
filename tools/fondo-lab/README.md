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
   problema, cada decorado y cada cara, y si el problema es de «quitar», de
   «suavizar» o una mano de ayuda (`helper`).
3. **Recorte de personas** (MODNet, local, gratis): máscara de las personas.
4. **Edición** con cada modelo (Nano Banana 2, Nano Banana Pro, GPT Image 2)
   sobre una copia de 2048 px.
5. **Montaje a resolución completa** (`lib/composite.mjs`): se alinea la
   salida del modelo con la original y se iguala el color. **Las personas
   siempre son los píxeles originales** (las de la foto y las que dibujó la
   IA, para que no aparezca un borde fantasma) y los decorados también, salvo
   que cambien mucho de color (p. ej. una franja azul pintada encima).
   Única excepción: **la mano o el brazo de quien sujeta al niño** se quita,
   junto con la mano del niño que la agarraba (entera, para que no salgan dos
   puños); las caras nunca. Dos modos:
   - `completo` (por defecto): todo el resto del fondo viene de la IA, con un
     ajuste de color suave que conserva la luz de la original para que no se
     note el borde alrededor de las personas.
   - `zonas`: solo píxeles de la IA dentro de los recuadros de problemas y
     donde de verdad cambió algo (en «suavizar», la IA entera). En fondos
     lisos deja parches con bordes rectos (DSCF7325), por eso ya no es el
     modo por defecto.
6. **Revisor** (Gemini Flash): compara original y resultado y pone nota.
7. **Encuadre (opcional, `--encuadre gpt2`)**: endereza con las líneas
   verticales del fondo (molduras, bordes; sin personas ni decorados) y
   recorta como el editor del estudio: Gemini Flash ve recortes reales del
   estudio en otras fotos (primero del mismo set) y propone el de esta. Se
   aplica con código al resultado a tamaño completo (la IA de imagen nunca
   reencuadra). Los recortes del estudio salen de `editadas/`
   (`lib/framing.mjs`, `matchEditorCrop`) y sirven también para puntuar.
8. **Informe** `resultados-ia/informe.html` para votar a ciegas.

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
`--modo completo|zonas` (cada modo guarda sus propios archivos),
`--encuadre gpt2` (encuadra el resultado de ese modelo), `--concurrencia 3`,
`--rehacer analysis,zones,mask,edit,final,review,framing` (cada paso queda
guardado y no se repite si no se pide).

Recorte alternativo: `FONDO_LAB_MASK=birefnet` o `portrait` usa BiRefNet (MIT,
mejores bordes de pelo) si se descarga en `models/`, pero necesita varios GB
de memoria libre.
