"use server";

import { auth } from "@repo/auth/server";
import { createClient } from "@repo/database/server";

const colors = [
  "var(--color-red-500)",
  "var(--color-orange-500)",
  "var(--color-amber-500)",
  "var(--color-yellow-500)",
  "var(--color-lime-500)",
  "var(--color-green-500)",
  "var(--color-emerald-500)",
  "var(--color-teal-500)",
  "var(--color-cyan-500)",
  "var(--color-sky-500)",
  "var(--color-blue-500)",
  "var(--color-indigo-500)",
  "var(--color-violet-500)",
  "var(--color-purple-500)",
  "var(--color-fuchsia-500)",
  "var(--color-pink-500)",
  "var(--color-rose-500)",
];

// Resolves Liveblocks user ids to profiles. RLS limits this to profiles the
// current user can see — extend the profiles policies when you add teams.
export const getUsers = async (
  userIds: string[]
): Promise<
  | {
      data: Liveblocks["UserMeta"]["info"][];
    }
  | {
      error: unknown;
    }
> => {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error("Not logged in");
    }

    const supabase = await createClient();
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    if (error) {
      throw error;
    }

    const data: Liveblocks["UserMeta"]["info"][] = profiles.map((profile) => ({
      name: profile.full_name ?? "Unknown user",
      picture: profile.avatar_url ?? "",
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    return { data };
  } catch (error) {
    return { error };
  }
};
