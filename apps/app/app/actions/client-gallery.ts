"use server";

import { createAdminClient } from "@repo/database/admin";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { galleryState } from "@/lib/gallery";
import { notifyGallerySubmitted } from "@/lib/gallery-notify";
import {
  type ChoicePhoto,
  type ChoiceSlot,
  choiceProblem,
  type ProductChoice,
  type ProductKind,
} from "@/lib/gallery-products";
import { moduleAvailable } from "@/lib/permissions";

/**
 * Actions of the public client page (/g/<token>). There is no session: the
 * secret token is the only credential, so every query goes through the
 * service role and is scoped to the gallery that token opens.
 */

const TOKEN = /^[\w-]{32,64}$/;
const CLOSED =
  "Esta galería ya no admite cambios. Escríbenos por WhatsApp si necesitas algo.";
const OFFLINE = "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.";

type Result = { readonly ok: true } | { readonly error: string };

/** The gallery behind the token, only while the client can still pick. */
const openGalleryByToken = async (token: string) => {
  if (!TOKEN.test(token)) {
    return null;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("galleries")
    .select(
      "id, status, expires_at, purged_at, studio:studios(modules, suspended_at)"
    )
    .eq("token", token)
    .maybeSingle();

  if (
    !data ||
    data.purged_at ||
    !moduleAvailable(data.studio, "galleries") ||
    galleryState({ status: data.status, expiresAt: data.expires_at }) !== "open"
  ) {
    return null;
  }

  return { admin, galleryId: data.id };
};

const pickSchema = z.object({
  photoId: z.number().int().positive(),
  picked: z.boolean(),
});

/** Marks or unmarks one photo as a favourite. */
export const setPhotoPicked = async (
  token: string,
  photoId: number,
  picked: boolean
): Promise<Result> => {
  const input = pickSchema.safeParse({ photoId, picked });

  if (!input.success) {
    return { error: OFFLINE };
  }

  const gallery = await openGalleryByToken(token);

  if (!gallery) {
    return { error: CLOSED };
  }

  const { data, error } = await gallery.admin
    .from("gallery_photos")
    .update({ picked_at: input.data.picked ? new Date().toISOString() : null })
    .eq("id", input.data.photoId)
    .eq("gallery_id", gallery.galleryId)
    .not("uploaded_at", "is", null)
    .select("id");

  if (error || !data?.length) {
    return { error: OFFLINE };
  }

  return { ok: true };
};

const choiceSchema = z.object({
  productId: z.number().int().positive(),
  slot: z.enum(["photo", "back"]),
  photoId: z.number().int().positive().nullable(),
});

/**
 * Sets (or clears, with null) a front cover, back cover or canvas photo. The
 * photo must be one of the favourites; a new front cover clears a back cover
 * that no longer fits it (other orientation, or the same photo).
 */
export const setProductPhoto = async (
  token: string,
  productId: number,
  slot: ChoiceSlot,
  photoId: number | null
): Promise<Result> => {
  const input = choiceSchema.safeParse({ productId, slot, photoId });

  if (!input.success) {
    return { error: OFFLINE };
  }

  const gallery = await openGalleryByToken(token);

  if (!gallery) {
    return { error: CLOSED };
  }

  const { admin, galleryId } = gallery;
  const { data: row } = await admin
    .from("gallery_products")
    .select("id, kind, size_short, size_long, photo_id, back_photo_id")
    .eq("id", input.data.productId)
    .eq("gallery_id", galleryId)
    .maybeSingle();

  if (!row) {
    return { error: CLOSED };
  }

  const column = input.data.slot === "photo" ? "photo_id" : "back_photo_id";
  let update: { photo_id?: number | null; back_photo_id?: number | null } = {
    [column]: input.data.photoId,
  };

  if (input.data.photoId !== null) {
    const product: ProductChoice = {
      id: row.id,
      kind: row.kind as ProductKind,
      short: row.size_short,
      long: row.size_long,
      photoId: row.photo_id,
      backPhotoId: row.back_photo_id,
    };
    const ids = [input.data.photoId, row.photo_id, row.back_photo_id].filter(
      (value): value is number => value !== null
    );
    const { data: rows } = await admin
      .from("gallery_photos")
      .select("id, file_name, width, height, picked_at, uploaded_at")
      .eq("gallery_id", galleryId)
      .in("id", ids);
    const photos = new Map<number, ChoicePhoto>(
      (rows ?? []).map((photo) => [
        photo.id,
        {
          name: photo.file_name,
          width: photo.width ?? 3,
          height: photo.height ?? 2,
          picked: Boolean(photo.picked_at && photo.uploaded_at),
        },
      ])
    );
    const problem = choiceProblem({
      photoId: input.data.photoId,
      photos,
      product,
      slot: input.data.slot,
    });

    if (problem) {
      return { error: problem };
    }

    const back = row.back_photo_id;

    if (
      input.data.slot === "photo" &&
      back !== null &&
      choiceProblem({
        photoId: back,
        photos,
        product: { ...product, photoId: input.data.photoId },
        slot: "back",
      }) !== null
    ) {
      update = { ...update, back_photo_id: null };
    }
  }

  const { data, error } = await admin
    .from("gallery_products")
    .update(update)
    .eq("id", row.id)
    .eq("gallery_id", galleryId)
    .select("id");

  if (error || !data?.length) {
    return { error: OFFLINE };
  }

  return { ok: true };
};

interface SubmitResult {
  readonly from_stage_id: number;
  readonly to_stage_id: number | null;
}

/** Sends the selection to the studio. After this it is locked. */
export const confirmSelection = async (
  token: string,
  note: string
): Promise<Result> => {
  const gallery = await openGalleryByToken(token);

  if (!gallery) {
    return { error: CLOSED };
  }

  const { data, error } = await gallery.admin.rpc("submit_gallery_selection", {
    p_gallery_id: gallery.galleryId,
    p_client_note: note.slice(0, 1000),
  });

  if (error) {
    const messages: Record<string, string> = {
      "22023": "Elige al menos una foto antes de confirmar.",
      "23514":
        "Antes de confirmar, elige entre tus favoritas las portadas de tu libro y la foto de tu canvas.",
    };
    return { error: messages[error.code] ?? CLOSED };
  }

  const result = data as unknown as SubmitResult;

  after(() =>
    notifyGallerySubmitted({
      galleryId: gallery.galleryId,
      fromStageId: result.from_stage_id,
      toStageId: result.to_stage_id,
    })
  );

  revalidatePath(`/g/${token}`);
  revalidatePath("/galerias");
  revalidatePath(`/galerias/${gallery.galleryId}`);
  revalidatePath("/tableros", "layout");
  revalidatePath("/");
  return { ok: true };
};
