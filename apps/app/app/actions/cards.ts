"use server";

import { createClient } from "@repo/database/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { POSITION_STEP } from "@/lib/board-templates";
import { notifyStageEntry } from "@/lib/notify";
import { requireStudio } from "@/lib/studio";
import type { ActionResult } from "./boards";

const firstIssue = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Revisa los datos.";

// Empty form fields arrive as "" and are stored as null.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    schema.nullable()
  );

const clientEmail = optional(
  z.email("El correo del cliente no es válido.").max(320)
);

const revalidateBoard = (boardId: number) => {
  revalidatePath(`/tableros/${boardId}`);
  revalidatePath("/");
};

// --- Create ----------------------------------------------------------------

const createCardSchema = z.object({
  boardId: z.number().int().positive(),
  stageId: z.number().int().positive(),
  clientName: z
    .string()
    .trim()
    .min(1, "Escribe el nombre del cliente.")
    .max(120, "Máximo 120 caracteres."),
  clientEmail,
  title: optional(z.string().trim().max(120, "Máximo 120 caracteres.")),
});

export const createCard = async (
  input: z.input<typeof createCardSchema>
): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("cards.create")) {
    return { error: "No tienes permiso para añadir tarjetas." };
  }

  const parsed = createCardSchema.safeParse(input);

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { boardId, stageId, clientName, title } = parsed.data;
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      studio_id: context.studio.id,
      full_name: clientName,
      email: parsed.data.clientEmail,
    })
    .select("id")
    .single();

  if (clientError) {
    return { error: "No se pudo guardar el cliente." };
  }

  const { data: last } = await supabase
    .from("cards")
    .select("position")
    .eq("stage_id", stageId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      studio_id: context.studio.id,
      board_id: boardId,
      stage_id: stageId,
      client_id: client.id,
      title: title ?? clientName,
      position: (last?.position ?? 0) + POSITION_STEP,
      // Restricted members only see their own cards, so they own new ones.
      assigned_to: context.member.onlyAssigned ? context.userId : null,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.from("clients").delete().eq("id", client.id);
    return { error: "No se pudo crear la tarjeta." };
  }

  after(() =>
    notifyStageEntry({
      supabase,
      context,
      cardId: card.id,
      fromStageId: null,
      toStageId: stageId,
    })
  );

  revalidateBoard(boardId);
  return { ok: true };
};

// --- Move ------------------------------------------------------------------

const moveCardSchema = z.object({
  cardId: z.number().int().positive(),
  toStageId: z.number().int().positive(),
  position: z.number().finite(),
});

export const moveCard = async (
  input: z.input<typeof moveCardSchema>
): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("cards.move")) {
    return { error: "No tienes permiso para mover tarjetas." };
  }

  const parsed = moveCardSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Movimiento no válido." };
  }

  const { cardId, toStageId, position } = parsed.data;
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("cards")
    .select("stage_id, board_id")
    .eq("id", cardId)
    .maybeSingle();

  if (!current) {
    return { error: "La tarjeta ya no existe." };
  }

  const { data, error } = await supabase
    .from("cards")
    .update({ stage_id: toStageId, position })
    .eq("id", cardId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo mover la tarjeta." };
  }

  if (current.stage_id !== toStageId) {
    after(() =>
      notifyStageEntry({
        supabase,
        context,
        cardId,
        fromStageId: current.stage_id,
        toStageId,
      })
    );
  }

  revalidateBoard(current.board_id);
  return { ok: true };
};

// --- Update ----------------------------------------------------------------

const updateCardSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "La tarjeta necesita un título.")
    .max(120, "Máximo 120 caracteres."),
  clientName: optional(z.string().trim().max(120, "Máximo 120 caracteres.")),
  clientEmail,
  clientPhone: optional(z.string().trim().max(40, "Máximo 40 caracteres.")),
  sessionAt: optional(z.iso.datetime({ offset: true })),
  galleryUrl: optional(
    z.url({
      protocol: /^https?$/,
      error: "El enlace debe empezar por https://",
    })
  ),
  notes: optional(z.string().trim().max(5000, "Máximo 5000 caracteres.")),
  assignedTo: optional(z.uuid()),
});

export type UpdateCardInput = z.input<typeof updateCardSchema>;

export const updateCard = async (
  cardId: number,
  input: UpdateCardInput
): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("cards.edit")) {
    return { error: "No tienes permiso para editar tarjetas." };
  }

  const parsed = updateCardSchema.safeParse(input);

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const values = parsed.data;
  const supabase = await createClient();
  const { data: card } = await supabase
    .from("cards")
    .select("board_id, client_id")
    .eq("id", cardId)
    .maybeSingle();

  if (!card) {
    return { error: "La tarjeta ya no existe." };
  }

  let clientId = card.client_id;
  const clientFields = {
    email: values.clientEmail,
    phone: values.clientPhone,
  };

  if (clientId) {
    const { error } = await supabase
      .from("clients")
      .update(
        values.clientName
          ? { full_name: values.clientName, ...clientFields }
          : clientFields
      )
      .eq("id", clientId);

    if (error) {
      return { error: "No se pudieron guardar los datos del cliente." };
    }
  } else if (values.clientName) {
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        studio_id: context.studio.id,
        full_name: values.clientName,
        ...clientFields,
      })
      .select("id")
      .single();

    if (error) {
      return { error: "No se pudieron guardar los datos del cliente." };
    }

    clientId = client.id;
  }

  const { data, error } = await supabase
    .from("cards")
    .update({
      title: values.title,
      client_id: clientId,
      session_at: values.sessionAt,
      gallery_url: values.galleryUrl,
      notes: values.notes,
      assigned_to: values.assignedTo,
    })
    .eq("id", cardId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo guardar la tarjeta." };
  }

  revalidateBoard(card.board_id);
  return { ok: true };
};

// --- Delete ----------------------------------------------------------------

export const deleteCard = async (cardId: number): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("cards.delete")) {
    return { error: "No tienes permiso para eliminar tarjetas." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cards")
    .delete()
    .eq("id", cardId)
    .select("board_id");

  const boardId = data?.[0]?.board_id;

  if (error || !boardId) {
    return { error: "No se pudo eliminar la tarjeta." };
  }

  revalidateBoard(boardId);
  return { ok: true };
};

// --- History ---------------------------------------------------------------

export interface CardHistoryEntry {
  readonly actor: string | null;
  readonly at: string;
  readonly detail: string | null;
  readonly from: string | null;
  readonly id: number;
  readonly kind: "created" | "moved" | "email_sent" | "email_failed";
  readonly to: string | null;
}

export const getCardHistory = async (
  cardId: number
): Promise<CardHistoryEntry[]> => {
  await requireStudio();

  const supabase = await createClient();
  const { data } = await supabase
    .from("card_events")
    .select(
      "id, kind, detail, created_at, actor:profiles!card_events_actor_id_fkey(full_name, email), from:board_stages!card_events_from_stage_id_fkey(name), to:board_stages!card_events_to_stage_id_fkey(name)"
    )
    .eq("card_id", cardId)
    .order("id", { ascending: false })
    .limit(50);

  return (data ?? []).map((event) => ({
    id: event.id,
    kind: event.kind as CardHistoryEntry["kind"],
    detail: event.detail,
    at: event.created_at,
    actor: event.actor?.full_name ?? event.actor?.email ?? null,
    from: event.from?.name ?? null,
    to: event.to?.name ?? null,
  }));
};
