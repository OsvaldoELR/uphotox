/**
 * Background clean-up lab (proof of concept for the Editor module).
 *
 *   npm run lab -- --fotos "D:/.../FOTOS PARA PRUEBA DE EDICON" [--solo DSCF6279,DSCF7317]
 *                  [--variantes nb2,nbpro,gpt2] [--rehacer paso,paso] [--concurrencia 3]
 *                  [--modo completo|zonas] [--encuadre gpt2]
 *
 * Reads <fotos>/sin editar/*.jpg (and <fotos>/editadas/ for reference) and
 * writes everything to <fotos>/resultados-ia/, ending with informe.html.
 *
 * Per photo: analysis → zones → person mask → edit with each model →
 * full-resolution composite (people always original) → AI review.
 * Composite mode (--modo): "completo" (default) takes the whole background
 * from the model except people and the props to keep; "zonas" only the
 * problem boxes (patchy on plain backdrops: seams where boxes end).
 * Optional framing (--encuadre <model>): straighten and crop that model's
 * result as the studio's editor would, scored against the editor's crops.
 * Every step is cached on disk; --rehacer analysis,zones,mask,edit,final,review
 * redoes the listed steps.
 *
 * The pipeline itself lives in the Editor engine (services/editor/engine),
 * shared with the production service; this file only adds several models,
 * caching and the blind-vote report.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { estimateAlignment } from "../../services/editor/engine/lib/align.mjs";
import { compositeBackground } from "../../services/editor/engine/lib/composite.mjs";
import {
  applyFraming,
  drawFramings,
  matchEditorCrop,
  overlap,
  suggestFraming,
} from "../../services/editor/engine/lib/framing.mjs";
import { editPrompt } from "../../services/editor/engine/lib/prompts.mjs";
import {
  geminiEdit,
  openaiEdit,
} from "../../services/editor/engine/lib/providers.mjs";
import { personMask } from "../../services/editor/engine/lib/segment.mjs";
import {
  analyse,
  boxesFromZones,
  isReframed,
  locate,
  reviewResult,
  timed,
  tintedPreview,
  WEB_EDGE,
  webPreview,
  workingCopy,
} from "../../services/editor/engine/lib/steps.mjs";
import { writeReport } from "./lib/report.mjs";

const JPEG_NAME = /\.jpe?g$/i;
const FRAMING_EXAMPLES = 6;
const FULL_FRAME = { angle: 0, left: 0, top: 0, width: 1, height: 1 };

export const VARIANTS = {
  nb2: {
    label: "Nano Banana 2 (2K)",
    run: ({ image, portrait, prompt }) =>
      geminiEdit({
        model: "gemini-3.1-flash-image",
        imageSize: "2K",
        aspectRatio: portrait ? "2:3" : "3:2",
        image,
        prompt,
      }),
  },
  nbpro: {
    label: "Nano Banana Pro (2K)",
    run: ({ image, portrait, prompt }) =>
      geminiEdit({
        model: "gemini-3-pro-image",
        imageSize: "2K",
        aspectRatio: portrait ? "2:3" : "3:2",
        image,
        prompt,
      }),
  },
  gpt2: {
    label: "GPT Image 2 (alta)",
    run: ({ image, portrait, prompt }) =>
      openaiEdit({
        model: "gpt-image-2",
        size: portrait ? "1024x1536" : "1536x1024",
        quality: "high",
        image,
        prompt,
      }),
  },
};

const parseArgs = (argv) => {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) {
      args[argv[index].slice(2)] = argv[index + 1];
      index += 1;
    }
  }

  return args;
};

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

/** Runs `compute` unless `file` exists (and the step is not being redone). */
const cached = async (file, redo, compute) => {
  if (existsSync(file) && !redo) {
    return file.endsWith(".json") ? readJson(file) : file;
  }

  const value = await compute();

  if (file.endsWith(".json")) {
    await writeFile(file, JSON.stringify(value, null, 2));
  }

  return value;
};

const web = async (source, target) =>
  writeFile(target, await webPreview(source));

