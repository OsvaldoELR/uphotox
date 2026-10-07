"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@repo/database/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudio } from "@/lib/studio";
import type { ActionResult } from "./boards";

const NO_ACCESS = "No tienes permiso para cambiar los ajustes del estudio.";
const PROVIDER = "webhook";

/** 32 random bytes → 43 base64url chars: the secret part of the URL. */
const newToken = () => randomBytes(32).toString("base64url");

const manageable = async () => {
  const context = await requireStudio();
  return context.can("settings.manage") ? context : null;
};

/** Turns the inbound webhook on, pointing at the first board and stage. */
export const enableWebhook = async (): Promise<ActionResult> => {
  const context = await manageable();

  if (!context) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data: board } = await supabase
    .from("boards")
    .select("id, board_stages(id, position)")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const firstStage = [...(board?.board_stages ?? [])].sort(
    (a, b) => a.position - b.position
  )[0];

  const { error } = await supabase.from("studio_integrations").insert({
    studio_id: context.studio.id,
    provider: PROVIDER,
    token: newToken(),
    board_id: board?.id ?? null,
    stage_id: firstStage?.id ?? null,
  });

  if (error) {
    return { error: "No se pudo activar la entrada de clientes." };
  }

  revalidatePath("/ajustes");
  return { ok: true };
};

const updateSchema = z.object({
  enabled: z.boolean(),
  boardId: z.number().int().positive().nullable(),
  stageId: z.number().int().positive().nullable(),
});

export const updateWebhook = async (
  input: z.input<typeof updateSchema>
): Promise<ActionResult> => {
  const context = await manageable();

  if (!context) {
    return { error: NO_ACCESS };
  }

  const parsed = updateSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Datos no válidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_integrations")
    .update({
      enabled: parsed.data.enabled,
      board_id: parsed.data.boardId,
      // A stage only makes sense together with its board.
      stage_id: parsed.data.boardId ? parsed.data.stageId : null,
    })
    .eq("studio_id", context.studio.id)
    .eq("provider", PROVIDER)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudieron guardar los cambios." };
  }

  revalidatePath("/ajustes");
  return { ok: true };
};

/** New secret URL; the old one stops working immediately. */
export const regenerateWebhookToken = async (): Promise<ActionResult> => {
  const context = await manageable();

  if (!context) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_integrations")
    .update({ token: newToken() })
    .eq("studio_id", context.studio.id)
    .eq("provider", PROVIDER)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo generar una URL nueva." };
  }

  revalidatePath("/ajustes");
  return { ok: true };
};

export const deleteWebhook = async (): Promise<ActionResult> => {
  const context = await manageable();

  if (!context) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("studio_integrations")
    .delete()
    .eq("studio_id", context.studio.id)
    .eq("provider", PROVIDER);

  if (error) {
    return { error: "No se pudo eliminar la entrada de clientes." };
  }

  revalidatePath("/ajustes");
  return { ok: true };
};
