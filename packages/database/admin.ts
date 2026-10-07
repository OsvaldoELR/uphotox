import "server-only";

import { createClient } from "@supabase/supabase-js";
import { keys } from "./keys";
import type { Database } from "./types";

/**
 * Supabase client authenticated with the secret key. It bypasses RLS, so use
 * it only for trusted server work (cron jobs, webhooks, admin tasks) and never
 * with user-controlled filters.
 */
export const createAdminClient = () => {
  const env = keys();

  if (!env.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
};
