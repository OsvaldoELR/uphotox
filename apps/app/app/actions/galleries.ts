"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@repo/database/server";
import { isStorageConfigured, objectSize, signedPutUrl } from "@repo/storage";
import { galleryPhotoKeys } from "@repo/storage/gallery";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { POSITION_STEP } from "@/lib/board-templates";
import { isEmailEnabled } from "@/lib/email";
import {
  GALLERY_LINK_DAYS,
  type GalleryState,
  galleryState,
  isJpegName,
  MAX_GALLERY_PHOTOS,
  MAX_PREVIEW_BYTES,
  packageCountFromNotes,
} from "@/lib/gallery";
import { emailGalleryReady } from "@/lib/gallery-notify";
import {
  MAX_GALLERY_PRODUCTS,
  type ProductSpec,
  parseProductSize,
  productsFromNotes,
} from "@/lib/gallery-products";
import { scheduleStorageCleanup } from "@/lib/storage-cleanup";
import { requireStudio, type StudioContext } from "@/lib/studio";
import type { ActionResult } from "./boards";

const NO_ACCESS = "No tienes permiso para gestionar galerías.";
const NO_STORAGE =
  "Falta configurar el almacenamiento de fotos (Cloudflare R2).";
const NOT_FOUND = "No se encontró la galería.";

// Secret part of the client link: 256 random bits, 43 characters.
const newToken = () => randomBytes(32).toString("base64url");

const requireManager = async () => {
  const context = await requireStudio();
  return context.can("galleries.manage") ? context : null;
};

const revalidateGallery = (galleryId: number) => {
  revalidatePath("/galerias");
  revalidatePath(`/galerias/${galleryId}`);
};

const id = z.number().int().positive();
const PATH_SEPARATOR = /[\\/]/;

// --- Card summary --------------------------------------------------------------

export interface CardGallerySummary {
  readonly id: number;
  readonly photos: number;
  readonly picked: number;
  readonly state: GalleryState;
}

/** The card's gallery for the card panel, or null (none, or no access). */
export const getCardGallery = async (
  cardId: number
): Promise<CardGallerySummary | null> => {
  const context = await requireStudio();

  if (!(context.can("galleries.view") || context.can("galleries.manage"))) {
    return null;
  }

  const supabase = await createClient();
  const { data: gallery } = await supabase
    .from("galleries")
    .select("id, status, expires_at")
    .eq("card_id", cardId)
    .maybeSingle();

  if (!gallery) {
    return null;
  }

  const [photos, picked] = await Promise.all([
    supabase
      .from("gallery_photos")
      .select("id", { count: "exact", head: true })
      .eq("gallery_id", gallery.id)
      .not("uploaded_at", "is", null),
    supabase
      .from("gallery_photos")
      .select("id", { count: "exact", head: true })
      .eq("gallery_id", gallery.id)
      .not("picked_at", "is", null),
  ]);

  return {
    id: gallery.id,
    state: galleryState({
      status: gallery.status,
      expiresAt: gallery.expires_at,
    }),
    photos: photos.count ?? 0,
    picked: picked.count ?? 0,
  };
};

// --- Create --------------------------------------------------------------------

export const createGallery = async (
  cardId: number
): Promise<{ galleryId: number } | { error: string }> => {
  const context = await requireManager();

  if (!context) {
    return { error: NO_ACCESS };
  }

  if (!isStorageConfigured()) {
    return { error: NO_STORAGE };
  }

  const supabase = await createClient();
  const [{ data: card }, { data: studio }] = await Promise.all([
    supabase.from("cards").select("id, notes").eq("id", cardId).maybeSingle(),
    supabase
      .from("studios")
      .select("extra_photo_price")
      .eq("id", context.studio.id)
      .single(),
  ]);

  if (!card) {
    return { error: "No se encontró la tarjeta." };
  }

  const { data, error } = await supabase
    .from("galleries")
    .insert({
      studio_id: context.studio.id,
      card_id: card.id,
      token: newToken(),
      included_count: packageCountFromNotes(card.notes),
      extra_price: studio?.extra_photo_price ?? 20,
    })
    .select("id")
    .single();

  if (error) {
    // Someone created it a moment ago: open that one.
    const { data: existing } = await supabase
      .from("galleries")
      .select("id")
      .eq("card_id", card.id)
      .maybeSingle();

    return existing
      ? { galleryId: existing.id }
      : { error: "No se pudo crear la galería." };
  }

  // Book and canvas named in the offer: the client will pick their photos.
  await insertProducts(
    supabase,
    context.studio.id,
    data.id,
    productsFromNotes(card.notes)
  );

  revalidatePath("/galerias");
  return { galleryId: data.id };
};

