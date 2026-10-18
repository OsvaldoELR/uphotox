import { estimateAlignment } from "./align.mjs";
import { compositeBackground } from "./composite.mjs";
import { applyFraming, suggestFraming } from "./framing.mjs";
import { editPrompt } from "./prompts.mjs";
import { openaiEdit } from "./providers.mjs";
import { personMask } from "./segment.mjs";
import {
  analyse,
  boxesFromZones,
  isPortrait,
  isReframed,
  locate,
  reviewResult,
  timed,
  tintedPreview,
  webPreview,
  workingCopy,
} from "./steps.mjs";

// First try plus two retries, for API errors and reframed outputs. An
// output with little change is not retried: on a clean white backdrop that
// is the right answer (the reviewer flags real misses for a human).
const EDIT_ATTEMPTS = 3;
// Below this reviewer score the photo is marked «revisar».
const REVIEW_THRESHOLD = 6;

/** GPT Image 2, the model the studio picked in the blind vote. */
const editWithGpt = ({ image, portrait, prompt }) =>
  openaiEdit({
    model: "gpt-image-2",
    size: portrait ? "1024x1536" : "1536x1024",
    quality: "high",
    image,
    prompt,
  });

const editWithRetries = async ({ log, portrait, prompt, working }) => {
  const attempts = [];
  let cost = 0;

  for (let attempt = 1; attempt <= EDIT_ATTEMPTS; attempt += 1) {
    log(`edit ${attempt}`);

    try {
      const { result, seconds } = await timed(() =>
        editWithGpt({ image: working, portrait, prompt })
      );
      cost += result.cost;
      const alignment = await estimateAlignment(working, result.image);

      if (!isReframed(alignment)) {
        attempts.push({ ok: true, alignment, seconds });
        return { attempts, alignment, cost, output: result.image };
      }

      attempts.push({ ok: false, reason: "reframed", alignment, seconds });
    } catch (error) {
      attempts.push({ ok: false, reason: String(error.message ?? error) });
    }
  }

  const reasons = attempts.map((attempt) => attempt.reason).join("; ");
  throw new Error(
    `La IA no devolvió una imagen válida en ${EDIT_ATTEMPTS} intentos (${reasons}).`
  );
};

/**
 * Cleans the backdrop of one photo: the Editor module's job.
 *
 * @param original full-size photo (JPEG buffer, as exported from Lightroom)
 * @param options.helpers false keeps a helper's hand holding the child
 * @param options.note extra instruction from the studio for a redo
 * @param options.framing { examples: [{ image, scene, framing }] } to also
 *   straighten and crop like the studio (off without examples)
 * @param log progress callback (step name)
 * @returns { final, framed?, preview, zones, info } JPEG buffers + JSON info
 */
export const cleanPhoto = async ({
  original,
  options = {},
  log = () => undefined,
}) => {
  const started = performance.now();
  log("analysis");
  const working = await workingCopy(original);
  const analysis = await analyse(working);

  if (options.note) {
    analysis.fixes = [...analysis.fixes, options.note];
  }

  log("zones");
  const zones = await locate(working, analysis);
  const boxes = boxesFromZones(zones);

  if (options.helpers === false) {
    boxes.helpers = [];
  }

  log("people");
  const person = await personMask(working);
  const edit = await editWithRetries({
    log,
    portrait: await isPortrait(working),
    prompt: editPrompt(analysis),
    working,
  });

  log("composite");
  const composite = await compositeBackground({
    alignment: edit.alignment,
    mode: "completo",
    original,
    output: edit.output,
    person,
    workingCopy: working,
    zones: boxes,
  });

  log("review");
  const review = await reviewResult(original, composite.final, analysis.fixes);

  let framing;
  let framed;

  if (options.framing?.examples?.length) {
    log("framing");
    framing = await suggestFraming({
      examples: options.framing.examples,
      image: original,
      keep: boxes.keep,
      person,
      scene: analysis.scene,
      working,
    });
    framed = await applyFraming(composite.final, framing.suggested);
  }

  const preview = await webPreview(composite.final);
  const costs = {
    analysis: analysis.cost,
    zones: zones.cost,
    edit: edit.cost,
    review: review.cost,
    framing: framing?.cost ?? 0,
  };

  return {
    final: composite.final,
    framed,
    preview,
    framedPreview: framed ? await webPreview(framed) : undefined,
    zones: await tintedPreview(preview, composite.changeMask),
    info: {
      scene: analysis.scene,
      fixes: analysis.fixes,
      keep: analysis.keep,
      risk: analysis.risk,
      zones,
      attempts: edit.attempts,
      alignment: edit.alignment,
      changedShare: composite.changedShare,
      review,
      needsReview: review.score < REVIEW_THRESHOLD,
      framing,
      costs: {
        ...costs,
        total: Object.values(costs).reduce((sum, value) => sum + value, 0),
      },
      seconds: (performance.now() - started) / 1000,
    },
  };
};
