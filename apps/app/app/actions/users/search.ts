"use server";

import { auth } from "@repo/auth/server";
import { createClient } from "@repo/database/server";
import Fuse from "fuse.js";

// Mention suggestions for Liveblocks. RLS limits this to profiles the current
// user can see — extend the profiles policies when you add teams.
export const searchUsers = async (
  query: string
): Promise<
  | {
      data: string[];
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
      .select("id, full_name")
      .limit(100);

    if (error) {
      throw error;
    }

    const fuse = new Fuse(profiles, {
      keys: ["full_name"],
      minMatchCharLength: 1,
      threshold: 0.3,
    });

    const results = fuse.search(query);
    const data = results.map((result) => result.item.id);

    return { data };
  } catch (error) {
    return { error };
  }
};
