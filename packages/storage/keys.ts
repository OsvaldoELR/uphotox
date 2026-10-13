import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const ACCOUNT_ID = /^[0-9a-f]{32}$/;

export const keys = () =>
  createEnv({
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    emptyStringAsUndefined: true,
    server: {
      // Cloudflare R2 (S3 API). Without them the galleries module is off.
      R2_ACCOUNT_ID: z.string().regex(ACCOUNT_ID).optional(),
      R2_ACCESS_KEY_ID: z.string().min(1).optional(),
      R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
      R2_BUCKET: z.string().min(3).optional(),
    },
    runtimeEnv: {
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET: process.env.R2_BUCKET,
    },
  });
