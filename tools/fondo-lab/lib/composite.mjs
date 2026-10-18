import sharp from "sharp";

/**
 * Full-resolution result that never takes the people from the model:
 *
 *   final = original, except where the model really changed the background
 *           (stains, strips, stands…), which come from the model output,
 *           scaled up, aligned and colour-matched; people always original.
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

/** Keeps weak changes only when connected to a strong one (flood fill). */
const hysteresis = (diff, width, height) => {
  const out = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < diff.length; i += 1) {
    if (diff[i] >= STRONG) {
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
      if (n >= 0 && n < diff.length && out[n] === 0 && diff[n] >= WEAK) {
        out[n] = 255;
        queue[tail] = n;
        tail += 1;
      }
    }
  }

  return Buffer.from(out.buffer);
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
  const grown = await blurBand(
    hysteresis(smooth, width, height),
    width,
    height,
    GROW_SIGMA
  );

  for (let i = 0; i < grown.length; i += 1) {
    grown[i] = grown[i] > 40 ? 255 : 0;
  }

  return blurBand(grown, width, height, FEATHER_SIGMA);
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

/**
 * Decides, on the working copy, where to use model pixels. Returns the
 * colour offset for the model output and the change mask (one band, PNG).
 * zones (optional): { fixes: [box], smooth: [box], keep: [box] } in 0–1000
 * units; "smooth" boxes are also fix boxes.
 */
const decide = async ({ aligned, original, person, width, height, zones }) => {
  const [orig, ai, origLow, aiLow, personMask] = await Promise.all([
    rgb(original, width, height),
    rgb(aligned, width, height),
    rgb(original, width, height, PROP_SIGMA),
    rgb(aligned, width, height, PROP_SIGMA),
    sharp(person)
      .resize(width, height, { fit: "fill" })
      .extractChannel(0)
      .raw()
      .toBuffer(),
  ]);
  const images = { orig, ai, origLow, aiLow, personMask };
  const offsets = colourOffsets(orig, ai, personMask, width * height);
  const areas = {
    inFix: zones?.fixes?.length
      ? boxMask(zones.fixes, width, height, BOX_MARGIN)
      : new Uint8Array(width * height).fill(1),
    inProp: boxMask(zones?.keep ?? [], width, height),
  };

  const mask = await changeRegions(images, offsets, areas, width, height);
  await addSmoothZones(
    mask,
    images,
    offsets,
    areas,
    zones?.smooth,
    width,
    height
  );

  // People always win: subtract the (soft) person mask.
  let changed = 0;

  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = Math.round((mask[i] * (255 - personMask[i])) / 255);
    changed += mask[i] > 127 ? 1 : 0;
  }

  return {
    offsets,
    changedShare: changed / mask.length,
    mask: await sharp(mask, { raw: { width, height, channels: 1 } })
      .png()
      .toBuffer(),
  };
};

/**
 * @param original full-size original (path or buffer)
 * @param workingCopy the model input (path or buffer)
 * @param output model output (path or buffer)
 * @param person person mask PNG (any size)
 * @param alignment { s, dx, dy } from estimateAlignment
 * @param zones optional { fixes, smooth, keep } boxes from the zones step
 * @returns { final (JPEG, full size), changeMask (PNG, working size), offsets, changedShare }
 */
export const compositeBackground = async ({
  alignment,
  original,
  output,
  person,
  workingCopy,
  zones,
}) => {
  const working = await sharp(workingCopy).metadata();
  const decision = await decide({
    aligned: await warp(output, working.width, working.height, alignment),
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
    warp(output, width, height, alignment).then((image) =>
      sharp(image).linear([1, 1, 1], decision.offsets).raw().toBuffer()
    ),
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

  const final = await sharp(original)
    .rotate()
    .composite([{ input: patch }])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return {
    final,
    changeMask: decision.mask,
    offsets: decision.offsets,
    changedShare: decision.changedShare,
  };
};
