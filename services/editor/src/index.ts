import { Container, getRandom } from "@cloudflare/containers";

/**
 * Editor service (Cloudflare Worker).
 *
 *   POST /photos          { key, prefix, options? } with the Bearer token:
 *                         queues one photo. `key` is the original in R2,
 *                         `prefix` the folder for the results (both under
 *                         editor/).
 *   GET  /photos/status   ?prefix=… : the photo's status.json.
 *
 * The queue consumer reads the original from R2, sends it to an engine
 * container (the Node pipeline in engine/) and stores what comes back next
 * to it: result.jpg, preview.jpg, zones.jpg (framed*.jpg with framing),
 * info.json and status.json.
 */

interface PhotoJob {
  key: string;
  options?: { helpers?: boolean; note?: string };
  prefix: string;
}

type Status =
  | { state: "queued" | "processing"; at: string; attempt?: number }
  | { state: "done"; at: string; info: unknown }
  | { state: "failed"; at: string; error: string };

// Engine instances to spread photos over (≤ max_instances in wrangler).
const ENGINE_SLOTS = 4;
// Deliveries of a message that the engine never answered (crash, start
// failure). Errors the engine reports are final: it already retried.
const DELIVERY_ATTEMPTS = 3;
const RETRY_DELAY_SECONDS = 60;
const KEY_PATTERN = /^editor\/[\w./-]+$/;

const FILES: Record<string, string> = {
  result: "result.jpg",
  preview: "preview.jpg",
  zones: "zones.jpg",
  framed: "framed.jpg",
  "framed-preview": "framed-preview.jpg",
};

export class Engine extends Container<Env> {
  defaultPort = 8080;
  // Idle time before the instance sleeps (billing stops).
  sleepAfter = "5m";

  constructor(ctx: ConstructorParameters<typeof Container>[0], env: Env) {
    super(ctx, env);
    this.envVars = {
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      OPENAI_API_KEY: env.OPENAI_API_KEY,
    };
  }
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

const now = () => new Date().toISOString();

const setStatus = (env: Env, prefix: string, status: Status) =>
  env.BUCKET.put(`${prefix}status.json`, JSON.stringify(status), {
    httpMetadata: { contentType: "application/json" },
  });

const isAuthorised = (request: Request, env: Env) => {
  const given = new TextEncoder().encode(
    request.headers.get("authorization") ?? ""
  );
  const expected = new TextEncoder().encode(`Bearer ${env.EDITOR_TOKEN}`);
  return (
    Boolean(env.EDITOR_TOKEN) &&
    given.byteLength === expected.byteLength &&
    crypto.subtle.timingSafeEqual(given, expected)
  );
};

const isSafeKey = (value: unknown): value is string =>
  typeof value === "string" && KEY_PATTERN.test(value) && !value.includes("..");

const queuePhoto = async (request: Request, env: Env) => {
  const job = (await request.json().catch(() => null)) as PhotoJob | null;

  if (!(job && isSafeKey(job.key) && isSafeKey(job.prefix))) {
    return json({ error: "key y prefix deben estar dentro de editor/" }, 400);
  }

  if (!job.prefix.endsWith("/")) {
    return json({ error: "prefix debe terminar en /" }, 400);
  }

  if (!(await env.BUCKET.head(job.key))) {
    return json({ error: "No existe el original en R2" }, 404);
  }

  await setStatus(env, job.prefix, { state: "queued", at: now() });
  await env.PHOTOS.send({
    key: job.key,
    prefix: job.prefix,
    options: {
      helpers: job.options?.helpers,
      note: job.options?.note?.slice(0, 500),
    },
  });
  return json({ queued: true }, 202);
};

const readStatus = async (url: URL, env: Env) => {
  const prefix = url.searchParams.get("prefix");

  if (!isSafeKey(prefix)) {
    return json({ error: "prefix inválido" }, 400);
  }

  const object = await env.BUCKET.get(`${prefix}status.json`);
  return object
    ? json(await object.json())
    : json({ error: "Sin estado" }, 404);
};

/** Sends one photo through an engine and stores the answer in R2. */
const processPhoto = async (job: PhotoJob, env: Env, attempt: number) => {
  await setStatus(env, job.prefix, {
    state: "processing",
    at: now(),
    attempt,
  });
  const original = await env.BUCKET.get(job.key);

  if (!original) {
    await setStatus(env, job.prefix, {
      state: "failed",
      at: now(),
      error: "El original ya no está en R2.",
    });
    return;
  }

  const engine = await getRandom(env.ENGINE, ENGINE_SLOTS);
  const response = await engine.fetch(
    new Request("http://engine/process", {
      method: "POST",
      headers: {
        "content-type": "image/jpeg",
        "x-options": encodeURIComponent(JSON.stringify(job.options ?? {})),
        "x-photo": job.prefix,
      },
      body: original.body,
    })
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    await setStatus(env, job.prefix, {
      state: "failed",
      at: now(),
      error: body.error ?? `El motor respondió ${response.status}.`,
    });
    return;
  }

  const form = await response.formData();

  for (const [field, name] of Object.entries(FILES)) {
    const file = form.get(field);

    if (file instanceof File) {
      await env.BUCKET.put(`${job.prefix}${name}`, await file.arrayBuffer(), {
        httpMetadata: { contentType: "image/jpeg" },
      });
    }
  }

  const info = JSON.parse(await (form.get("info") as File).text());
  await env.BUCKET.put(`${job.prefix}info.json`, JSON.stringify(info), {
    httpMetadata: { contentType: "application/json" },
  });
  await setStatus(env, job.prefix, { state: "done", at: now(), info });
};

export default {
  fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    if (!isAuthorised(request, env)) {
      return json({ error: "No autorizado" }, 401);
    }

    if (request.method === "POST" && url.pathname === "/photos") {
      return queuePhoto(request, env);
    }

    if (request.method === "GET" && url.pathname === "/photos/status") {
      return readStatus(url, env);
    }

    return json({ error: "No encontrado" }, 404);
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await processPhoto(message.body, env, message.attempts);
        message.ack();
      } catch (error) {
        // The engine never answered (crash, start failure): try again later.
        if (message.attempts < DELIVERY_ATTEMPTS) {
          message.retry({ delaySeconds: RETRY_DELAY_SECONDS });
        } else {
          await setStatus(env, message.body.prefix, {
            state: "failed",
            at: now(),
            error: `El motor no respondió: ${String(error)}`,
          });
          message.ack();
        }
      }
    }
  },
} satisfies ExportedHandler<Env, PhotoJob>;
