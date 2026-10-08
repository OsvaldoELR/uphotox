"use server";

import { createClient } from "@repo/database/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_IMPORT_ROWS } from "@/lib/client-import";
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

const revalidateClients = () => {
  revalidatePath("/clientes");
  revalidatePath("/");
};

// --- Import ------------------------------------------------------------------

// The browser already cleaned each row; this is the trust boundary.
const importRowSchema = z.object({
  line: z.number().int().positive(),
  clientName: z.string().trim().min(1).max(120),
  email: optional(z.email().max(320)),
  phone: optional(z.string().trim().max(40)),
  title: z.string().trim().min(1).max(120),
  sessionAt: optional(z.iso.datetime({ offset: true })),
  notes: optional(z.string().trim().max(5000)),
  externalId: z.string().trim().min(1).max(200),
});

const importSchema = z.object({
  boardId: z.number().int().positive(),
  stageId: z.number().int().positive(),
  rows: z
    .array(importRowSchema)
    .min(1, "No hay filas para importar.")
    .max(MAX_IMPORT_ROWS, `Máximo ${MAX_IMPORT_ROWS} filas por importación.`),
});

const importResultSchema = z.object({
  created: z.number(),
  clients_created: z.number(),
  clients_matched: z.number(),
  skipped: z.array(z.number()),
});

export interface ImportSummary {
  readonly cardsCreated: number;
  readonly clientsCreated: number;
  readonly clientsMatched: number;
  /** Rows already imported before (same id): left untouched. */
  readonly skippedLines: number[];
}

export const importClients = async (
  input: z.input<typeof importSchema>
): Promise<{ error: string } | { ok: true; summary: ImportSummary }> => {
  const context = await requireStudio();

  if (!(context.can("clients.manage") && context.can("cards.create"))) {
    return { error: "No tienes permiso para importar clientes." };
  }

  const parsed = importSchema.safeParse(input);

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { boardId, stageId, rows } = parsed.data;
  const supabase = await createClient();

  // One transaction: the whole file goes in, or nothing does.
  const { data, error } = await supabase.rpc("import_cards", {
    target_board_id: boardId,
    target_stage_id: stageId,
    entries: rows.map((row) => ({
      line: row.line,
      client_name: row.clientName,
      email: row.email,
      phone: row.phone,
      title: row.title,
      session_at: row.sessionAt,
      notes: row.notes,
      external_id: row.externalId,
    })),
  });

  if (error) {
    return {
      error:
        error.code === "P0002"
          ? "Esa etapa ya no existe. Elige otra."
          : "No se pudo importar. No se ha guardado nada; inténtalo de nuevo.",
    };
  }

  const result = importResultSchema.parse(data);

  revalidateClients();
  revalidatePath(`/tableros/${boardId}`);

  return {
    ok: true,
    summary: {
      cardsCreated: result.created,
      clientsCreated: result.clients_created,
      clientsMatched: result.clients_matched,
      skippedLines: result.skipped,
    },
  };
};

// --- Update ------------------------------------------------------------------

const updateClientSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Escribe el nombre del cliente.")
    .max(120, "Máximo 120 caracteres."),
  email: optional(z.email("El correo no es válido.").max(320)),
  phone: optional(z.string().trim().max(40, "Máximo 40 caracteres.")),
  notes: optional(z.string().trim().max(2000, "Máximo 2000 caracteres.")),
});

export const updateClient = async (
  clientId: number,
  input: z.input<typeof updateClientSchema>
): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("clients.manage")) {
    return { error: "No tienes permiso para editar clientes." };
  }

  const parsed = updateClientSchema.safeParse(input);

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
    })
    .eq("id", clientId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudieron guardar los datos del cliente." };
  }

  revalidateClients();
  revalidatePath("/tableros", "layout");
  return { ok: true };
};

// --- Delete ------------------------------------------------------------------

/** Removes the client together with their cards (and the cards' photos). */
export const deleteClient = async (clientId: number): Promise<ActionResult> => {
  const context = await requireStudio();

  if (!context.can("clients.manage")) {
    return { error: "No tienes permiso para eliminar clientes." };
  }

  const supabase = await createClient();
  const { data: cards } = await supabase
    .from("cards")
    .select("id, cover_path")
    .eq("client_id", clientId);

  if (cards?.length) {
    if (!context.can("cards.delete")) {
      return {
        error:
          "Este cliente tiene tarjetas y no tienes permiso para eliminarlas.",
      };
    }

    const { error } = await supabase
      .from("cards")
      .delete()
      .in(
        "id",
        cards.map((card) => card.id)
      );

    if (error) {
      return { error: "No se pudieron eliminar sus tarjetas." };
    }

    const covers = cards
      .map((card) => card.cover_path)
      .filter((path): path is string => Boolean(path));

    if (covers.length) {
      await supabase.storage.from("card-covers").remove(covers);
    }
  }

  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo eliminar el cliente." };
  }

  revalidateClients();
  revalidatePath("/tableros", "layout");
  return { ok: true };
};