const processPhoto = async ({ args, name, outDir, redo, variants }) => {
  const id = path.parse(name).name;
  const folder = path.join(outDir, id);
  const source = path.join(args.fotos, "sin editar", name);
  const edited = path.join(args.fotos, "editadas", name);
  await mkdir(folder, { recursive: true });

  const inputFile = path.join(folder, "input.jpg");
  const meta = await sharp(source).rotate().metadata();
  const portrait =
    (meta.autoOrient?.height ?? meta.height) >
    (meta.autoOrient?.width ?? meta.width);

  if (!existsSync(inputFile)) {
    await writeFile(inputFile, await workingCopy(source));
  }

  const input = await readFile(inputFile);

  const analysis = await cached(
    path.join(folder, "analysis.json"),
    redo.has("analysis"),
    () => analyse(input)
  );

  const zones = await cached(
    path.join(folder, "zones.json"),
    redo.has("zones"),
    () => locate(input, analysis)
  );
  const boxes = boxesFromZones(zones);
  const mode = args.modo === "zonas" ? "zonas" : "completo";

  const maskFile = path.join(folder, "mask.png");
  await cached(maskFile, redo.has("mask"), async () => {
    await sharp(await personMask(inputFile)).toFile(maskFile);
  });

  const prompt = editPrompt(analysis);
  await writeFile(path.join(folder, "prompt.txt"), prompt);

  await web(source, path.join(folder, "original-web.jpg"));
  if (existsSync(edited)) {
    await web(edited, path.join(folder, "editor-web.jpg"));
  }

  const results = {};

  await Promise.all(
    variants.map(async (variant) => {
      const edit = await cached(
        path.join(folder, `${variant}.json`),
        redo.has("edit"),
        async () => {
          try {
            const { result, seconds } = await timed(() =>
              VARIANTS[variant].run({ image: input, portrait, prompt })
            );
            await sharp(result.image)
              .png()
              .toFile(path.join(folder, `${variant}.png`));
            return {
              ok: true,
              model: result.model,
              cost: result.cost,
              seconds,
            };
          } catch (error) {
            return { ok: false, error: String(error.message ?? error) };
          }
        }
      );

      if (!edit.ok) {
        results[variant] = { edit };
        return;
      }

      const output = path.join(folder, `${variant}.png`);
      // Each mode has its own files, so both can be compared.
      const base = mode === "completo" ? `${variant}-completo` : variant;
      const finalFile = path.join(folder, `${base}-final.jpg`);
      const final = await cached(
        path.join(folder, `${base}-final.json`),
        redo.has("final"),
        async () => {
          const alignment = await estimateAlignment(inputFile, output);

          // A model that reframes the photo cannot be composited on the
          // original (ghost faces): reject it; production retries.
          if (isReframed(alignment)) {
            await web(output, path.join(folder, `${base}-web.jpg`));
            await web(output, path.join(folder, `${base}-zonas.jpg`));
            return {
              alignment,
              rejected: `La IA cambió el encuadre (escala ${alignment.s.toFixed(3)}); se descarta y se reintentaría.`,
              changedShare: 0,
              seconds: 0,
            };
          }

          const { result, seconds } = await timed(async () => {
            const composite = await compositeBackground({
              alignment,
              mode,
              original: source,
              workingCopy: inputFile,
              output,
              person: maskFile,
              zones: boxes,
            });
            await writeFile(finalFile, composite.final);
            await sharp(composite.changeMask).toFile(
              path.join(folder, `${base}-cambios.png`)
            );
            return {
              alignment,
              changedShare: composite.changedShare,
              offsets: composite.offsets,
            };
          });
          await web(finalFile, path.join(folder, `${base}-web.jpg`));
          await writeFile(
            path.join(folder, `${base}-zonas.jpg`),
            await tintedPreview(
              path.join(folder, `${base}-web.jpg`),
              path.join(folder, `${base}-cambios.png`)
            )
          );
          return { ...result, seconds };
        }
      );

      const verdict = await cached(
        path.join(folder, `${base}-review.json`),
        redo.has("review"),
        () => {
          if (final.rejected) {
            return {
              score: 0,
              remaining: [],
              artifacts: [],
              comment: final.rejected,
              cost: 0,
            };
          }

          return reviewResult(source, finalFile, analysis.fixes);
        }
      );

      results[variant] = { base, edit, final, review: verdict };
    })
  );

  return { id, name, portrait, mode, analysis, zones, results };
};

/** The studio editor's framing of a photo, from «editadas/» (if there). */
const editorFraming = ({ args, outDir, photo, redo }) => {
  const edited = path.join(args.fotos, "editadas", photo.name);

  if (!existsSync(edited)) {
    return undefined;
  }

  return cached(
    path.join(outDir, photo.id, "editor-crop.json"),
    redo.has("framing"),
    () =>
      matchEditorCrop(path.join(args.fotos, "sin editar", photo.name), edited)
  );
};

/** Average of the studio's other crops (a baseline to beat). */
const averageFraming = (framings) => {
  const mean = (key) =>
    framings.reduce((sum, f) => sum + f[key], 0) / framings.length;
  return {
    angle: 0,
    left: mean("left"),
    top: mean("top"),
    width: mean("width"),
    height: mean("height"),
  };
};

/**
 * Suggests a framing for one photo with the engine, shown the studio's
 * crops of the other photos (same set first). The editor's crop of this
 * photo is never shown: it only scores the suggestion.
 */
