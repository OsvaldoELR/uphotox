/**
 * Thin REST clients for the image models under test. Each edit returns the
 * image bytes, the raw usage and an estimated cost in USD (list prices,
 * October 2026; check the providers' pricing pages before trusting them).
 */

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";

/** Vision model for the JSON steps (analysis, zones, framing, review). */
export const TEXT_MODEL = "gemini-flash-latest";

// Per-image list prices by output size (Gemini bills image output per image).
const GEMINI_IMAGE_PRICE = {
  "gemini-3-pro-image": { "1K": 0.134, "2K": 0.134, "4K": 0.24 },
  "gemini-3.1-flash-image": { "1K": 0.067, "2K": 0.101, "4K": 0.151 },
};

// gpt-image-2 token rates (USD per token).
const OPENAI_RATES = { textIn: 5e-6, imageIn: 8e-6, imageOut: 30e-6 };
// A stuck request fails (and is retried) instead of holding the queue.
const JSON_TIMEOUT_MS = 120_000;
const IMAGE_TIMEOUT_MS = 300_000;

const geminiPost = async (model, body, timeout = JSON_TIMEOUT_MS) => {
  const response = await fetch(`${GEMINI}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(`${model} ${response.status}: ${json.error?.message}`);
  }

  return json;
};

const imagePart = (buffer) => ({
  inlineData: { mimeType: "image/jpeg", data: buffer.toString("base64") },
});

/**
 * Vision model answering with JSON (analysis, zones, framing, review).
 * `parts` (strings and image buffers, in order) can replace `prompt` +
 * `images`, e.g. for labelled examples.
 */
export const geminiJson = async ({ images, model, parts, prompt, schema }) => {
  const content = parts
    ? parts.map((part) =>
        typeof part === "string" ? { text: part } : imagePart(part)
      )
    : [{ text: prompt }, ...images.map(imagePart)];
  const json = await geminiPost(model, {
    contents: [{ role: "user", parts: content }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  const text = json.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("");
  const usage = json.usageMetadata ?? {};

  return {
    data: JSON.parse(text),
    model: json.modelVersion ?? model,
    // Flash list price, generous upper bound: $0.50 / $3 per million tokens.
    cost:
      (usage.promptTokenCount ?? 0) * 0.5e-6 +
      ((usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0)) *
        3e-6,
  };
};

export const geminiEdit = async ({
  aspectRatio,
  image,
  imageSize,
  model,
  prompt,
}) => {
  const json = await geminiPost(
    model,
    {
      contents: [{ role: "user", parts: [{ text: prompt }, imagePart(image)] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio, imageSize },
      },
    },
    IMAGE_TIMEOUT_MS
  );
  const candidate = json.candidates?.[0];
  const part = candidate?.content?.parts?.find((item) => item.inlineData?.data);

  if (!part) {
    throw new Error(
      `${model}: sin imagen (${candidate?.finishReason ?? json.promptFeedback?.blockReason ?? "motivo desconocido"})`
    );
  }

  const usage = json.usageMetadata ?? {};

  return {
    image: Buffer.from(part.inlineData.data, "base64"),
    model: json.modelVersion ?? model,
    cost:
      (GEMINI_IMAGE_PRICE[model]?.[imageSize] ?? 0) +
      (usage.promptTokenCount ?? 0) * 2e-6,
  };
};

export const openaiEdit = async ({ image, model, prompt, quality, size }) => {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", quality);
  form.append("moderation", "low");
  form.append("output_format", "png");
  form.append("image", new Blob([image], { type: "image/jpeg" }), "foto.jpg");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(`${model} ${response.status}: ${json.error?.message}`);
  }

  const usage = json.usage ?? {};
  const details = usage.input_tokens_details ?? {};

  return {
    image: Buffer.from(json.data[0].b64_json, "base64"),
    model,
    cost:
      (details.text_tokens ?? 0) * OPENAI_RATES.textIn +
      (details.image_tokens ?? 0) * OPENAI_RATES.imageIn +
      (usage.output_tokens ?? 0) * OPENAI_RATES.imageOut,
  };
};
