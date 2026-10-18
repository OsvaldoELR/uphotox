import "server-only";

import { createHash } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { keys } from "./keys";

/**
 * Cloudflare R2 through its S3 API. The bucket is private: browsers only get
 * presigned URLs, handed out by server code that already checked access.
 */

interface Bucket {
  readonly client: AwsClient;
  readonly url: string;
}

let bucket: Bucket | null | undefined;

const getBucket = (): Bucket | null => {
  if (bucket !== undefined) {
    return bucket;
  }

  const env = keys();

  if (
    !(
      env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET
    )
  ) {
    bucket = null;
    return bucket;
  }

  bucket = {
    client: new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    }),
    url: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`,
  };
  return bucket;
};

export const isStorageConfigured = () => getBucket() !== null;

const requireBucket = () => {
  const configured = getBucket();

  if (!configured) {
    throw new Error("Cloudflare R2 is not configured (R2_* variables).");
  }

  return configured;
};

const DAY_SECONDS = 86_400;

/** Start of the current UTC day in SigV4 format (YYYYMMDDTHHMMSSZ). */
const startOfUtcDay = () => {
  const now = new Date();
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return day.toISOString().replace(/[:-]|\.\d{3}/g, "");
};

/**
 * Presigned download URLs. They are signed from the start of the UTC day and
 * last two days, so a photo keeps the same URL all day (the browser cache
 * works) and every URL handed out stays valid for at least 24 hours.
 */
export const signedGetUrls = async (objectKeys: string[]) => {
  const { client, url } = requireBucket();
  const datetime = startOfUtcDay();

  return await Promise.all(
    objectKeys.map(async (key) => {
      const target = new URL(`${url}/${key}`);
      target.searchParams.set("X-Amz-Expires", String(2 * DAY_SECONDS));
      const signed = await client.sign(target.toString(), {
        aws: { signQuery: true, datetime },
      });
      return signed.url;
    })
  );
};

/** Presigned upload URL for one object (the browser PUTs the file to it). */
export const signedPutUrl = async (key: string, expiresInSeconds = 900) => {
  const { client, url } = requireBucket();
  const target = new URL(`${url}/${key}`);
  target.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  const signed = await client.sign(new Request(target, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
};

/** Size of a stored object, or null when it does not exist. */
export const objectSize = async (key: string) => {
  const { client, url } = requireBucket();
  const response = await client.fetch(`${url}/${key}`, { method: "HEAD" });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`R2 HEAD failed with ${response.status}`);
  }

  return Number(response.headers.get("content-length") ?? 0);
};

/** Text of a stored object (e.g. a JSON status), or null when missing. */
export const readObjectText = async (key: string) => {
  const { client, url } = requireBucket();
  const response = await client.fetch(`${url}/${key}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`R2 GET failed with ${response.status}`);
  }

  return response.text();
};

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

/** Deletes objects in batches of 1000. Missing keys are not an error. */
export const deleteObjects = async (objectKeys: string[]) => {
  const { client, url } = requireBucket();

  for (let index = 0; index < objectKeys.length; index += 1000) {
    const batch = objectKeys.slice(index, index + 1000);
    const body = `<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>true</Quiet>${batch
      .map((key) => `<Object><Key>${escapeXml(key)}</Key></Object>`)
      .join("")}</Delete>`;
    const response = await client.fetch(`${url}?delete`, {
      method: "POST",
      body,
      headers: {
        "content-type": "application/xml",
        "content-md5": createHash("md5").update(body).digest("base64"),
      },
    });
    const result = await response.text();

    // Quiet mode only lists the keys that failed.
    if (!response.ok || result.includes("<Error>")) {
      throw new Error(
        `R2 delete failed with ${response.status}: ${result.slice(0, 300)}`
      );
    }
  }
};
