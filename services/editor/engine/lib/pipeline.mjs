import { estimateAlignment } from "./align.mjs";
import { compositeBackground } from "./composite.mjs";
import { applyFraming, styleFraming, suggestFraming } from "./framing.mjs";
import {
  editPrompt,
  fullEditPrompt,
  fullReviewPrompt,
  reviewPrompt,
} from "./prompts.mjs";
import { geminiEdit, openaiEdit } from "./providers.mjs";
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
// A full edit gives the models a bigger copy: their output carries the
// skin, clothes and hair, so resolution matters.
const FULL_INPUT_EDGE = 3072;
// Most of the reviewer's points passed to a second pass.
const SECOND_PASS_NOTES = 8;

/**
 * The image models the studio can use, with their sizes per mode: «fondo»
 * keeps the people original (smaller outputs are enough), «completa» takes
 * almost everything from the model (largest outputs).
 */
export const MODELS = {
  gpt: {
    label: "GPT Image 2",
    edit: (mode, { image, portrait, prompt }) => {
      const full = portrait ? "2336x3504" : "3504x2336";
      const small = portrait ? "1024x1536" : "1536x1024";
      return openaiEdit({
        model: "gpt-image-2",
        size: mode === "completa" ? full : small,
        quality: "high",
        image,
        prompt,
      });
    },
  },
  nbpro: {
    label: "Nano Banana Pro",
    edit: (mode, { image, portrait, prompt }) =>
      geminiEdit({
        model: "gemini-3-pro-image",
        imageSize: mode === "completa" ? "4K" : "2K",
        aspectRatio: portrait ? "2:3" : "3:2",
        image,
        prompt,
      }),
  },
};

// With one model: GPT Image 2 won the studio's blind vote for backdrops;
// Nano Banana Pro gives the sharpest full edits (17 MP).
const DEFAULT_MODEL = { fondo: "gpt", completa: "nbpro" };

const editWithRetries = async ({
  log,
  mode,
  model,
  portrait,
  prompt,
  spend,
  working,
}) => {
  const attempts = [];
  let cost = 0;

  for (let attempt = 1; attempt <= EDIT_ATTEMPTS; attempt += 1) {
    log(`edit ${model} ${attempt}`);

    try {
      const { result, seconds } = await timed(() =>
        MODELS[model].edit(mode, { image: working, portrait, prompt })
      );
      cost += spend(result.cost);
      const alignment = await estimateAlignment(working, result.image);

      if (!isReframed(alignment)) {
        attempts.push({ ok: true, alignment, seconds });
        return { model, attempts, alignment, cost, output: result.image };
      }

      attempts.push({ ok: false, reason: "reframed", alignment, seconds });
    } catch (error) {
      attempts.push({ ok: false, reason: String(error.message ?? error) });
    }
  }

  const reasons = attempts.map((attempt) => attempt.reason).join("; ");
  throw Object.assign(
    new Error(
      `${MODELS[model].label} no devolvió una imagen válida en ${EDIT_ATTEMPTS} intentos (${reasons}).`
    ),
    { attempts }
  );
};

/** Montage at full size and the reviewer's verdict for one model output. */
const finish = async ({
  analysis,
  boxes,
  edit,
  mode,
  original,
  person,
  spend,
  working,
}) => {
  const composite = await compositeBackground({
    alignment: edit.alignment,
    mode: mode === "completa" ? "rostros" : "completo",
    original,
    output: edit.output,
    person,
    workingCopy: working,
    zones: boxes,
  });
  const review = await reviewResult(
    original,
    composite.final,
    analysis.fixes,
    mode === "completa" ? fullReviewPrompt : reviewPrompt
  );
  spend(review.cost);
  return { ...edit, composite, review };
};

/** Highest reviewer score; on a tie, the mode's usual model. */
const best = (candidates, mode) =>
  [...candidates].sort(
    (a, b) =>
      b.review.score - a.review.score ||
      Number(b.model === DEFAULT_MODEL[mode]) -
        Number(a.model === DEFAULT_MODEL[mode])
  )[0];

/**
 * Level 3: the winner is retouched again with what the reviewer still saw
 * wrong, and kept only if the reviewer likes it at least as much.
 */
const secondPass = async ({ context, log, winner }) => {
  const notes = [...winner.review.remaining, ...winner.review.artifacts].slice(
    0,
    SECOND_PASS_NOTES
  );

  if (notes.length === 0) {
    return winner;
  }

  log("second pass");
  const input = await workingCopy(winner.composite.final, context.edge);
  const prompt = `${context.prompt}

This photo was already retouched once. Still to fix:
${notes.map((note) => `- ${note}`).join("\n")}`;

  try {
    const edit = await editWithRetries({
      ...context,
      log,
      model: winner.model,
      prompt,
      working: input,
    });
    const again = await finish({ ...context, edit });
    return again.review.score >= winner.review.score
      ? { ...again, passes: 2 }
      : { ...winner, passes: 2 };
  } catch (error) {
    log(`second pass failed: ${error.message}`);
    return winner;
  }
};

