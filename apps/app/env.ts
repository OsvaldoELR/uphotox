import { keys as analytics } from "@repo/analytics/keys";
import { keys as database } from "@repo/database/keys";
import { keys as email } from "@repo/email/keys";
import { keys as core } from "@repo/next-config/keys";
import { keys as observability } from "@repo/observability/keys";
import { keys as security } from "@repo/security/keys";
import { createEnv } from "@t3-oss/env-nextjs";

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
  ],
  server: {},
  client: {},
  runtimeEnv: {},
});
