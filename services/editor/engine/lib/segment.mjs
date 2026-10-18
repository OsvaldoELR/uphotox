import path from "node:path";
import { fileURLToPath } from "node:url";
import ort from "onnxruntime-node";
import sharp from "sharp";

/**
 * Soft person mask, computed locally on the CPU.
 *
 * - "modnet" (default): MODNet portrait matting, Apache-2.0, 25 MB, little
 *   memory. Good enough for the lab.
 * - "birefnet" / "portrait": BiRefNet lite / portrait, MIT, better edges, but
 *   its decoder needs several GB of memory (the production choice, on a
 *   server). Pick with FONDO_LAB_MASK.
 *
 * Returns a single-channel PNG (0–255) at the model's working size; callers
 * resize it to whatever they need.
 */

const MODELS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "models"
);

const MODELS = {
  modnet: {
    file: "modnet.onnx",
    input: "input",
    output: "output",
    longEdge: 1024,
    mean: [0.5, 0.5, 0.5],
    std: [0.5, 0.5, 0.5],
    sigmoid: false,
  },
  birefnet: {
    file: "birefnet-lite.onnx",
    input: "input_image",
    output: "output_image",
    fixed: 1024,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    sigmoid: true,
  },
  portrait: {
    file: "birefnet-portrait.onnx",
    input: "input_image",
    output: "output_image",
    fixed: 1024,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    sigmoid: true,
  },
};

const config = MODELS[process.env.FONDO_LAB_MASK ?? "modnet"] ?? MODELS.modnet;

let session;

const getSession = async () => {
  session ??= await ort.InferenceSession.create(
    path.join(MODELS_DIR, config.file),
    {
      executionProviders: ["cpu"],
      // Lower peak memory; the large models allocate huge temporary buffers.
      enableCpuMemArena: false,
      enableMemPattern: false,
    }
  );
  return session;
};

const multipleOf32 = (value) => Math.max(32, Math.round(value / 32) * 32);

const workingSize = async (input) => {
  if (config.fixed) {
    return { width: config.fixed, height: config.fixed };
  }

  const meta = await sharp(input).rotate().metadata();
  const width = meta.autoOrient?.width ?? meta.width;
  const height = meta.autoOrient?.height ?? meta.height;
  const scale = config.longEdge / Math.max(width, height);

  return {
    width: multipleOf32(width * scale),
    height: multipleOf32(height * scale),
  };
};

export const personMask = async (input) => {
  const { width, height } = await workingSize(input);
  const { data } = await sharp(input)
    .rotate()
    .resize(width, height, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const plane = width * height;
  const tensor = new Float32Array(3 * plane);

  for (let i = 0; i < plane; i += 1) {
    for (let c = 0; c < 3; c += 1) {
      tensor[c * plane + i] =
        (data[i * 3 + c] / 255 - config.mean[c]) / config.std[c];
    }
  }

  const model = await getSession();
  const output = await model.run({
    [config.input]: new ort.Tensor("float32", tensor, [1, 3, height, width]),
  });
  const values = output[config.output].data;
  const mask = Buffer.alloc(plane);

  for (let i = 0; i < plane; i += 1) {
    const alpha = config.sigmoid ? 1 / (1 + Math.exp(-values[i])) : values[i];
    mask[i] = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  }

  return sharp(mask, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
};
