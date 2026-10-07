"use server";

import { createClient } from "@repo/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  BOARD_TEMPLATE_IDS,
  type BoardTemplateId,
  POSITION_STEP,
} from "@/lib/board-templates";
import { createBoardFromTemplate } from "@/lib/boards";
import { requireStudio } from "@/lib/studio";

export type ActionResult = { ok: true } | { error: string };

const NO_ACCESS = "No tienes permiso para gestionar tableros.";

const boardName = z
  .string()
  .trim()
  .min(1, "El tablero necesita un nombre.")
  .max(80, "Máximo 80 caracteres.");

const stageName = z
  .string()
  .trim()
  .min(1, "La etapa necesita un nombre.")
  .max(60, "Máximo 60 caracteres.");

const firstIssue = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Revisa los datos.";

const revalidateBoard = (boardId: number) => {
  revalidatePath(`/tableros/${boardId}`);
  revalidatePath("/tableros");
  revalidatePath("/");
};

// --- Boards ----------------------------------------------------------------

export interface CreateBoardState {
  readonly error?: string;
}

const createBoardSchema = z.object({
  name: boardName,
  template: z.enum(
    BOARD_TEMPLATE_IDS as [BoardTemplateId, ...BoardTemplateId[]]
  ),
});

export const createBoard = async (
  _previous: CreateBoardState,
  formData: FormData
): Promise<CreateBoardState> => {
  const context = await requireStudio();

  if (!context.can("boards.manage")) {
    return { error: NO_ACCESS };
  }

  const parsed = createBoardSchema.safeParse({
    name: formData.get("name"),
    template: formData.get("template"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const result = await createBoardFromTemplate(
    supabase,
    context.studio.id,
    parsed.data.name,
    parsed.data.template
  );

  if (!result.boardId) {
    return { error: "No se pudo crear el tablero." };
  }

  revalidatePath("/tableros");
  revalidatePath("/");
  redirect(`/tableros/${result.boardId}`);
};

export const renameBoard = async (
  boardId: number,
  name: string
): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("boards.manage")) {
    return { error: NO_ACCESS };
  }

  const parsed = boardName.safeParse(name);

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .update({ name: parsed.data })
    .eq("id", boardId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo renombrar el tablero." };
  }

  revalidateBoard(boardId);
  return { ok: true };
};

export const deleteBoard = async (boardId: number): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("boards.manage")) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .delete()
    .eq("id", boardId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo eliminar el tablero." };
  }

  revalidatePath("/tableros");
  revalidatePath("/");
  redirect("/tableros");
};

// --- Stages ----------------------------------------------------------------

export const createStage = async (
  boardId: number,
  name: string
): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("boards.manage")) {
    return { error: NO_ACCESS };
  }

  const parsed = stageName.safeParse(name);

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("board_stages")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("board_stages").insert({
    board_id: boardId,
    studio_id: context.studio.id,
    name: parsed.data,
    position: (last?.position ?? 0) + POSITION_STEP,
    notify_client: false,
  });

  if (error) {
    return { error: "No se pudo crear la etapa." };
  }

  revalidateBoard(boardId);
  return { ok: true };
};

const updateStageSchema = z.object({
  name: stageName,
  notifyClient: z.boolean(),
  clientMessage: z
    .string()
    .trim()
    .max(2000, "El mensaje admite hasta 2000 caracteres.")
    .transform((value) => value || null),
});

export const updateStage = async (
  stageId: number,
  input: z.input<typeof updateStageSchema>
): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("boards.manage")) {
    return { error: NO_ACCESS };
  }

  const parsed = updateStageSchema.safeParse(input);

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("board_stages")
    .update({
      name: parsed.data.name,
      notify_client: parsed.data.notifyClient,
      client_message: parsed.data.clientMessage,
    })
    .eq("id", stageId)
    .select("board_id");

  const boardId = data?.[0]?.board_id;

  if (error || !boardId) {
    return { error: "No se pudo guardar la etapa." };
  }

  revalidateBoard(boardId);
  return { ok: true };
};

export const deleteStage = async (stageId: number): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("boards.manage")) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("board_stages")
    .delete()
    .eq("id", stageId)
    .select("board_id");

  // 23503: cards still point at this stage.
  if (error?.code === "23503") {
    return {
      error: "Mueve o elimina las tarjetas de esta etapa antes de borrarla.",
    };
  }

  const boardId = data?.[0]?.board_id;

  if (error || !boardId) {
    return { error: "No se pudo eliminar la etapa." };
  }

  revalidateBoard(boardId);
  return { ok: true };
};
