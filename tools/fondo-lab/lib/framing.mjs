import sharp from "sharp";

/**
 * Framing (straighten + crop), never done by the image model: it is pure
 * geometry applied to the full-size result, so people stay pixel-exact.
 *
 * A framing is { angle, left, top, width, height }: rotate the photo by
 * `angle` degrees (clockwise) about its centre, keeping the canvas size,
 * then crop the box (fractions of the photo's width and height).
 *
 * matchEditorCrop() recovers the studio editor's framing from an edited
 * copy (Lightroom crops without resampling, so the crop has the edited
 * file's pixel size) to learn the studio's style and to score suggestions.
 */

const LEVEL_WIDTH = 160; // coarse search
const FINE_WIDTH = 480; // refinement
const MAX_ANGLE = 5;

export const grey = async (input, width) => {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width })
    .greyscale()
    .extractChannel(0)
    .blur(0.8)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: Float32Array.from(data),
    width: info.width,
    height: info.height,
  };
};

/** The image rotated about its centre on the same canvas (bilinear). */
const rotated = (image, angle) => {
  const { data, width, height } = image;
  const out = new Float32Array(width * height).fill(Number.NaN);
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Inverse mapping: where this output pixel comes from.
      const sx = cos * (x - cx) + sin * (y - cy) + cx;
      const sy = -sin * (x - cx) + cos * (y - cy) + cy;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);

      if (x0 >= 0 && y0 >= 0 && x0 < width - 1 && y0 < height - 1) {
        const fx = sx - x0;
        const fy = sy - y0;
        const i = y0 * width + x0;
        out[y * width + x] =
          data[i] * (1 - fx) * (1 - fy) +
          data[i + 1] * fx * (1 - fy) +
          data[i + width] * (1 - fx) * fy +
          data[i + width + 1] * fx * fy;
      }
    }
  }

  return { data: out, width, height };
};

/** Zero-mean normalised cross-correlation of `patch` placed at (ox, oy). */
const zncc = (image, patch, ox, oy, step) => {
  let n = 0;
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;

  for (let y = 0; y < patch.height; y += step) {
    const row = (y + oy) * image.width + ox;

    for (let x = 0; x < patch.width; x += step) {
      const a = image.data[row + x];

      if (!Number.isNaN(a)) {
        const b = patch.data[y * patch.width + x];
        n += 1;
        sa += a;
        sb += b;
        saa += a * a;
        sbb += b * b;
        sab += a * b;
      }
    }
  }

  const cov = sab - (sa * sb) / n;
  const va = saa - (sa * sa) / n;
  const vb = sbb - (sb * sb) / n;
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : -1;
};

const search = ({ image, patch, angles, xs, ys, step }) => {
  let best = { score: -2 };

  for (const angle of angles) {
    const turned = rotated(image, angle);

    for (const oy of ys) {
      for (const ox of xs) {
        if (
          ox >= 0 &&
          oy >= 0 &&
          ox + patch.width <= image.width &&
          oy + patch.height <= image.height
        ) {
          const score = zncc(turned, patch, ox, oy, step);

          if (score > best.score) {
            best = { score, angle, ox, oy };
          }
        }
      }
    }
  }

  return best;
};

const range = (from, to, step) => {
  const values = [];

  for (let v = from; v <= to + 1e-9; v += step) {
    values.push(Math.round(v * 1000) / 1000);
  }

  return values;
};

// Below this correlation the export was probably resized: search the scale.
const SURE_MATCH = 0.9;

/** Coarse search (half degrees, every pixel at 160 px) for one crop width. */
const coarseMatch = async (coarse, edited, width) => {
  const patch = await grey(
    edited,
    Math.max(8, Math.round(width * coarse.width))
  );

  if (patch.width > coarse.width || patch.height > coarse.height) {
    return { score: -2 };
  }

  const best = search({
    image: coarse,
    patch,
    angles: range(-MAX_ANGLE, MAX_ANGLE, 0.5),
    xs: range(0, coarse.width - patch.width, 1),
    ys: range(0, coarse.height - patch.height, 1),
    step: 2,
  });
  return { ...best, width };
};

/**
 * The editor's framing of `edited` inside `original` (both paths).
 * Returns { angle, left, top, width, height, score } (score = correlation).
 */
