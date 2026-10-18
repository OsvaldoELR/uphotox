/**
 * End-to-end test of the deployed Editor service with one photo:
 *
 *   npm run try -- "D:/.../DSCF6322.jpg" [--nota "quita también el cable"]
 *
 * Uploads the photo to R2 (editor/pruebas/…), queues it in the Worker,
 * waits for the result, saves it next to the photo in «resultados-editor/»
 * and deletes the test objects from R2. Reads R2_*, EDITOR_URL and
 * EDITOR_TOKEN from apps/app/.env.local.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";

const POLL_MS = 10_000;
const TIMEOUT_MS = 20 * 60_000;
const OUTPUTS = [
  "result.jpg",
  "preview.jpg",
  "zones.jpg",
  "framed.jpg",
  "framed-preview.jpg",
  "info.json",
  "status.json",
];

const env = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta ${name} en apps/app/.env.local`);
  }

  return value;
};

const args = process.argv.slice(2);
const photo = args.find((arg) => !arg.startsWith("--"));
const noteIndex = args.indexOf("--nota");
const note = noteIndex >= 0 ? args[noteIndex + 1] : undefined;

if (!photo) {
  throw new Error('Uso: npm run try -- "<foto.jpg>" [--nota "…"]');
}

const r2 = new AwsClient({
  accessKeyId: env("R2_ACCESS_KEY_ID"),
  secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});
const bucketUrl = `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${env("R2_BUCKET")}`;
const editorUrl = env("EDITOR_URL").replace(/\/$/, "");
const auth = { authorization: `Bearer ${env("EDITOR_TOKEN")}` };

const id = `${path.parse(photo).name}-${Date.now()}`;
const prefix = `editor/pruebas/${id}/`;
const key = `${prefix}original.jpg`;

const check = async (response, what) => {
  if (!response.ok) {
    throw new Error(`${what}: ${response.status} ${await response.text()}`);
  }

  return response;
};

console.log(`Subiendo ${path.basename(photo)} a R2…`);
await check(
  await r2.fetch(`${bucketUrl}/${key}`, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body: await readFile(photo),
  }),
  "Subida a R2"
);

await check(
  await fetch(`${editorUrl}/photos`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ key, prefix, options: { note } }),
  }),
  "Encolar"
);
console.log("En cola. Esperando al motor…");

const started = Date.now();
let status;
let last = "";

while (Date.now() - started < TIMEOUT_MS) {
  await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  const response = await fetch(
    `${editorUrl}/photos/status?prefix=${encodeURIComponent(prefix)}`,
    { headers: auth }
  );
  status = response.ok ? await response.json() : { state: "?" };

  if (status.state !== last) {
    last = status.state;
    console.log(`${Math.round((Date.now() - started) / 1000)} s · ${last}`);
  }

  if (status.state === "done" || status.state === "failed") {
    break;
  }
}

const outDir = path.join(path.dirname(photo), "resultados-editor", id);
await mkdir(outDir, { recursive: true });

for (const name of OUTPUTS) {
  const response = await r2.fetch(`${bucketUrl}/${prefix}${name}`);

  if (response.ok) {
    await writeFile(
      path.join(outDir, name),
      Buffer.from(await response.arrayBuffer())
    );
  }
}

// Test objects never stay in the bucket.
for (const name of ["original.jpg", ...OUTPUTS]) {
  await r2.fetch(`${bucketUrl}/${prefix}${name}`, { method: "DELETE" });
}

if (status?.state === "done") {
  const { info } = status;
  console.log(
    `\nListo en ${Math.round((Date.now() - started) / 1000)} s (motor ${info.seconds.toFixed(0)} s)`
  );
  console.log(`Revisor: ${info.review.score}/10 · ${info.review.comment}`);
  console.log(
    `Coste: $${info.costs.total.toFixed(3)} · intentos: ${info.attempts.length}`
  );
} else {
  console.log(
    `\nNo terminó bien: ${status?.error ?? status?.state ?? "sin estado"}`
  );
}

console.log(`Archivos: ${outDir}`);
