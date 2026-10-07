import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { keys } from "./keys";
import type { Database } from "./types";

/**
 * Refreshes the Supabase session for a proxy (middleware) request.
 *
 * Returns the response carrying the refreshed auth cookies and the verified
 * JWT claims (null when signed out). If you return a different response
 * (e.g. a redirect), copy this response's cookies and headers onto it.
 */
export const updateSession = async (request: NextRequest) => {
  const env = keys();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }

          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    }
  );

  // Don't run code between createServerClient and getClaims: getClaims
  // verifies the JWT and triggers the token refresh that writes cookies.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
};
