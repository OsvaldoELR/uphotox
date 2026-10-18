import sharp from "sharp";
import { personMask as segmentPeople } from "./segment.mjs";

/**
 * Full-resolution result that never takes the people from the model.
 * Two modes:
 *
 * - "zonas": final = original, except where the model really changed the
 *   background inside the problem boxes (stains, strips, stands…), which
 *   come from the model output, scaled up, aligned and colour-matched.
 * - "completo" (default in the lab): the whole background comes from the
 *   model; only the people (the original ones and the ones the model drew,
 *   so no ghost edge) and the props it merely redrew stay original. A
 *   low-frequency colour match keeps the original light, so the edge around
 *   the people does not show.
 *
 * In both modes a helper's hand or arm holding a child, or a whole person
 * the studio asked to remove (a "helper" box), is the one part of a person
 * taken from the model.
 *
 * The decision is taken on the small working copy (the model input size)
 * and applied to the full-size original with libvips (sharp).
 *
 * Note: a sharp pipeline applies each operation once, in its own order, so
 * every mask step below is a separate call that returns one band.
 */

// Change detection on the working copy (0–255 difference after a light blur).
const WEAK = 12; // part of a change region if connected to a strong change
const STRONG = 30; // certainly changed by the model
const NOISE_SIGMA = 1.2; // smooths the difference map before thresholding
const GROW_SIGMA = 3; // grows regions a little past their edge
const FEATHER_SIGMA = 2.5; // soft transition between model and original
// Inside a prop box only big, low-frequency changes count (a blue strip
// turned white), not the model redrawing leaves or balloons.
const PROP_SIGMA = 6;
const PROP_THRESHOLD = 28;
const BOX_MARGIN = 15; // grow fix boxes by this many thousandths
// "smooth" zones (wrinkles, seams, stains…) are small, spread-out changes the
// thresholds would discard: there the model output is taken as a whole.
const SMOOTH_FEATHER_SIGMA = 10;
// "completo" mode.
const PROTECT_GROW_SIGMA = 3; // keeps a thin band of original around people
const PROTECT_FEATHER_SIGMA = 3;
const MATCH_CELL = 8; // colour match grid cell, in working pixels
const MATCH_SIGMA = 0.05; // colour match smoothing, share of the long edge
const MATCH_LIMIT = 28; // larger differences are real changes, not light
const MATCH_PRIOR = 4; // pulls empty grid areas to the global offset
// Helper hands (a parent's hand holding the child), both modes.
const HELPER_MARGIN = 20; // grow helper boxes by this many thousandths
const HELPER_SEED_SIGMA = 4; // ignores thin slivers where the masks disagree
const HELPER_CHANGE = 24; // person pixels the model clearly redrew
// The model redraws the child's hand that held the helper a little
// elsewhere: grow far enough to take that hand whole (no double hand).
const HELPER_GROW = 0.012; // share of the long edge (blur sigma)
const HELPER_FEATHER_SIGMA = 6;
const FACE_MARGIN = 10; // faces never come from the model (thousandths)

const raw = async (pipeline) => {
  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info };
};

/** One-band blur, checked: never trust the band count of a sharp output. */
const blurBand = async (data, width, height, sigma) => {
  const out = await sharp(data, { raw: { width, height, channels: 1 } })
    .blur(sigma)
    .extractChannel(0)
    .raw()
    .toBuffer();

  if (out.length !== width * height) {
    throw new Error(
      `blurBand: expected ${width * height} values, got ${out.length}`
    );
  }

  return out;
};

/**
 * Model output mapped onto a width×height RGB canvas with the alignment.
 * Borders the scaled output does not reach are filled by copying its edge
 * (never left to show the original there).
 */
const warp = async (output, width, height, { s, dx, dy }) => {
  const scaledWidth = Math.round(width * s);
  const scaledHeight = Math.round(height * s);
  const left = Math.round(width / 2 + dx * width - scaledWidth / 2);
  const top = Math.round(height / 2 + dy * height - scaledHeight / 2);
  const srcX = Math.max(0, -left);
  const srcY = Math.max(0, -top);
  const dstX = Math.max(0, left);
  const dstY = Math.max(0, top);
  const cropWidth = Math.min(scaledWidth - srcX, width - dstX);
  const cropHeight = Math.min(scaledHeight - srcY, height - dstY);

  const scaled = await sharp(output)
    .removeAlpha()
    .resize(scaledWidth, scaledHeight, { fit: "fill", kernel: "lanczos3" })
    .png({ compressionLevel: 1 })
    .toBuffer();
  const cropped = await sharp(scaled)
    .extract({ left: srcX, top: srcY, width: cropWidth, height: cropHeight })
    .png({ compressionLevel: 1 })
    .toBuffer();

  return sharp(cropped)
    .extend({
      left: dstX,
      top: dstY,
      right: width - dstX - cropWidth,
      bottom: height - dstY - cropHeight,
      extendWith: "copy",
    })
    .removeAlpha()
    .png({ compressionLevel: 1 })
    .toBuffer();
};