// --- Settings ------------------------------------------------------------------

const includedCountSchema = z
  .number()
  .int("Escribe un número entero.")
  .min(0, "No puede ser negativo.")
  .max(2000, "Como máximo 2000.")
  .nullable();

export const updateIncludedCount = async (
  galleryId: number,
  includedCount: number | null
): Promise<ActionResult> => {
  if (!(await requireManager())) {
    return { error: NO_ACCESS };
  }

  const parsed = includedCountSchema.safeParse(includedCount);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Número no válido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("galleries")
    .update({ included_count: parsed.data })
    .eq("id", galleryId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo guardar." };
  }

  revalidateGallery(galleryId);
  return { ok: true };
};

// --- Package products (book, canvas) -----------------------------------------

const insertProducts = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  studioId: number,
  galleryId: number,
  products: readonly ProductSpec[]
) => {
  if (products.length === 0) {
    return true;
  }

  const { error } = await supabase.from("gallery_products").insert(
    products.map((product) => ({
      studio_id: studioId,
      gallery_id: galleryId,
      kind: product.kind,
      size_short: product.short,
      size_long: product.long,
    }))
  );

  return !error;
};

const productSchema = z.object({
  galleryId: id,
  kind: z.enum(["book", "canvas"]),
  size: z.string().trim().min(1).max(20),
});

const countProducts = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  galleryId: number
) => {
  const { data } = await supabase
    .from("gallery_products")
    .select("kind, size_short, size_long")
    .eq("gallery_id", galleryId);
  return data ?? [];
};

/** Adds a book or canvas to the package, e.g. kind «book», size «8x11». */
export const addGalleryProduct = async (
  input: z.input<typeof productSchema>
): Promise<ActionResult> => {
  const context = await requireManager();

  if (!context) {
    return { error: NO_ACCESS };
  }

  const parsed = productSchema.safeParse(input);
  const size = parsed.success ? parseProductSize(parsed.data.size) : null;

  if (!(parsed.success && size)) {
    return { error: "Escribe la medida así: 8x11." };
  }

  const supabase = await createClient();
  const existing = await countProducts(supabase, parsed.data.galleryId);

  if (existing.length >= MAX_GALLERY_PRODUCTS) {
    return { error: `Como máximo ${MAX_GALLERY_PRODUCTS} productos.` };
  }

  const saved = await insertProducts(
    supabase,
    context.studio.id,
    parsed.data.galleryId,
    [{ kind: parsed.data.kind, ...size }]
  );

  if (!saved) {
    return { error: "No se pudo añadir." };
  }

  revalidateGallery(parsed.data.galleryId);
  return { ok: true };
};

/** Adds the books and canvases the card notes mention and are not there yet. */
export const addProductsFromNotes = async (
  galleryId: number
): Promise<ActionResult> => {
  const context = await requireManager();

  if (!(context && id.safeParse(galleryId).success)) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data: gallery } = await supabase
    .from("galleries")
    .select("id, card:cards!galleries_card_id_studio_id_fkey(notes)")
    .eq("id", galleryId)
    .maybeSingle();

  if (!gallery) {
    return { error: NOT_FOUND };
  }

  const existing = await countProducts(supabase, galleryId);
  const have = new Set(
    existing.map((row) => `${row.kind}:${row.size_short}x${row.size_long}`)
  );
  const missing = productsFromNotes(gallery.card?.notes ?? null)
    .filter(
      (product) => !have.has(`${product.kind}:${product.short}x${product.long}`)
    )
    .slice(0, Math.max(0, MAX_GALLERY_PRODUCTS - existing.length));

  if (
    !(await insertProducts(supabase, context.studio.id, galleryId, missing))
  ) {
    return { error: "No se pudo añadir." };
  }

  revalidateGallery(galleryId);
  return { ok: true };
};

