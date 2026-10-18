/**
 * Instructions for the analysis step (cheap vision model) and the edit step
 * (image models). The edit prompt is the same for every model so the
 * comparison is fair; the analysis only adds what this photo needs.
 */

export const ANALYSIS_PROMPT = `You are the retouching assistant of a portrait photography studio.
Look at this unedited studio photo and describe ONLY the backdrop/floor work a retoucher would do.

Return JSON with:
- "scene": short name of the set in Spanish (e.g. "papel marrón", "pared blanca con molduras", "fondo blanco infinito", "set temático de dinosaurios").
- "fixes": list (in English, imperative, concrete, with position in the frame) of backdrop and floor problems to fix: wrinkles, creases, seams, stains, scuffs, footprints, dust, a different backdrop or wall visible at an edge, the studio floor visible beyond the backdrop, light stands, umbrellas, softboxes, cables, clamps, sandbags, tape.
- "keep": list (in English) of props and decorations that are part of the scene and must stay exactly as they are (furniture, flowers, plants, balloons, toys, cake, fabrics, signs, lights in the set).
- "risk": one of "low", "medium", "high": how hard it is to edit the backdrop without touching people or props.

Never list anything about the people (skin, hair, clothes, poses): they are out of scope.
The one exception: a hand or arm of a helper (a parent or assistant who is not otherwise in the photo) entering the frame to hold or steady a child. List it as a fix that starts with "Remove the helper's", e.g. "Remove the helper's hand holding the baby's back from the left edge".`;

export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    scene: { type: "string" },
    fixes: { type: "array", items: { type: "string" } },
    keep: { type: "array", items: { type: "string" } },
    risk: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["scene", "fixes", "keep", "risk"],
};

/**
 * Second look: where each fix and each prop is, as boxes. The composite only
 * takes model pixels inside fix boxes and never inside prop boxes, so props
 * the model redraws (flowers, balloons…) stay original.
 */
export const zonesPrompt = ({ fixes, keep }) =>
  `This is a studio photo. Locate each item below with a bounding box "box_2d" as [ymin, xmin, ymax, xmax] normalised to 0-1000. Boxes for problems should be tight around the area to retouch (for a whole-backdrop problem, cover only the backdrop area where it is visible). Boxes for props should cover the whole prop.

Problems to retouch:
${fixes.map((fix, index) => `${index + 1}. ${fix}`).join("\n")}

Props to keep:
${keep.map((item, index) => `${index + 1}. ${item}`).join("\n") || "(none)"}

For each problem also give "kind": "remove" for objects, strips, gaps or areas to extend (light stands, another backdrop visible, the room floor), "smooth" for surface work (wrinkles, creases, seams, stains, scuffs, dust, reflections, uneven tone), "helper" for the hand or arm of a helper (parent or assistant) holding or steadying a child; its box must cover the whole visible hand and arm, including where it touches the child.

Also give "faces": one box per visible face of any person in the photo (faces are never retouched).

Return JSON {"fixes": [{"index", "box_2d", "kind"}], "keep": [{"index", "box_2d"}], "faces": [{"box_2d"}]} with the same numbering.`;

const box = { type: "array", items: { type: "number" } };

export const ZONES_SCHEMA = {
  type: "object",
  properties: {
    fixes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          box_2d: box,
          kind: { type: "string", enum: ["remove", "smooth", "helper"] },
        },
        required: ["index", "box_2d", "kind"],
      },
    },
    keep: {
      type: "array",
      items: {
        type: "object",
        properties: { index: { type: "integer" }, box_2d: box },
        required: ["index", "box_2d"],
      },
    },
    faces: {
      type: "array",
      items: {
        type: "object",
        properties: { box_2d: box },
        required: ["box_2d"],
      },
    },
  },
  required: ["fixes", "keep", "faces"],
};

/** Reviewer: compares the original and the retouched version. */
export const reviewPrompt = (fixes) =>
  `Image 1 is an unedited studio portrait. Image 2 is the same photo after an automatic backdrop retouch.
The retouch was asked to fix:
${fixes.map((fix) => `- ${fix}`).join("\n")}

Judge only the backdrop and floor work, as a demanding studio owner would:
- which requested fixes are done and which remain,
- artifacts: blur or soft patches next to sharp areas, smears, repeated patterns, broken or bent lines, halos or leftovers around people, props that changed or vanished, colour patches,
- whether people look untouched.

Return JSON: "score" 1-10 (10 = ready to deliver), "remaining" (list, English), "artifacts" (list, English), "comment" (one or two sentences in Spanish for the studio).`;

export const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    remaining: { type: "array", items: { type: "string" } },
    artifacts: { type: "array", items: { type: "string" } },
    comment: { type: "string" },
  },
  required: ["score", "remaining", "artifacts", "comment"],
};

const list = (items) => items.map((item) => `- ${item}`).join("\n");

export const editPrompt = ({ fixes, keep }) =>
  `This is a professional studio portrait. Retouch ONLY the studio backdrop and the floor.

Fix these problems:
${list(fixes.length ? fixes : ["Remove wrinkles, creases, seams, stains, scuffs and dust from the backdrop and floor."])}
- In general: remove photography equipment (light stands, umbrellas, softboxes, cables, clamps, tape) and, where another backdrop, wall or the room floor shows at an edge, extend the main backdrop seamlessly so it fills the frame.

Keep exactly as they are:
${list([...keep, "every person: faces, skin, hair, bodies, hands, clothes and poses (except a helper's hand or arm listed above: remove it and rebuild the child's skin and clothes where it touched them)", "natural shadows and reflections of people and props on the floor"])}

Keep the backdrop's own color, gradient, lighting and texture natural and consistent.
Keep the exact same framing, camera angle, composition and image proportions. Do not crop, zoom, shift, add or remove anything else. Do not change colors or exposure of the rest of the photo.`;
