/**
 * Background clean-up lab (proof of concept for the Editor module).
 *
 *   npm run lab -- --fotos "D:/.../FOTOS PARA PRUEBA DE EDICON" [--solo DSCF6279,DSCF7317]
 *                  [--variantes nb2,nbpro,gpt2] [--rehacer paso,paso] [--concurrencia 3]
 *                  [--modo completo|zonas]
 *
 * Reads <fotos>/sin editar/*.jpg (and <fotos>/editadas/ for reference) and
 * writes everything to <fotos>/resultados-ia/, ending with informe.html.
 *
 * Per photo: analysis → zones → person mask → edit with each model →
 * full-resolution composite (people always original) → AI review.
 * Composite mode (--modo): "completo" (default) takes the whole background
 * from the model except people and the props to keep; "zonas" only the
 * problem boxes (patchy on plain backdrops: seams where boxes end).
 * Every step is cached on disk; --rehacer analysis,zones,mask,edit,final,review
 * redoes the listed steps.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { estimateAlignment } from "./lib/align.mjs";
import { compositeBackground } from "./lib/composite.mjs";
import {
  ANALYSIS_PROMPT,
  ANALYSIS_SCHEMA,
  editPrompt,
  REVIEW_SCHEMA,
  reviewPrompt,
  ZONES_SCHEMA,
  zonesPrompt,
} from "./lib/prompts.mjs";
import { geminiEdit, geminiJson, openaiEdit } from "./lib/providers.mjs";
import { writeReport } from "./lib/report.mjs";
import { personMask } from "./lib/segment.mjs";

const MODEL_INPUT_EDGE = 2048;
const WEB_EDGE = 1600;
// Largest scale or shift (fraction of the frame) accepted from a model.
const MAX_REFRAME = 0.03;
const TEXT_MODEL = "gemini-flash-latest";
const JPEG_NAME = /\.jpe?g$/i;

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

const timed = async (task) => {
  const start = performance.now();
  const result = await task();
  return { result, seconds: (performance.now() - start) / 1000 };
};

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

const web = (source, target) =>
  sharp(source)
    .rotate()
    .resize({ width: WEB_EDGE, height: WEB_EDGE, fit: "inside" })
    .jpeg({ quality: 84 })
    .toFile(target);

const small = (source) =>
  sharp(source)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside" })
    .jpeg({ quality: 85 })
    .toBuffer();

/** Change map preview: the result with the model areas tinted. */
const tintedPreview = async (finalWeb, changeMask, target) => {
  const { data, info } = await sharp(finalWeb)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = await sharp(changeMask)
    .resize(info.width, info.height, { fit: "fill" })
    .extractChannel(0)
    .linear(0.55, 0)
    .raw()
    .toBuffer();
  const tint = await sharp({
    create: {
      width: info.width,
      height: info.height,
      channels: 3,
      background: "#00c8ff",
    },
  })
    .raw()
    .toBuffer();
  const layer = await sharp(tint, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .joinChannel(alpha, {
      raw: { width: info.width, height: info.height, channels: 1 },
    })
    .png()
    .toBuffer();

  await sharp(data, { raw: info })
    .composite([{ input: layer }])
    .jpeg({ quality: 80 })
    .toFile(target);
};

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
    await sharp(source)
      .rotate()
      .resize({
        width: MODEL_INPUT_EDGE,
        height: MODEL_INPUT_EDGE,
        fit: "inside",
      })
      .jpeg({ quality: 90 })
      .toFile(inputFile);
  }

  const input = await readFile(inputFile);
  const review = await small(source);

  const analysis = await cached(
    path.join(folder, "analysis.json"),
    redo.has("analysis"),
    async () => {
      const { result, seconds } = await timed(() =>
        geminiJson({
          model: TEXT_MODEL,
          prompt: ANALYSIS_PROMPT,
          schema: ANALYSIS_SCHEMA,
          images: [input],
        })
      );
      return {
        ...result.data,
        model: result.model,
        cost: result.cost,
        seconds,
      };
    }
  );

  const zones = await cached(
    path.join(folder, "zones.json"),
    redo.has("zones"),
    async () => {
      const { result } = await timed(() =>
        geminiJson({
          model: TEXT_MODEL,
          prompt: zonesPrompt(analysis),
          schema: ZONES_SCHEMA,
          images: [input],
        })
      );
      return { ...result.data, cost: result.cost };
    }
  );
  const boxes = {
    fixes: zones.fixes.map((zone) => zone.box_2d),
    smooth: zones.fixes
      .filter((zone) => zone.kind === "smooth")
      .map((zone) => zone.box_2d),
    // A parent's hand holding the child: removed, even over the child.
    helpers: zones.fixes
      .filter((zone) => zone.kind === "helper")
      .map((zone) => zone.box_2d),
    keep: zones.keep.map((zone) => zone.box_2d),
    faces: (zones.faces ?? []).map((face) => face.box_2d),
  };
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
          // original (ghost faces): reject it; production would retry.
          if (
            Math.abs(alignment.s - 1) > MAX_REFRAME ||
            Math.abs(alignment.dx) > MAX_REFRAME ||
            Math.abs(alignment.dy) > MAX_REFRAME
          ) {
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
          await tintedPreview(
            path.join(folder, `${base}-web.jpg`),
            path.join(folder, `${base}-cambios.png`),
            path.join(folder, `${base}-zonas.jpg`)
          );
          return { ...result, seconds };
        }
      );

      const verdict = await cached(
        path.join(folder, `${base}-review.json`),
        redo.has("review"),
        async () => {
          if (final.rejected) {
            return {
              score: 0,
              remaining: [],
              artifacts: [],
              comment: final.rejected,
              cost: 0,
            };
          }

          const { result } = await timed(async () =>
            geminiJson({
              model: TEXT_MODEL,
              prompt: reviewPrompt(analysis.fixes),
              schema: REVIEW_SCHEMA,
              images: [review, await small(finalFile)],
            })
          );
          return { ...result.data, cost: result.cost };
        }
      );

      results[variant] = { base, edit, final, review: verdict };
    })
  );

  return { id, name, portrait, mode, analysis, zones, results };
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