export const removeGalleryProduct = async (
  galleryId: number,
  productId: number
): Promise<ActionResult> => {
  if (!(await requireManager())) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gallery_products")
    .delete()
    .eq("id", productId)
    .eq("gallery_id", galleryId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo quitar." };
  }

  revalidateGallery(galleryId);
  return { ok: true };
};

// --- Upload --------------------------------------------------------------------

const uploadFileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((name) => !PATH_SEPARATOR.test(name) && isJpegName(name), {
      message: "Solo se admiten fotos JPG.",
    }),
  bytes: z.number().int().positive().max(MAX_PREVIEW_BYTES),
  width: z.number().int().positive().max(30_000),
  height: z.number().int().positive().max(30_000),
});

const uploadBatchSchema = z.array(uploadFileSchema).min(1).max(50);

export type UploadFile = z.infer<typeof uploadFileSchema>;

export interface PreparedUpload {
  readonly id: number;
  readonly name: string;
  readonly previewUrl: string;
  readonly thumbnailUrl: string;
}

const readGallery = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  galleryId: number
) => {
  const { data } = await supabase
    .from("galleries")
    .select("id, studio_id, purged_at")
    .eq("id", galleryId)
    .maybeSingle();
  return data;
};

/**
 * Registers a batch of photos and returns presigned URLs so the browser
 * uploads them straight to R2. Names already uploaded are skipped; names
 * whose upload never finished get new URLs (same row).
 */
export const prepareGalleryUploads = async (
  galleryId: number,
  files: UploadFile[]
): Promise<
  | { readonly skipped: string[]; readonly uploads: PreparedUpload[] }
  | { readonly error: string }
> => {
  if (!(await requireManager())) {
    return { error: NO_ACCESS };
  }

  if (!isStorageConfigured()) {
    return { error: NO_STORAGE };
  }

  const parsed = uploadBatchSchema.safeParse(files);

  if (!(parsed.success && id.safeParse(galleryId).success)) {
    return { error: "Revisa los archivos: solo fotos JPG de hasta 10 MB." };
  }

  const supabase = await createClient();
  const gallery = await readGallery(supabase, galleryId);

  if (!gallery) {
    return { error: NOT_FOUND };
  }

  if (gallery.purged_at) {
    return { error: "Las fotos de esta galería ya se borraron." };
  }

  const batch = [
    ...new Map(parsed.data.map((file) => [file.name, file])).values(),
  ];
  const [{ data: existing }, { count }] = await Promise.all([
    supabase
      .from("gallery_photos")
      .select("id, file_name, uploaded_at")
      .eq("gallery_id", galleryId)
      .in(
        "file_name",
        batch.map((file) => file.name)
      ),
    supabase
      .from("gallery_photos")
      .select("id", { count: "exact", head: true })
      .eq("gallery_id", galleryId),
  ]);

  const known = new Map((existing ?? []).map((row) => [row.file_name, row]));
  const fresh = batch.filter((file) => !known.has(file.name));

  if ((count ?? 0) + fresh.length > MAX_GALLERY_PHOTOS) {
    return {
      error: `Una galería admite hasta ${MAX_GALLERY_PHOTOS} fotos.`,
    };
  }

  let inserted: { file_name: string; id: number }[] = [];

  if (fresh.length) {
    const { data, error } = await supabase
      .from("gallery_photos")
      .insert(
        fresh.map((file) => ({
          studio_id: gallery.studio_id,
          gallery_id: galleryId,
          file_name: file.name,
          bytes: file.bytes,
          width: file.width,
          height: file.height,
        }))
      )
      .select("id, file_name");

    if (error) {
      return { error: "No se pudieron registrar las fotos. Reintenta." };
    }

    inserted = data;
  }

  const pending = [
    ...inserted,
    ...(existing ?? []).filter((row) => !row.uploaded_at),
  ];
  const uploads = await Promise.all(
    pending.map(async (row) => {
      const keys = galleryPhotoKeys({
        studioId: gallery.studio_id,
        galleryId,
        id: row.id,
      });
      const [previewUrl, thumbnailUrl] = await Promise.all([
        signedPutUrl(keys.preview),
        signedPutUrl(keys.thumbnail),
      ]);

      return { id: row.id, name: row.file_name, previewUrl, thumbnailUrl };
    })
  );

  return {
    uploads,
    skipped: (existing ?? [])
      .filter((row) => row.uploaded_at)
      .map((row) => row.file_name),
  };
};