const median = (values) => {
  const sorted = Float32Array.from(values).sort();
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

const rgb = async (buffer, width, height, sigma = 1) => {
  const { data, info } = await raw(sharp(buffer).removeAlpha().blur(sigma));

  if (info.channels !== 3 || data.length !== width * height * 3) {
    throw new Error(`rgb: unexpected ${info.channels} bands`);
  }

  return data;
};

/**
 * Flood fill from the pixels where `isSeed` holds, through the 4-connected
 * pixels where `canEnter` holds. Returns a 0/255 band.
 */
const flood = (size, width, isSeed, canEnter) => {
  const out = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < size; i += 1) {
    if (isSeed(i)) {
      out[i] = 255;
      queue[tail] = i;
      tail += 1;
    }
  }

  while (head < tail) {
    const i = queue[head];
    head += 1;
    const x = i % width;
    const neighbours = [
      x > 0 ? i - 1 : -1,
      x < width - 1 ? i + 1 : -1,
      i - width,
      i + width,
    ];

    for (const n of neighbours) {
      if (n >= 0 && n < size && out[n] === 0 && canEnter(n)) {
        out[n] = 255;
        queue[tail] = n;
        tail += 1;
      }
    }
  }

  return Buffer.from(out.buffer);
};

/** Keeps weak changes only when connected to a strong one. */
const hysteresis = (diff, width, height) =>
  flood(
    width * height,
    width,
    (i) => diff[i] >= STRONG,
    (i) => diff[i] >= WEAK
  );

/** Grows a 0/255 band a little past its edge and feathers it. */
const growAndFeather = async (band, width, height) => {
  const grown = await blurBand(band, width, height, GROW_SIGMA);

  for (let i = 0; i < grown.length; i += 1) {
    grown[i] = grown[i] > 40 ? 255 : 0;
  }

  return blurBand(grown, width, height, FEATHER_SIGMA);
};

/** Binary mask (0/1 per pixel) of the union of boxes in 0–1000 units. */
const boxMask = (boxes, width, height, margin = 0) => {
  const mask = new Uint8Array(width * height);

  for (const [y0, x0, y1, x1] of boxes) {
    const left = Math.max(0, Math.floor(((x0 - margin) / 1000) * width));
    const right = Math.min(width, Math.ceil(((x1 + margin) / 1000) * width));
    const top = Math.max(0, Math.floor(((y0 - margin) / 1000) * height));
    const bottom = Math.min(height, Math.ceil(((y1 + margin) / 1000) * height));

    for (let y = top; y < bottom; y += 1) {
      mask.fill(1, y * width + left, y * width + right);
    }
  }

  return mask;
};

const maxChannelDiff = (a, b, offsets, i) => {
  let value = 0;

  for (let channel = 0; channel < 3; channel += 1) {
    value = Math.max(
      value,
      Math.abs(b[i * 3 + channel] + offsets[channel] - a[i * 3 + channel])
    );
  }

  return value;
};

/** Robust colour offset per channel: median difference on background. */
const colourOffsets = (orig, ai, personMask, size) =>
  [0, 1, 2].map((channel) => {
    const values = [];

    for (let i = 0; i < size; i += 7) {
      if (personMask[i] < 20) {
        values.push(orig[i * 3 + channel] - ai[i * 3 + channel]);
      }
    }

    return median(values);
  });

/** A prop pixel the model only redrew (no big low-frequency change). */
const isKeptProp = (images, offsets, inProp, i) =>
  inProp[i] === 1 &&
  maxChannelDiff(images.origLow, images.aiLow, offsets, i) < PROP_THRESHOLD;

