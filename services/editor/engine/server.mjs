/**
 * Editor engine: HTTP server inside the Cloudflare container.
 *
 *   POST /process   body: the original JPEG; header x-options: URL-encoded
 *                   JSON ({ helpers, note, framing }); header x-photo: a label
 *                   for the logs. Answers multipart/form-data with "info"
 *                   (JSON) and the JPEGs "result", "before", "preview",
 *                   "zones" (and
 *                   "framed", "framed-preview" when framing ran).
 *   GET  /ping      readiness check for the Worker.
 *
 * The Worker reads and writes R2; this server never sees storage keys.
 */

import { createServer } from "node:http";
import { cleanPhoto } from "./lib/pipeline.mjs";

const PORT = Number(process.env.PORT ?? 8080);
const MAX_BODY = 120 * 1024 * 1024;
// Photos cleaned at the same time in one container (memory bound); the
// rest wait their turn.
const PARALLEL = Number(process.env.ENGINE_PARALLEL ?? 2);
const JPEG_START = [0xff, 0xd8];

let running = 0;
const waiting = [];

const acquire = () => {
  if (running < PARALLEL) {
    running += 1;
    return Promise.resolve();
  }

  return new Promise((resolve) => waiting.push(resolve));
};

const release = () => {
  const next = waiting.shift();

  if (next) {
    next();
  } else {
    running -= 1;
  }
};

const log = (photo, message) =>
  console.log(JSON.stringify({ photo, message, at: new Date().toISOString() }));

const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > MAX_BODY) {
        reject(new Error("La foto supera el tamaño máximo."));
        request.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });

const sendJson = (response, status, body) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const jpeg = (buffer, name) => [
  new Blob([buffer], { type: "image/jpeg" }),
  name,
];

const process_ = async (request, response) => {
  const photo = request.headers["x-photo"] ?? "?";
  const original = await readBody(request);

  if (original[0] !== JPEG_START[0] || original[1] !== JPEG_START[1]) {
    sendJson(response, 422, { error: "El original no es un JPEG." });
    return;
  }

  const options = request.headers["x-options"]
    ? JSON.parse(decodeURIComponent(request.headers["x-options"]))
    : {};

  await acquire();

  try {
    log(photo, "start");
    const result = await cleanPhoto({
      original,
      options,
      log: (step) => log(photo, step),
    });
    const form = new FormData();
    form.append(
      "info",
      new Blob([JSON.stringify(result.info)], { type: "application/json" }),
      "info.json"
    );
    form.append("result", ...jpeg(result.final, "result.jpg"));
    form.append("before", ...jpeg(result.before, "before.jpg"));
    form.append("preview", ...jpeg(result.preview, "preview.jpg"));
    form.append("zones", ...jpeg(result.zones, "zones.jpg"));

    if (result.framed) {
      form.append("framed", ...jpeg(result.framed, "framed.jpg"));
      form.append(
        "framed-preview",
        ...jpeg(result.framedPreview, "framed-preview.jpg")
      );
    }

    const body = new Response(form);
    const bytes = Buffer.from(await body.arrayBuffer());
    response.writeHead(200, {
      "content-type": body.headers.get("content-type"),
      "content-length": bytes.length,
    });
    response.end(bytes);
    log(photo, `done in ${result.info.seconds.toFixed(0)} s`);
  } finally {
    release();
  }
};

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/ping") {
    response.end("ok");
    return;
  }

  if (request.method === "POST" && request.url === "/process") {
    process_(request, response).catch((error) => {
      log(request.headers["x-photo"] ?? "?", `error: ${error.message}`);

      if (!response.headersSent) {
        sendJson(response, 500, {
          error: String(error.message ?? error),
          cost: error.cost ?? 0,
        });
      }
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

// Long requests: a photo takes a couple of minutes.
server.requestTimeout = 0;
server.listen(PORT, () => console.log(`editor engine on :${PORT}`));

// Cloudflare stops a container with SIGTERM: finish the photos in hand.
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