/**
 * Marks photos as uploaded once both files are really in R2 (and the
 * preview is not oversized). Returns the ids that could not be confirmed.
 */
export const confirmGalleryUploads = async (
  galleryId: number,
  photoIds: number[]
): Promise<{ readonly failed: number[] } | { readonly error: string }> => {
  if (!(await requireManager())) {
    return { error: NO_ACCESS };
  }

  const ids = z.array(id).min(1).max(50).safeParse(photoIds);

  if (!ids.success) {
    return { error: "Revisa las fotos." };
  }

  const supabase = await createClient();
  const gallery = await readGallery(supabase, galleryId);

  if (!gallery) {
    return { error: NOT_FOUND };
  }

  const { data: rows } = await supabase
    .from("gallery_photos")
    .select("id")
    .eq("gallery_id", galleryId)
    .in("id", ids.data);

  const checked = await Promise.all(
    (rows ?? []).map(async (row) => {
      const keys = galleryPhotoKeys({
        studioId: gallery.studio_id,
        galleryId,
        id: row.id,
      });
      const [preview, thumbnail] = await Promise.all([
        objectSize(keys.preview),
        objectSize(keys.thumbnail),
      ]);
      const ok =
        preview !== null &&
        thumbnail !== null &&
        preview > 0 &&
        preview <= MAX_PREVIEW_BYTES;

      return { id: row.id, ok };
    })
  );
  const confirmed = checked.filter((row) => row.ok).map((row) => row.id);

  if (confirmed.length) {
    const { error } = await supabase
      .from("gallery_photos")
      .update({ uploaded_at: new Date().toISOString() })
      .in("id", confirmed);

    if (error) {
      return { error: "No se pudieron confirmar las fotos." };
    }

    revalidateGallery(galleryId);
  }

  return { failed: ids.data.filter((photoId) => !confirmed.includes(photoId)) };
};

// --- Delete --------------------------------------------------------------------

/** Removes some photos, or all of them when photoIds is "all". */
export const deleteGalleryPhotos = async (
  galleryId: number,
  photoIds: number[] | "all"
): Promise<ActionResult> => {
  if (!(await requireManager())) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  let query = supabase
    .from("gallery_photos")
    .delete()
    .eq("gallery_id", galleryId);

  if (photoIds !== "all") {
    const ids = z.array(id).min(1).max(MAX_GALLERY_PHOTOS).safeParse(photoIds);

    if (!ids.success) {
      return { error: "Revisa las fotos." };
    }

    query = query.in("id", ids.data);
  }

  const { error } = await query;

  if (error) {
    return { error: "No se pudieron eliminar las fotos." };
  }

  scheduleStorageCleanup();
  revalidateGallery(galleryId);
  return { ok: true };
};

export const deleteGallery = async (
  galleryId: number
): Promise<ActionResult> => {
  if (!(await requireManager())) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("galleries")
    .delete()
    .eq("id", galleryId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo eliminar la galería." };
  }

  scheduleStorageCleanup();
  revalidatePath("/galerias");
  return { ok: true };
};

// --- Send and reopen -----------------------------------------------------------

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const DAY_MS = 86_400_000;

/**
 * Moves the card to its board's stage with this gallery role, first in the
 * stage. Skipped when the board has none, the card is already there or the
 * member cannot move cards. No stage email: the gallery sends its own.
 */
