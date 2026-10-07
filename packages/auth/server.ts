import "server-only";

import { createClient } from "@repo/database/server";
import { cache } from "react";

/**
 * Verified JWT claims for the current request. Cheap: with asymmetric JWT
 * signing keys the token is verified locally, without a network call.
 */
export const auth = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  return { userId: claims?.sub ?? null, claims };
});

/**
 * Full user record from Supabase Auth (makes a network call). Use `auth()`
 * when the user id is all you need.
 */
export const currentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return data.user;
});

export type { User } from "@repo/database";
