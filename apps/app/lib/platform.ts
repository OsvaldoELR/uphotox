import "server-only";

import { auth } from "@repo/auth/server";
import { createAdminClient } from "@repo/database/admin";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

/**
 * Whether the signed-in user is a platform admin (Upgradix staff, /admin).
 * `platform_admins` is readable only with the service role; the filter is
 * the verified user id, never user input.
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const { userId } = await auth();

  if (!userId) {
    return false;
  }

  const { data } = await createAdminClient()
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
});

/**
 * Every /admin page and action calls this before touching the admin client:
 * the panel reads all studios with the service role, so this check is the
 * only gate. Anyone else gets a 404, which does not reveal the panel exists.
 */
export const requirePlatformAdmin = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!(await isPlatformAdmin())) {
    notFound();
  }

  return { userId, admin: createAdminClient() };
};