const runPipeline = async ({ ledger, log, options, original }) => {
  const started = performance.now();
  const spend = ledger.add;
  const mode = options.mode === "completa" ? "completa" : "fondo";
  const level = [1, 2, 3].includes(options.level) ? options.level : 1;
  const edge = mode === "completa" ? FULL_INPUT_EDGE : undefined;

  log("analysis");
  const analysisCopy = await workingCopy(original);
  const analysis = await analyse(analysisCopy);
  spend(analysis.cost);

  if (options.note) {
    analysis.fixes = [...analysis.fixes, options.note];
  }

  log("zones");
  const zones = await locate(analysisCopy, analysis);
  spend(zones.cost);
  const boxes = boxesFromZones(zones);

  if (options.helpers === false) {
    boxes.helpers = [];
  }

  // The models' input: a bigger copy for a full edit.
  const working = edge ? await workingCopy(original, edge) : analysisCopy;
  log("people");
  const person = await personMask(working);
  const context = {
    analysis,
    boxes,
    edge,
    mode,
    original,
    person,
    portrait: await isPortrait(working),
    prompt:
      mode === "completa" ? fullEditPrompt(analysis) : editPrompt(analysis),
    spend,
    working,
  };
  const models =
    level === 1
      ? [MODELS[options.model] ? options.model : DEFAULT_MODEL[mode]]
      : Object.keys(MODELS);

  // The models work at the same time (it is waiting on their APIs); the
  // montages go one after the other (each one holds a 40 MP photo).
  const edits = await Promise.all(
    models.map((model) =>
      editWithRetries({ ...context, log, model }).catch((error) => ({
        model,
        error,
      }))
    )
  );
  const candidates = [];

  for (const edit of edits) {
    if (!edit.error) {
      log(`composite ${edit.model}`);
      candidates.push(await finish({ ...context, edit }));
    }
  }

  if (candidates.length === 0) {
    throw new Error(edits.map((edit) => edit.error.message).join(" "));
  }

  let chosen = best(candidates, mode);

  if (level === 3) {
    chosen = await secondPass({ context, log, winner: chosen });
  }

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
    framed = await applyFraming(chosen.composite.final, framing.suggested);
  }

  const preview = await webPreview(chosen.composite.final);

  return {
    final: chosen.composite.final,
    framed,
    // The original at preview size, to compare before and after.
    before: await webPreview(original),
    preview,
    framedPreview: framed ? await webPreview(framed) : undefined,
    zones: await tintedPreview(preview, chosen.composite.changeMask),
    info: {
      mode,
      level,
      chosen: chosen.model,
      passes: chosen.passes ?? 1,
      candidates: [
        ...candidates.map((candidate) => ({
          model: candidate.model,
          label: MODELS[candidate.model].label,
          score: candidate.review.score,
          comment: candidate.review.comment,
          cost: candidate.cost,
        })),
        ...edits
          .filter((edit) => edit.error)
          .map((edit) => ({
            model: edit.model,
            label: MODELS[edit.model].label,
            error: String(edit.error.message ?? edit.error),
          })),
      ],
      scene: analysis.scene,
      fixes: analysis.fixes,
      keep: analysis.keep,
      risk: analysis.risk,
      zones,
      attempts: chosen.attempts,
      alignment: chosen.alignment,
      changedShare: chosen.composite.changedShare,
      review: chosen.review,
      needsReview: chosen.review.score < REVIEW_THRESHOLD,
      framing,
      costs: { total: ledger.total() },
      seconds: (performance.now() - started) / 1000,
    },
  };
};

/**
 * Cleans one photo: the Editor module's job.
 *
 * @param original full-size photo (JPEG buffer, as exported from Lightroom)
 * @param options.mode "fondo" (backdrop and floor, people original) or
 *   "completa" (everything but the faces)
 * @param options.level 1 one model, 2 both models and the reviewer keeps the
 *   best, 3 like 2 plus a second pass on what is still wrong
 * @param options.model with level 1, "gpt" or "nbpro" (default per mode)
 * @param options.helpers false keeps a helper's hand holding the child
 * @param options.note extra instruction from the studio for a redo
 * @param options.framing true to also straighten and crop in the studio's
 *   usual style, or { examples: [{ image, scene, framing }] } to let the
 *   framing agent follow the studio's own crops
 * @param log progress callback (step name)
 * @returns { final, framed?, before, preview, zones, info } JPEGs + info
 */
export const cleanPhoto = async ({
  original,
  options = {},
  log = () => undefined,
}) => {
  let spent = 0;
  const ledger = {
    add: (cost = 0) => {
      spent += cost;
      return cost;
    },
    total: () => spent,
  };

  try {
    return await runPipeline({ ledger, log, options, original });
  } catch (error) {
    // A failed photo still cost something: the studio's consumption counts it.
    throw Object.assign(
      error instanceof Error ? error : new Error(String(error)),
      { cost: spent }
    );
  }
};
