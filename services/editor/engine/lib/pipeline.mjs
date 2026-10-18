import { estimateAlignment } from "./align.mjs";
import { compositeBackground } from "./composite.mjs";
import { applyFraming, styleFraming, suggestFraming } from "./framing.mjs";
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

const editWithRetries = async ({ log, portrait, prompt, spend, working }) => {
  const attempts = [];
  let cost = 0;

  for (let attempt = 1; attempt <= EDIT_ATTEMPTS; attempt += 1) {
    log(`edit ${attempt}`);

    try {
      const { result, seconds } = await timed(() =>
        editWithGpt({ image: working, portrait, prompt })
      );
      cost += spend(result.cost);
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

const runPipeline = async ({ log, options, original, spend }) => {
  const started = performance.now();
  log("analysis");
  const working = await workingCopy(original);
  const analysis = await analyse(working);
  spend(analysis.cost);

  if (options.note) {
    analysis.fixes = [...analysis.fixes, options.note];
  }

  log("zones");
  const zones = await locate(working, analysis);
  spend(zones.cost);
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
    spend,
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
  spend(review.cost);

  let framing;
  let framed;

  // With the studio's crops as examples the framing agent decides; without
  // them, the studio's usual trims (no AI).
  if (options.framing) {
    log("framing");
    framing = options.framing.examples?.length
      ? await suggestFraming({
          examples: options.framing.examples,
          image: original,
          keep: boxes.keep,
          person,
          scene: analysis.scene,
          working,
        })
      : await styleFraming({ keep: boxes.keep, person, working });
    spend(framing.cost);
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
    // The original at preview size, to compare before and after.
    before: await webPreview(original),
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

/**
 * Cleans the backdrop of one photo: the Editor module's job.
 *
 * @param original full-size photo (JPEG buffer, as exported from Lightroom)
 * @param options.helpers false keeps a helper's hand holding the child
 * @param options.note extra instruction from the studio for a redo
 * @param options.framing true to also straighten and crop in the studio's
 *   usual style, or { examples: [{ image, scene, framing }] } to let the
 *   framing agent follow the studio's own crops
 * @param log progress callback (step name)
 * @returns { final, framed?, preview, zones, info } JPEG buffers + JSON info
 */
export const cleanPhoto = async ({
  original,
  options = {},
  log = () => undefined,
}) => {
  let spent = 0;
  const spend = (cost = 0) => {
    spent += cost;
    return cost;
  };

  try {
    return await runPipeline({ log, options, original, spend });
  } catch (error) {
    // A failed photo still cost something: the studio's consumption counts it.
    throw Object.assign(
      error instanceof Error ? error : new Error(String(error)),
      { cost: spent }
    );
  }
};
