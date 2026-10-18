import sharp from "sharp";

/**
 * Image models redraw the whole frame and may scale or shift it a little.
 * Before reusing their background we find the uniform scale + translation
 * that maps the model output onto the original (both stretched to the same
 * canvas first), by brute force on small grayscale copies, coarse to fine.
 */

const gray = async (input, width, height) => {
  const { data } = await sharp(input)
    .resize(width, height, { fit: "fill" })
    .greyscale()
    // greyscale() keeps three identical bands; keep one.
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Float32Array.from(data);
};

const sample = (image, width, height, x, y) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);

  if (x0 < 0 || y0 < 0 || x0 >= width - 1 || y0 >= height - 1) {
    return null;
  }

  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * width + x0;
  const top = image[i] * (1 - fx) + image[i + 1] * fx;
  const bottom = image[i + width] * (1 - fx) + image[i + width + 1] * fx;
  return top * (1 - fy) + bottom * fy;
};

/** Mean absolute difference after mapping `moving` with scale s and shift. */
const error = (fixed, moving, width, height, { dx, dy, s }, weight) => {
  const cx = width / 2;
  const cy = height / 2;
  let sum = 0;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const w = weight ? weight[y * width + x] : 1;

      if (w === 0) {
        continue;
      }

      const value = sample(
        moving,
        width,
        height,
        (x - cx - dx) / s + cx,
        (y - cy - dy) / s + cy
      );

      if (value !== null) {
        sum += Math.abs(value - fixed[y * width + x]) * w;
        count += w;
      }
    }
  }

  return count ? sum / count : Number.POSITIVE_INFINITY;
};

const search = (fixed, moving, width, height, center, steps, weight) => {
  let best = {
    ...center,
    err: error(fixed, moving, width, height, center, weight),
  };

  for (const s of steps.s.map((v) => center.s + v)) {
    for (const dx of steps.d.map((v) => center.dx + v)) {
      for (const dy of steps.d.map((v) => center.dy + v)) {
        const err = error(fixed, moving, width, height, { dx, dy, s }, weight);

        if (err < best.err) {
          best = { dx, dy, s, err };
        }
      }
    }
  }

  return best;
};

const range = (from, to, step) => {
  const values = [];
  for (let v = from; v <= to + 1e-9; v += step) {
    values.push(Number(v.toFixed(6)));
  }
  return values;
};

/**
 * Returns { s, dx, dy, err, naiveErr } where dx/dy are fractions of the
 * frame (multiply by the target width/height) and err is the mean absolute
 * gray difference (0–255) at 512 px. `weight` (optional, 512-px grid,
 * 0–1) restricts the measure to the people, which the model should not move.
 */
export const estimateAlignment = async (original, output, weightAt512) => {
  const meta = await sharp(original).metadata();
  const portrait = meta.height > meta.width;
  const big = portrait
    ? { width: 342, height: 512 }
    : { width: 512, height: 342 };
  const small = {
    width: Math.round(big.width / 4),
    height: Math.round(big.height / 4),
  };

  const [fixedSmall, movingSmall, fixedBig, movingBig] = await Promise.all([
    gray(original, small.width, small.height),
    gray(output, small.width, small.height),
    gray(original, big.width, big.height),
    gray(output, big.width, big.height),
  ]);

  const identity = { s: 1, dx: 0, dy: 0 };
  const naiveErr = error(
    fixedBig,
    movingBig,
    big.width,
    big.height,
    identity,
    weightAt512
  );
  const coarse = search(
    fixedSmall,
    movingSmall,
    small.width,
    small.height,
    identity,
    {
      s: range(-0.12, 0.12, 0.01),
      d: range(-12, 12, 1),
    }
  );
  const scaled = { s: coarse.s, dx: coarse.dx * 4, dy: coarse.dy * 4 };
  const fine = search(
    fixedBig,
    movingBig,
    big.width,
    big.height,
    scaled,
    {
      s: range(-0.008, 0.008, 0.002),
      d: range(-4, 4, 1),
    },
    weightAt512
  );

  return {
    s: fine.s,
    dx: fine.dx / big.width,
    dy: fine.dy / big.height,
    err: fine.err,
    naiveErr,
  };
};
