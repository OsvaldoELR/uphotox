"use server";

import { auth } from "@repo/auth/server";
import { createClient } from "@repo/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createBoardFromTemplate } from "@/lib/boards";
import { requireStudio } from "@/lib/studio";
import { whatsappField } from "@/lib/whatsapp";

export interface StudioFormState {
  readonly error?: string;
  readonly name?: string;
  /** Set after a successful settings save. */
  readonly saved?: boolean;
  readonly whatsapp?: string;
}

const studioSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ponle un nombre a tu estudio.")
    .max(120, "Máximo 120 caracteres."),
  whatsapp: whatsappField,
});

const readForm = (formData: FormData) => ({
  name: String(formData.get("name") ?? ""),
  whatsapp: String(formData.get("whatsapp") ?? ""),
});

/** Onboarding: creates the studio, its owner row and a first board. */
export const createStudio = async (
  _previous: StudioFormState,
  formData: FormData
): Promise<StudioFormState> => {
  const values = readForm(formData);
  const parsed = studioSchema.safeParse(values);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, ...values };
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
    return {
      error: "No se pudo crear el estudio. Inténtalo de nuevo.",
      ...values,
    };
  }

  if (parsed.data.whatsapp) {
    // Optional detail: if it fails the owner can add it later in Ajustes.
    await supabase
      .from("studios")
      .update({ whatsapp: parsed.data.whatsapp })
      .eq("id", studioId);
  }

  const board = await createBoardFromTemplate(
    supabase,
    studioId,
    "Sesiones",
    "session"
  );

  redirect(board.boardId ? `/tableros/${board.boardId}` : "/tableros");
};

/** Ajustes: studio name and the WhatsApp linked from client emails. */
export const updateStudioSettings = async (
  _previous: StudioFormState,
  formData: FormData
): Promise<StudioFormState> => {
  const context = await requireStudio();
  const values = readForm(formData);

  if (!context.can("settings.manage")) {
    return {
      error: "No tienes permiso para cambiar los ajustes del estudio.",
      ...values,
    };
  }

  const parsed = studioSchema.safeParse(values);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, ...values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studios")
    .update({ name: parsed.data.name, whatsapp: parsed.data.whatsapp })
    .eq("id", context.studio.id)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudieron guardar los ajustes.", ...values };
  }

  revalidatePath("/", "layout");
  return { saved: true, ...values };
};
