import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { keys } from "./keys";
import type { Database } from "./types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Queries run as the signed-in user, so RLS applies.
 */
export const createClient = async () => {
  const cookieStore = await cookies();
  const env = keys();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't write cookies. The proxy refreshes the
            // session on every request, so this is safe to ignore.
          }
        },
      },
    }
  );
};
