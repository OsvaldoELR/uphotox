import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    emptyStringAsUndefined: true,
    server: {
      // Secret key (sb_secret_...) bypasses RLS. Only needed for admin tasks.
      SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    },
    client: {
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    },
    runtimeEnv: {
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    },
  });
