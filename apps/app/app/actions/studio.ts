"use server";

import { auth } from "@repo/auth/server";
import { createClient } from "@repo/database/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createBoardFromTemplate } from "@/lib/boards";

export interface CreateStudioState {
  readonly error?: string;
  readonly name?: string;
}

const studioSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ponle un nombre a tu estudio.")
    .max(120, "Máximo 120 caracteres."),
});

/** Onboarding: creates the studio, its owner row and a first board. */
export const createStudio = async (
  _previous: CreateStudioState,
  formData: FormData
): Promise<CreateStudioState> => {
  const name = String(formData.get("name") ?? "");
  const parsed = studioSchema.safeParse({ name });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, name };
  }

  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const supabase = await createClient();
  const { data: studioId, error } = await supabase.rpc("create_studio", {
    studio_name: parsed.data.name,
  });

  if (error?.code === "23505") {
    // Already belongs to a studio (e.g. double submit).
    redirect("/");
  }

  if (error) {
    return { error: "No se pudo crear el estudio. Inténtalo de nuevo.", name };
  }

  const board = await createBoardFromTemplate(
    supabase,
    studioId,
    "Sesiones",
    "session"
  );

  redirect(board.boardId ? `/tableros/${board.boardId}` : "/tableros");
};
