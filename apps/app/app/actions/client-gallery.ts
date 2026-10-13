"use server";

import { createAdminClient } from "@repo/database/admin";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { galleryState } from "@/lib/gallery";
import { notifyGallerySubmitted } from "@/lib/gallery-notify";

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
    .select("id, status, expires_at, purged_at")
    .eq("token", token)
    .maybeSingle();

  if (
    !data ||
    data.purged_at ||
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
    return {
      error:
        error.code === "22023"
          ? "Elige al menos una foto antes de confirmar."
          : CLOSED,
    };
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