const moveCardToGalleryStage = async (
  supabase: ServerClient,
  context: StudioContext,
  cardId: number,
  role: "sent" | "submitted"
) => {
  if (!context.can("cards.move")) {
    return null;
  }

  const { data: card } = await supabase
    .from("cards")
    .select("id, stage_id, board_id")
    .eq("id", cardId)
    .maybeSingle();

  if (!card) {
    return null;
  }

  const { data: stage } = await supabase
    .from("board_stages")
    .select("id")
    .eq("board_id", card.board_id)
    .eq("gallery_role", role)
    .maybeSingle();

  if (!stage || stage.id === card.stage_id) {
    return null;
  }

  const { data: first } = await supabase
    .from("cards")
    .select("position")
    .eq("stage_id", stage.id)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("cards")
    .update({
      stage_id: stage.id,
      position: (first?.position ?? POSITION_STEP) - POSITION_STEP,
    })
    .eq("id", card.id);

  return error ? null : { boardId: card.board_id };
};

const linkExpiry = () =>
  new Date(Date.now() + GALLERY_LINK_DAYS * DAY_MS).toISOString();

/**
 * Opens the gallery to the client (or sends it again, renewing the link for
 * 60 days): the card moves to the «sent» stage and the client gets an email
 * with the link. Returns whether that email goes out.
 */
export const sendGallery = async (
  galleryId: number
): Promise<{ readonly emailed: boolean } | { readonly error: string }> => {
  const context = await requireManager();

  if (!context) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data: gallery } = await supabase
    .from("galleries")
    .select(
      "id, status, sent_at, purged_at, card_id, card:cards!galleries_card_id_studio_id_fkey(client:clients(email))"
    )
    .eq("id", galleryId)
    .maybeSingle();

  if (!gallery) {
    return { error: NOT_FOUND };
  }

  if (gallery.purged_at) {
    return { error: "Las fotos de esta galería ya se borraron." };
  }

  if (gallery.status === "submitted") {
    return {
      error:
        "El cliente ya confirmó su selección. Reábrela si necesita cambiarla.",
    };
  }

  const { count } = await supabase
    .from("gallery_photos")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", galleryId)
    .not("uploaded_at", "is", null);

  if (!count) {
    return { error: "Sube al menos una foto antes de enviar la galería." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("galleries")
    .update({
      status: "open",
      sent_at: gallery.sent_at ?? now,
      expires_at: linkExpiry(),
    })
    .eq("id", galleryId);

  if (error) {
    return { error: "No se pudo enviar la galería." };
  }

  const moved = await moveCardToGalleryStage(
    supabase,
    context,
    gallery.card_id,
    "sent"
  );
  await supabase.from("card_events").insert({
    studio_id: context.studio.id,
    card_id: gallery.card_id,
    kind: "gallery_sent",
  });

  const emailed = isEmailEnabled() && Boolean(gallery.card?.client?.email);

  if (emailed) {
    after(() => emailGalleryReady(galleryId, now));
  }

  revalidateGallery(galleryId);
  revalidatePath("/");

  if (moved) {
    revalidatePath(`/tableros/${moved.boardId}`);
  }

  return { emailed };
};

/** Lets the client change a confirmed selection (60 more days). */
export const reopenGallery = async (
  galleryId: number
): Promise<ActionResult> => {
  const context = await requireManager();

  if (!context) {
    return { error: NO_ACCESS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("galleries")
    .update({ status: "open", submitted_at: null, expires_at: linkExpiry() })
    .eq("id", galleryId)
    .eq("status", "submitted")
    .is("purged_at", null)
    .select("card_id");
  const cardId = data?.[0]?.card_id;

  if (error || !cardId) {
    return { error: "No se pudo reabrir la selección." };
  }

  const moved = await moveCardToGalleryStage(supabase, context, cardId, "sent");
  await supabase.from("card_events").insert({
    studio_id: context.studio.id,
    card_id: cardId,
    kind: "gallery_reopened",
  });

  revalidateGallery(galleryId);
  revalidatePath("/");

  if (moved) {
    revalidatePath(`/tableros/${moved.boardId}`);
  }

  return { ok: true };
};
