import sharp from "sharp";
import {
  ANALYSIS_PROMPT,
  ANALYSIS_SCHEMA,
  REVIEW_SCHEMA,
  reviewPrompt,
  ZONES_SCHEMA,
  zonesPrompt,
} from "./prompts.mjs";
import { geminiJson, TEXT_MODEL } from "./providers.mjs";

/**
 * Steps shared by the Editor engine (one photo, production) and the lab
 * (many photos and models, cached on disk).
 */

export const MODEL_INPUT_EDGE = 2048;
export const WEB_EDGE = 1600;
// Largest scale or shift (share of the frame) accepted from a model: past
// it the output cannot be composited on the original (ghost faces).
export const MAX_REFRAME = 0.03;

export const timed = async (task) => {
  const start = performance.now();
  const result = await task();
  return { result, seconds: (performance.now() - start) / 1000 };
};

/** The copy the models see: auto-oriented, 2048 px long edge. */
export const workingCopy = (original, edge = MODEL_INPUT_EDGE) =>
  sharp(original)
    .rotate()
    .resize({ width: edge, height: edge, fit: "inside" })
    .jpeg({ quality: 90 })
    .toBuffer();

export const isPortrait = async (image) => {
  const meta = await sharp(image).rotate().metadata();
  return (
    (meta.autoOrient?.height ?? meta.height) >
    (meta.autoOrient?.width ?? meta.width)
  );
};

export const webPreview = (source, quality = 84) =>
  sharp(source)
    .rotate()
    .resize({ width: WEB_EDGE, height: WEB_EDGE, fit: "inside" })
    .jpeg({ quality })
    .toBuffer();

/** 1024 px copy for the reviewer and the framing agent. */
export const small = (source) =>
  sharp(source)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside" })
    .jpeg({ quality: 85 })
    .toBuffer();

/** Change map preview: the (web-size) result with the model areas tinted. */
export const tintedPreview = async (finalWeb, changeMask) => {
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

  return sharp(data, { raw: info })
    .composite([{ input: layer }])
    .jpeg({ quality: 80 })
    .toBuffer();
};

/** Analyst: what to fix on the backdrop and floor, what to keep. */
export const analyse = async (working) => {
  const { result, seconds } = await timed(() =>
    geminiJson({
      model: TEXT_MODEL,
      prompt: ANALYSIS_PROMPT,
      schema: ANALYSIS_SCHEMA,
      images: [working],
    })
  );
  return { ...result.data, model: result.model, cost: result.cost, seconds };
};

/** Locator: a box per fix, prop and face. */
export const locate = async (working, analysis) => {
  const { result } = await timed(() =>
    geminiJson({
      model: TEXT_MODEL,
      prompt: zonesPrompt(analysis),
      schema: ZONES_SCHEMA,
      images: [working],
    })
  );
  return { ...result.data, cost: result.cost };
};

/** The locator's answer as the composite's boxes. */
export const boxesFromZones = (zones) => ({
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
});

export const isReframed = ({ s, dx, dy }) =>
  Math.abs(s - 1) > MAX_REFRAME ||
  Math.abs(dx) > MAX_REFRAME ||
  Math.abs(dy) > MAX_REFRAME;

/** Reviewer: score and comments comparing original and result. */
export const reviewResult = async (
  original,
  final,
  fixes,
  promptFor = reviewPrompt
) => {
  const { result } = await timed(async () =>
    geminiJson({
      model: TEXT_MODEL,
      prompt: promptFor(fixes),
      schema: REVIEW_SCHEMA,
      images: [await small(original), await small(final)],
    })
  );
  return { ...result.data, cost: result.cost };
};
