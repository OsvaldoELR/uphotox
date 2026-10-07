import { createBrowserClient } from "@supabase/ssr";
import { keys } from "./keys";
import type { Database } from "./types";

/**
 * Supabase client for Client Components (realtime, storage uploads, etc.).
 * Prefer the server client for data fetching.
 */
export const createClient = () => {
  const env = keys();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
};