export const matchEditorCrop = async (original, edited) => {
  const [o, e] = await Promise.all([
    sharp(original).rotate().metadata(),
    sharp(edited).rotate().metadata(),
  ]);
  const ow = o.autoOrient?.width ?? o.width;
  const oh = o.autoOrient?.height ?? o.height;
  const ew = e.autoOrient?.width ?? e.width;
  const eh = e.autoOrient?.height ?? e.height;
  // Height as a share of the photo for a crop `width` wide (edited aspect).
  const heightFor = (width) => (width * ow * eh) / (ew * oh);

  // Usually the crop keeps the original pixels (edited size = crop size);
  // if that does not match, the export was resized: try smaller crops.
  const coarse = await grey(original, LEVEL_WIDTH);
  let first = await coarseMatch(coarse, edited, Math.min(1, ew / ow));

  if (first.score < SURE_MATCH) {
    for (const width of range(0.6, 1, 0.025)) {
      if (heightFor(width) <= 1) {
        const candidate = await coarseMatch(coarse, edited, width);
        first = candidate.score > first.score ? candidate : first;
      }
    }
  }

  // Fine: a tenth of a degree, around the coarse answer at 480 px.
  const fine = await grey(original, FINE_WIDTH);
  const finePatch = await grey(
    edited,
    Math.max(8, Math.round(first.width * fine.width))
  );
  const k = fine.width / coarse.width;
  const second = search({
    image: fine,
    patch: finePatch,
    angles: range(first.angle - 0.5, first.angle + 0.5, 0.1),
    xs: range(Math.round(first.ox * k) - 4, Math.round(first.ox * k) + 4, 1),
    ys: range(Math.round(first.oy * k) - 4, Math.round(first.oy * k) + 4, 1),
    step: 2,
  });

  return {
    angle: second.angle,
    left: second.ox / fine.width,
    top: second.oy / fine.height,
    width: finePatch.width / fine.width,
    height: finePatch.height / fine.height,
    score: second.score,
  };
};

const TILT_WIDTH = 1024;
const TILT_RANGE = 6; // degrees searched each way
const TILT_STEP = 0.1;
const LINE_MIN = 0.12; // a line covers at least this share of the height
const MAX_LINES = 40;
// A real line loses most votes when the angle is off by 1.5°; a textured
// blob (flowers, a sign) does not.
const LINE_SHARPNESS = 1.8;
const MAX_SPREAD = 1; // degrees: lines that disagree more mean no tilt

/** Vertical-ish edge points on the background (people excluded). */
export const verticalEdges = (image, people) => {
  const { width, height, data } = image;
  const points = { xs: [], ys: [] };

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx =
        data[i - width + 1] +
        2 * data[i + 1] +
        data[i + width + 1] -
        data[i - width - 1] -
        2 * data[i - 1] -
        data[i + width - 1];
      const gy =
        data[i + width - 1] +
        2 * data[i + width] +
        data[i + width + 1] -
        data[i - width - 1] -
        2 * data[i - width] -
        data[i - width + 1];

      if (
        Math.abs(gx) > 60 &&
        Math.abs(gx) > 4 * Math.abs(gy) &&
        people[i] < 20
      ) {
        points.xs.push(x - width / 2);
        points.ys.push(y - height / 2);
      }
    }
  }

  return points;
};

/** Long straight near-vertical lines (Hough), strongest first. */
export const houghLines = ({ xs, ys }, width, height) => {
  const angles = range(-TILT_RANGE, TILT_RANGE, TILT_STEP);
  const bins = width * 2;
  const votes = angles.map(() => new Uint16Array(bins));
  const trig = angles.map((angle) => {
    const rad = (angle * Math.PI) / 180;
    return [Math.cos(rad), Math.sin(rad)];
  });

  for (let k = 0; k < xs.length; k += 1) {
    for (let a = 0; a < angles.length; a += 1) {
      const rho = Math.round(trig[a][0] * xs[k] - trig[a][1] * ys[k] + width);

      if (rho >= 0 && rho < bins) {
        votes[a][rho] += 1;
      }
    }
  }

  // Peaks above the minimum length, with non-maximum suppression.
  const lines = [];
  const minVotes = LINE_MIN * height;

  const offset = Math.round(1.5 / TILT_STEP);
  const nearbyMax = (a, rho) => {
    let best = 0;

    for (const other of [a - offset, a + offset]) {
      if (other >= 0 && other < angles.length) {
        for (let r = rho - 6; r <= rho + 6; r += 1) {
          best = Math.max(best, votes[other][r] ?? 0);
        }
      }
    }

    return best;
  };

  for (let a = 0; a < angles.length; a += 1) {
    for (let rho = 1; rho < bins - 1; rho += 1) {
      const v = votes[a][rho];

      if (v >= minVotes && v >= LINE_SHARPNESS * nearbyMax(a, rho)) {
        lines.push({ angle: angles[a], rho, votes: v });
      }
    }
  }

  lines.sort((p, q) => q.votes - p.votes);
  const kept = [];

  for (const line of lines) {
    const near = kept.some(
      (other) =>
        Math.abs(other.rho - line.rho) <= 6 &&
        Math.abs(other.angle - line.angle) <= 1.5
    );

    if (!near) {
      kept.push(line);
    }

    if (kept.length >= MAX_LINES) {
      break;
    }
  }

  return kept;
};