/** Change regions inside the fix boxes ("remove" work), feathered. */
const changeRegions = async (images, offsets, areas, width, height) => {
  const diff = Buffer.alloc(width * height);

  for (let i = 0; i < diff.length; i += 1) {
    // Never on people, never outside a problem area.
    const skip =
      images.personMask[i] > 128 ||
      !areas.inFix[i] ||
      isKeptProp(images, offsets, areas.inProp, i);

    if (!skip) {
      diff[i] = Math.min(
        255,
        maxChannelDiff(images.orig, images.ai, offsets, i)
      );
    }
  }

  const smooth = await blurBand(diff, width, height, NOISE_SIGMA);
  return growAndFeather(hysteresis(smooth, width, height), width, height);
};

/** "smooth" zones are taken whole (feathered), props excepted. */
const addSmoothZones = async (
  mask,
  images,
  offsets,
  areas,
  boxes,
  width,
  height
) => {
  if (!boxes?.length) {
    return;
  }

  const area = Buffer.from(boxMask(boxes, width, height).map((v) => v * 255));
  const soft = await blurBand(area, width, height, SMOOTH_FEATHER_SIGMA);

  for (let i = 0; i < mask.length; i += 1) {
    if (!isKeptProp(images, offsets, areas.inProp, i)) {
      mask[i] = Math.max(mask[i], soft[i]);
    }
  }
};

const maskAt = (png, width, height) =>
  sharp(png)
    .resize(width, height, { fit: "fill" })
    .extractChannel(0)
    .raw()
    .toBuffer();

/**
 * People in the original or in the model output, grown a little and
 * feathered: the model's own (slightly different) silhouette never shows.
 */
const protectPeople = async (personMask, modelPeople, width, height) => {
  const union = Buffer.alloc(width * height);

  for (let i = 0; i < union.length; i += 1) {
    union[i] = Math.max(personMask[i], modelPeople[i]);
  }

  const grown = await blurBand(union, width, height, PROTECT_GROW_SIGMA);

  for (let i = 0; i < grown.length; i += 1) {
    grown[i] = grown[i] > 25 ? 255 : 0;
  }

  const soft = await blurBand(grown, width, height, PROTECT_FEATHER_SIGMA);

  for (let i = 0; i < soft.length; i += 1) {
    soft[i] = Math.max(soft[i], union[i]);
  }

  return soft;
};

/**
 * A helper's hand or arm holding the child is the one part of a person that
 * goes. Inside its box: the person pixels that vanished in the model output,
 * plus the connected person pixels the model clearly redrew (the child's
 * skin or clothes under the hand), grown so the child's hand that held it
 * comes whole from the model. Faces always stay original.
 */
const helperRegions = async ({
  boxes,
  faces,
  height,
  images,
  modelPeople,
  offsets,
  width,
}) => {
  const size = width * height;
  const inBox = boxMask(boxes, width, height, HELPER_MARGIN);
  const vanished = Buffer.alloc(size);

  for (let i = 0; i < size; i += 1) {
    if (inBox[i] && images.personMask[i] > 128 && modelPeople[i] < 64) {
      vanished[i] = 255;
    }
  }

  const seeds = await blurBand(vanished, width, height, HELPER_SEED_SIGMA);
  const region = flood(
    size,
    width,
    (i) => seeds[i] > 160,
    (i) =>
      inBox[i] === 1 &&
      (images.personMask[i] > 64 || modelPeople[i] > 64) &&
      maxChannelDiff(images.origLow, images.aiLow, offsets, i) >= HELPER_CHANGE
  );

  const grown = await blurBand(
    region,
    width,
    height,
    HELPER_GROW * Math.max(width, height)
  );
  const inFace = boxMask(faces, width, height, FACE_MARGIN);

  for (let i = 0; i < size; i += 1) {
    grown[i] = (grown[i] > 20 || region[i]) && inBox[i] && !inFace[i] ? 255 : 0;
  }

  const soft = await blurBand(grown, width, height, HELPER_FEATHER_SIGMA);

  for (let i = 0; i < size; i += 1) {
    soft[i] = inFace[i] ? 0 : soft[i];
  }

  return soft;
};

/** Everything but kept props (feathered); people are subtracted later. */
const wholeBackground = (images, offsets, areas, width, height) => {
  const take = Buffer.alloc(width * height, 255);

  for (let i = 0; i < take.length; i += 1) {
    if (isKeptProp(images, offsets, areas.inProp, i)) {
      take[i] = 0;
    }
  }

  return blurBand(take, width, height, FEATHER_SIGMA);
};

