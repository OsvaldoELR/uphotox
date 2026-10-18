import { keys as analytics } from "@repo/analytics/keys";
import { keys as database } from "@repo/database/keys";
import { keys as email } from "@repo/email/keys";
import { keys as core } from "@repo/next-config/keys";
import { keys as observability } from "@repo/observability/keys";
import { keys as security } from "@repo/security/keys";
import { keys as storage } from "@repo/storage/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  emptyStringAsUndefined: true,
  extends: [
    analytics(),
    core(),
    database(),
    email(),
    observability(),
    security(),
    storage(),
  ],
  server: {
    // Editor service on Cloudflare (services/editor). Without them the
    // background clean-up is off.
    EDITOR_URL: z.url().optional(),
    EDITOR_TOKEN: z.string().min(32).optional(),
  },
  client: {},
  runtimeEnv: {
    EDITOR_URL: process.env.EDITOR_URL,
    EDITOR_TOKEN: process.env.EDITOR_TOKEN,
  },
});
