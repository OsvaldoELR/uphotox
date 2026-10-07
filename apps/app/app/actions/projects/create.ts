"use server";

import { createClient } from "@repo/database/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const createProject = async (formData: FormData) => {
  const parsed = projectSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return;
  }

  // user_id defaults to auth.uid() and RLS checks ownership.
  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert(parsed.data);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
};