const frameOne = async ({ args, folder, photo, photos, studio }) => {
  const examples = photos
    .filter((other) => other.id !== photo.id && studio[other.id])
    .sort(
      (a, b) =>
        Number(b.analysis.scene === photo.analysis.scene) -
        Number(a.analysis.scene === photo.analysis.scene)
    )
    .slice(0, FRAMING_EXAMPLES);
  const { tilt, suggested, cost } = await suggestFraming({
    examples: examples.map((other) => ({
      image: path.join(args.fotos, "sin editar", other.name),
      scene: other.analysis.scene,
      framing: studio[other.id],
    })),
    image: path.join(args.fotos, "sin editar", photo.name),
    keep: photo.zones.keep.map((zone) => zone.box_2d),
    person: path.join(folder, "mask.png"),
    scene: photo.analysis.scene,
    working: path.join(folder, "input.jpg"),
  });
  const editor = studio[photo.id];
  const others = examples.map((other) => studio[other.id]);

  return {
    tilt,
    suggested,
    editor,
    examples: examples.map((other) => other.id),
    overlap: editor ? overlap(suggested, editor) : undefined,
    baselines: editor
      ? {
          full: overlap(FULL_FRAME, editor),
          average: overlap(averageFraming(others), editor),
        }
      : undefined,
    cost,
  };
};

/**
 * Optional framing (--encuadre <model>): suggestion per photo, applied to
 * that model's full-size result, plus a comparison picture (editor's crop
 * in magenta, suggestion in cyan, on the original).
 */
const frameAll = async ({ args, outDir, photos, redo, variant }) => {
  const studio = {};

  for (const photo of photos) {
    studio[photo.id] = await editorFraming({ args, outDir, photo, redo });
  }

  for (const photo of photos) {
    const folder = path.join(outDir, photo.id);
    const source = path.join(args.fotos, "sin editar", photo.name);
    photo.framing = await cached(
      path.join(folder, "framing.json"),
      redo.has("framing"),
      () => frameOne({ args, folder, photo, photos, studio })
    );

    await writeFile(
      path.join(folder, "encuadre-comparacion.jpg"),
      await drawFramings(
        source,
        [
          ...(photo.framing.editor
            ? [{ framing: photo.framing.editor, colour: "#ff2fb3" }]
            : []),
          { framing: photo.framing.suggested, colour: "#00c8ff" },
        ],
        WEB_EDGE
      )
    );

    const result = photo.results[variant];

    if (result?.final && !result.final.rejected) {
      const framed = path.join(folder, `${result.base}-encuadre.jpg`);
      await writeFile(
        framed,
        await applyFraming(
          path.join(folder, `${result.base}-final.jpg`),
          photo.framing.suggested
        )
      );
      await web(framed, path.join(folder, `${result.base}-encuadre-web.jpg`));
      photo.framing.file = `${result.base}-encuadre`;
    }

    const score = photo.framing.overlap;
    console.log(
      `${photo.name} · encuadre · giro ${photo.framing.tilt.angle}° · ${score === undefined ? "sin editor" : `coincide ${(score * 100).toFixed(0)} % con el editor`}`
    );
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (!args.fotos) {
    throw new Error('Falta --fotos "<carpeta con «sin editar»>"');
  }

  const outDir = path.join(args.fotos, "resultados-ia");
  const only = args.solo?.split(",").map((value) => value.trim().toUpperCase());
  const variants = (args.variantes ?? Object.keys(VARIANTS).join(",")).split(
    ","
  );
  const redo = new Set((args.rehacer ?? "").split(",").filter(Boolean));
  const concurrency = Number(args.concurrencia ?? 2);
  const names = (await readdir(path.join(args.fotos, "sin editar")))
    .filter((name) => JPEG_NAME.test(name))
    .filter(
      (name) => !only || only.includes(path.parse(name).name.toUpperCase())
    )
    .sort();

  const photos = [];
  let next = 0;

  const worker = async () => {
    while (next < names.length) {
      const name = names[next];
      next += 1;
      const photo = await processPhoto({ args, name, outDir, redo, variants });
      photos.push(photo);
      const line = variants
        .map((variant) => {
          const r = photo.results[variant];
          return r?.edit.ok
            ? `${variant} ${r.review.score}/10 $${r.edit.cost.toFixed(2)} ${r.edit.seconds.toFixed(0)}s`
            : `${variant} ERROR`;
        })
        .join(" · ");
      console.log(
        `${photo.name} · ${photo.mode} · ${photo.analysis.scene} · ${line}`
      );
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  photos.sort((a, b) => a.name.localeCompare(b.name));

  if (args.encuadre) {
    if (!VARIANTS[args.encuadre]) {
      throw new Error(`--encuadre: modelo desconocido «${args.encuadre}»`);
    }

    await frameAll({ args, outDir, photos, redo, variant: args.encuadre });
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "resultados.json"),
    JSON.stringify(photos, null, 2)
  );
  const report = await writeReport({
    outDir,
    photos,
    variants: Object.fromEntries(variants.map((v) => [v, VARIANTS[v].label])),
  });
  console.log(`\nInforme: ${report}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