const weightedMedian = (items) => {
  const sorted = [...items].sort((p, q) => p.value - q.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  let seen = 0;

  for (const item of sorted) {
    seen += item.weight;

    if (seen >= total / 2) {
      return item.value;
    }
  }

  return 0;
};

/**
 * Straightening angle from the long vertical lines of the background
 * (mouldings, backdrop edges, hanging ropes), people excluded: the weighted
 * median angle of the lines, as the rotation that makes them vertical.
 * Returns 0 without enough lines (plain paper) or when they disagree.
 */
export const estimateTilt = async (input, personPng, props = []) => {
  const image = await grey(input, TILT_WIDTH);
  const people = await sharp(personPng)
    .resize(image.width, image.height, { fit: "fill" })
    .extractChannel(0)
    .raw()
    .toBuffer();

  // Props (flowers, signs, balloons) are not reliable verticals either.
  for (const [y0, x0, y1, x1] of props) {
    for (
      let y = Math.floor((y0 / 1000) * image.height);
      y < (y1 / 1000) * image.height;
      y += 1
    ) {
      people.fill(
        255,
        y * image.width + Math.floor((x0 / 1000) * image.width),
        y * image.width + Math.ceil((x1 / 1000) * image.width)
      );
    }
  }
  const lines = houghLines(
    verticalEdges(image, people),
    image.width,
    image.height
  );

  if (lines.length < 3) {
    return { angle: 0, lines: lines.length, spread: 0 };
  }

  const angle = weightedMedian(
    lines.map((line) => ({ value: line.angle, weight: line.votes }))
  );
  const spread = weightedMedian(
    lines.map((line) => ({
      value: Math.abs(line.angle - angle),
      weight: line.votes,
    }))
  );

  return {
    angle: spread <= MAX_SPREAD ? angle : 0,
    lines: lines.length,
    spread,
  };
};

/** Intersection over union of two framings' boxes (angles ignored). */
export const overlap = (a, b) => {
  const x0 = Math.max(a.left, b.left);
  const y0 = Math.max(a.top, b.top);
  const x1 = Math.min(a.left + a.width, b.left + b.width);
  const y1 = Math.min(a.top + a.height, b.top + b.height);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return inter / (a.width * a.height + b.width * b.height - inter);
};

export const boxToFraming = ([y0, x0, y1, x1], angle = 0) => ({
  angle,
  left: x0 / 1000,
  top: y0 / 1000,
  width: (x1 - x0) / 1000,
  height: (y1 - y0) / 1000,
});

export const framingToBox = (framing) =>
  [
    framing.top,
    framing.left,
    framing.top + framing.height,
    framing.left + framing.width,
  ].map((value) => Math.round(value * 1000));

/**
 * Small JPEG of the photo with framings drawn as rectangles
 * ([{ framing, colour }]), for the framing agent's examples and the report.
 */
export const drawFramings = async (input, framings, longEdge = 640) => {
  const base = await sharp(input)
    .rotate()
    .resize({ width: longEdge, height: longEdge, fit: "inside" })
    .jpeg({ quality: 85 })
    .toBuffer();
  const { width, height } = await sharp(base).metadata();
  const stroke = Math.max(3, Math.round(width / 160));
  const rects = framings
    .map(
      ({ framing, colour }) =>
        `<rect x="${framing.left * width}" y="${framing.top * height}" width="${framing.width * width}" height="${framing.height * height}" fill="none" stroke="${colour}" stroke-width="${stroke}"/>`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects}</svg>`;

  return sharp(base)
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 85 })
    .toBuffer();
};

/** Shrinks the box about its centre until it fits the rotated photo. */
const fitInside = (framing, width, height) => {
  const rad = (framing.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const fits = ({ left, top, width: w, height: h }) =>
    [
      [left, top],
      [left + w, top],
      [left, top + h],
      [left + w, top + h],
    ].every(([fx, fy]) => {
      const x = (fx - 0.5) * width;
      const y = (fy - 0.5) * height;
      // Back to the unrotated photo: it must land inside it.
      const sx = cos * x + sin * y;
      const sy = -sin * x + cos * y;
      return Math.abs(sx) <= width / 2 && Math.abs(sy) <= height / 2;
    });
  let box = { ...framing };

  for (let k = 0; k < 60 && !fits(box); k += 1) {
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    box = {
      ...box,
      width: box.width * 0.99,
      height: box.height * 0.99,
      left: cx - (box.width * 0.99) / 2,
      top: cy - (box.height * 0.99) / 2,
    };
  }

  return box;
};

/**
 * Applies a framing to a full-size photo: rotate about the centre, then
 * crop (shrunk if needed so no empty corner shows). JPEG at full quality.
 */
export const applyFraming = async (input, framing) => {
  const { data, info } = await sharp(input)
    .rotate()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const box = fitInside(framing, info.width, info.height);
  let image = { data, info };

  if (framing.angle) {
    image = await sharp(data, { raw: info })
      .rotate(framing.angle, { background: "#000000" })
      .raw()
      .toBuffer({ resolveWithObject: true });
  }

  // The rotated canvas grows; the photo's own canvas sits in its centre.
  const ox = (image.info.width - info.width) / 2;
  const oy = (image.info.height - info.height) / 2;
  const left = Math.max(0, Math.round(ox + box.left * info.width));
  const top = Math.max(0, Math.round(oy + box.top * info.height));

  return sharp(image.data, { raw: image.info })
    .extract({
      left,
      top,
      width: Math.min(
        image.info.width - left,
        Math.round(box.width * info.width)
      ),
      height: Math.min(
        image.info.height - top,
        Math.round(box.height * info.height)
      ),
    })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
};