/** Separable Gaussian blur of a float grid (in place). */
const blurGrid = (grid, width, height, sigma) => {
  const radius = Math.ceil(sigma * 3);
  const kernel = Float32Array.from({ length: radius * 2 + 1 }, (_, k) =>
    Math.exp(-((k - radius) ** 2) / (2 * sigma * sigma))
  );
  const line = new Float32Array(Math.max(width, height));
  const pass = (count, length, index) => {
    for (let a = 0; a < count; a += 1) {
      for (let b = 0; b < length; b += 1) {
        line[b] = grid[index(a, b)];
      }

      for (let b = 0; b < length; b += 1) {
        let sum = 0;

        for (let k = -radius; k <= radius; k += 1) {
          const at = Math.min(length - 1, Math.max(0, b + k));
          sum += line[at] * kernel[k + radius];
        }

        grid[index(a, b)] = sum;
      }
    }
  };

  pass(height, width, (y, x) => y * width + x);
  pass(width, height, (x, y) => y * width + x);
};

/**
 * Low-frequency colour match (original minus model), estimated only on
 * background the model kept (small differences), as a coarse RGB grid
 * stored as offset + 128. Removed objects get the light of their
 * surroundings; empty areas fall back to the global offset.
 */
const colourField = (images, offsets, keepOut, width, height) => {
  const gridWidth = Math.ceil(width / MATCH_CELL);
  const gridHeight = Math.ceil(height / MATCH_CELL);
  const cells = gridWidth * gridHeight;
  const weight = new Float32Array(cells);
  const sums = [0, 1, 2].map(() => new Float32Array(cells));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const d = [0, 1, 2].map(
        (c) => images.origLow[i * 3 + c] - images.aiLow[i * 3 + c]
      );
      const kept =
        keepOut[i] < 20 &&
        d.every((value, c) => Math.abs(value - offsets[c]) < MATCH_LIMIT);

      if (kept) {
        const cell =
          Math.floor(y / MATCH_CELL) * gridWidth + Math.floor(x / MATCH_CELL);
        weight[cell] += 1;

        for (let c = 0; c < 3; c += 1) {
          sums[c][cell] += d[c];
        }
      }
    }
  }

  const sigma = (MATCH_SIGMA * Math.max(width, height)) / MATCH_CELL;
  blurGrid(weight, gridWidth, gridHeight, sigma);

  for (const sum of sums) {
    blurGrid(sum, gridWidth, gridHeight, sigma);
  }

  const data = Buffer.alloc(cells * 3);

  for (let cell = 0; cell < cells; cell += 1) {
    for (let c = 0; c < 3; c += 1) {
      const value =
        (sums[c][cell] + MATCH_PRIOR * offsets[c]) /
        (weight[cell] + MATCH_PRIOR);
      data[cell * 3 + c] = Math.min(255, Math.max(0, Math.round(value + 128)));
    }
  }

  return { data, width: gridWidth, height: gridHeight };
};

/**
 * Decides, on the working copy, where to use model pixels. Returns the
 * colour offset for the model output (plus a colour field in "completo"
 * mode) and the change mask (one band, PNG).
 * zones (optional): { fixes: [box], smooth: [box], helpers: [box],
 * keep: [box], faces: [box] } in 0–1000 units; "smooth" and "helper" boxes
 * are also fix boxes.
 */
