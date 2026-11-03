"use server";

import { createAdminClient } from "@repo/database/admin";
import { createClient } from "@repo/database/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ProductSize, parseProductSize } from "@/lib/gallery-products";
import { requireStudio } from "@/lib/studio";
import type { ActionResult } from "./boards";

/**
 * Studio settings of the Galleries module (Ajustes → Galerías): price of
 * each extra photo, the full unedited gallery offer and the book formats
 * (which sizes have a back cover).
 */

const NO_ACCESS = "No tienes permiso para cambiar los ajustes del estudio.";
const SIZE_FORMAT = "Escribe la medida así: 6x6.";

const requireSettings = async () => {
  const context = await requireStudio();
  return context.can("settings.manage") ? context : null;
};

const revalidateSettings = () => {
  revalidatePath("/ajustes");
  revalidatePath("/galerias", "layout");
};

const money = z
  .number({ error: "Escribe un precio." })
  .min(0, "El precio no puede ser negativo.")
  .max(99_999, "Como máximo 99.999.");

const settingsSchema = z.object({
  extraPhotoPrice: money,
  fullGalleryPrice: money.nullable(),
  fullGalleryNote: z
    .string()
    .trim()
    .max(300, "La descripción admite hasta 300 caracteres.")
    .transform((value) => value || null),
});

export type GallerySettings = z.input<typeof settingsSchema>;

export const updateGallerySettings = async (
  input: GallerySettings
): Promise<ActionResult> => {
  const context = await requireSettings();

  if (!context) {
    return { error: NO_ACCESS };
  }

  const parsed = settingsSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los ajustes." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studios")
    .update({
      extra_photo_price: parsed.data.extraPhotoPrice,
      full_gallery_price: parsed.data.fullGalleryPrice,
      full_gallery_note: parsed.data.fullGalleryNote,
    })
    .eq("id", context.studio.id)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudieron guardar los ajustes de galerías." };
  }

  revalidateSettings();
  return { ok: true };
};

// --- Book formats --------------------------------------------------------------

/**
 * Applies a format to the books of that size in galleries the client can
 * still change (draft or open); without a back cover, one already chosen is
 * cleared. Confirmed galleries keep what the client chose. The admin client
 * is needed because members have no grant on the client's choice columns;
 * the caller already checked settings.manage and everything is scoped to
 * the studio.
 */
const applyToOpenGalleries = async (
  studioId: number,
  size: ProductSize,
  backCover: boolean
) => {
  const admin = createAdminClient();
  const { data: galleries } = await admin
    .from("galleries")
    .select("id")
    .eq("studio_id", studioId)
    .in("status", ["draft", "open"]);
  const galleryIds = (galleries ?? []).map((gallery) => gallery.id);

  if (galleryIds.length === 0) {
    return;
  }

  await admin
    .from("gallery_products")
    .update(
      backCover
        ? { back_cover: true }
        : { back_cover: false, back_photo_id: null }
    )
    .eq("studio_id", studioId)
    .eq("kind", "book")
    .eq("size_short", size.short)
    .eq("size_long", size.long)
    .in("gallery_id", galleryIds);
};

export const addBookFormat = async (
  sizeText: string,
  backCover: boolean
): Promise<ActionResult> => {
  const context = await requireSettings();

  if (!context) {
    return { error: NO_ACCESS };
  }

  const size = parseProductSize(String(sizeText).slice(0, 20));

  if (!size) {
    return { error: SIZE_FORMAT };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("book_formats").insert({
    studio_id: context.studio.id,
    size_short: size.short,
    size_long: size.long,
    back_cover: Boolean(backCover),
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Esa medida ya está en la lista."
          : "No se pudo añadir la medida.",
    };
  }

  await applyToOpenGalleries(context.studio.id, size, Boolean(backCover));
  revalidateSettings();
  return { ok: true };
};

const formatId = z.number().int().positive();

export const setBookFormatBackCover = async (
  id: number,
  backCover: boolean
): Promise<ActionResult> => {
  const context = await requireSettings();

  if (!(context && formatId.safeParse(id).success)) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_formats")
    .update({ back_cover: Boolean(backCover) })
    .eq("id", id)
    .select("size_short, size_long");
  const row = data?.[0];

  if (error || !row) {
    return { error: "No se pudo guardar." };
  }

  await applyToOpenGalleries(
    context.studio.id,
    { short: row.size_short, long: row.size_long },
    Boolean(backCover)
  );
  revalidateSettings();
  return { ok: true };
};

/** Removes a size: its books go back to having a back cover. */
export const removeBookFormat = async (id: number): Promise<ActionResult> => {
  const context = await requireSettings();

  if (!(context && formatId.safeParse(id).success)) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_formats")
    .delete()
    .eq("id", id)
    .select("size_short, size_long");
  const row = data?.[0];

  if (error || !row) {
    return { error: "No se pudo quitar." };
  }

  await applyToOpenGalleries(
    context.studio.id,
    { short: row.size_short, long: row.size_long },
    true
  );
  revalidateSettings();
  return { ok: true };
};