const decide = async ({
  aligned,
  mode,
  modelPeople,
  original,
  person,
  width,
  height,
  zones,
}) => {
  const [orig, ai, origLow, aiLow, personMask] = await Promise.all([
    rgb(original, width, height),
    rgb(aligned, width, height),
    rgb(original, width, height, PROP_SIGMA),
    rgb(aligned, width, height, PROP_SIGMA),
    maskAt(person, width, height),
  ]);
  const images = { orig, ai, origLow, aiLow, personMask };
  const offsets = colourOffsets(orig, ai, personMask, width * height);
  const areas = {
    inFix: zones?.fixes?.length
      ? boxMask(zones.fixes, width, height, BOX_MARGIN)
      : new Uint8Array(width * height).fill(1),
    inProp: boxMask(zones?.keep ?? [], width, height),
  };

  const modelMask = modelPeople
    ? await maskAt(modelPeople, width, height)
    : undefined;
  const helper =
    zones?.helpers?.length && modelMask
      ? await helperRegions({
          boxes: zones.helpers,
          faces: zones.faces ?? [],
          height,
          images,
          modelPeople: modelMask,
          offsets,
          width,
        })
      : undefined;

  let mask;
  let people = personMask;
  let field;

  if (mode === "completo") {
    people = await protectPeople(personMask, modelMask, width, height);
    mask = await wholeBackground(images, offsets, areas, width, height);
  } else {
    mask = await changeRegions(images, offsets, areas, width, height);
    await addSmoothZones(
      mask,
      images,
      offsets,
      areas,
      zones?.smooth,
      width,
      height
    );
  }

  // A helper's hand comes from the model, even over the child.
  if (helper) {
    people = Buffer.from(people);

    for (let i = 0; i < mask.length; i += 1) {
      people[i] = Math.round((people[i] * (255 - helper[i])) / 255);
      mask[i] = Math.max(mask[i], helper[i]);
    }
  }

  if (mode === "completo") {
    field = colourField(images, offsets, people, width, height);
  }

  // People always win: subtract the (soft) person mask.
  let changed = 0;

  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = Math.round((mask[i] * (255 - people[i])) / 255);
    changed += mask[i] > 127 ? 1 : 0;
  }

  return {
    offsets,
    field,
    changedShare: changed / mask.length,
    mask: await sharp(mask, { raw: { width, height, channels: 1 } })
      .png()
      .toBuffer(),
  };
};

/** Model output at full size with the colour correction applied. */
const correctedColour = async (output, width, height, alignment, decision) => {
  const image = await warp(output, width, height, alignment);

  if (!decision.field) {
    return sharp(image).linear([1, 1, 1], decision.offsets).raw().toBuffer();
  }

  const [colour, field] = await Promise.all([
    sharp(image).raw().toBuffer(),
    sharp(decision.field.data, {
      raw: {
        width: decision.field.width,
        height: decision.field.height,
        channels: 3,
      },
    })
      .resize(width, height, { fit: "fill", kernel: "cubic" })
      .raw()
      .toBuffer(),
  ]);
  // A clamped view: values past 0–255 saturate instead of wrapping.
  const out = new Uint8ClampedArray(
    colour.buffer,
    colour.byteOffset,
    colour.length
  );

  for (let i = 0; i < out.length; i += 1) {
    out[i] = colour[i] + field[i] - 128;
  }

  return colour;
};

/**
 * @param original full-size original (path or buffer)
 * @param workingCopy the model input (path or buffer)
 * @param output model output (path or buffer)
 * @param person person mask PNG (any size)
 * @param alignment { s, dx, dy } from estimateAlignment
 * @param zones optional { fixes, smooth, helpers, keep, faces } boxes from the zones step
 * @param mode "zonas" (default) or "completo" (whole background from the model)
 * @returns { final (JPEG, full size), changeMask (PNG, working size), offsets, changedShare }
 */
export const compositeBackground = async ({
  alignment,
  mode = "zonas",
  original,
  output,
  person,
  workingCopy,
  zones,
}) => {
  const working = await sharp(workingCopy).metadata();
  const aligned = await warp(output, working.width, working.height, alignment);
  const decision = await decide({
    aligned,
    mode,
    modelPeople:
      mode === "completo" || zones?.helpers?.length
        ? await segmentPeople(aligned)
        : undefined,
    original: await sharp(workingCopy).png().toBuffer(),
    person,
    width: working.width,
    height: working.height,
    zones,
  });

  const full = await sharp(original).rotate().metadata();
  const width = full.autoOrient?.width ?? full.width;
  const height = full.autoOrient?.height ?? full.height;
  const [colour, alpha] = await Promise.all([
    correctedColour(output, width, height, alignment, decision),
    sharp(decision.mask)
      .resize(width, height, { fit: "fill", kernel: "cubic" })
      .extractChannel(0)
      .raw()
      .toBuffer(),
  ]);

  if (colour.length !== width * height * 3 || alpha.length !== width * height) {
    throw new Error("composite: unexpected buffer sizes");
  }

  const patch = await sharp(colour, { raw: { width, height, channels: 3 } })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png({ compressionLevel: 1 })
    .toBuffer();

  // Camera data (EXIF) and colour profile travel with the result, so
  // Lightroom treats it like the original.
  const final = await sharp(original)
    .rotate()
    .composite([{ input: patch }])
    .keepExif()
    .keepIccProfile()
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return {
    final,
    changeMask: decision.mask,
    offsets: decision.offsets,
    changedShare: decision.changedShare,
  };
};
