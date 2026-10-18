"use server";

import { createAdminClient } from "@repo/database/admin";
import { createClient } from "@repo/database/server";
import { log } from "@repo/observability/log";
import { objectSize, readObjectText, signedPutUrl } from "@repo/storage";
import { editPhotoKeys } from "@repo/storage/editor";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type EngineStatus,
  MAX_ORIGINAL_BYTES,
  MIN_ORIGINAL_BYTES,
  matchOriginals,
  statusUpdate,
} from "@/lib/editor";
import {
  EditorServiceError,
  isEditorConfigured,
  queueEditPhoto,
} from "@/lib/editor-service";
import { isJpegName } from "@/lib/gallery";
import { requireStudio } from "@/lib/studio";

/**
 * Editor module: the studio uploads the full-size exports of the photos the
 * client picked; the Cloudflare service cleans their backdrops. Status and
 * costs come from the service (status.json in R2) and are written with the
 * admin client after the member's access was checked through RLS, so members
 * can never set them.
 */

const NO_ACCESS = "No tienes permiso para usar el editor.";
const NOT_READY =
  "El editor no está configurado todavía (servicio de Cloudflare y R2).";
const NOT_FOUND = "No se encontró la galería.";
const PATH_SEPARATOR = /[\\/]/;
// Upload links last an hour: a 20 MB photo on a slow line takes minutes.
const UPLOAD_URL_SECONDS = 3600;
const STATUS_READS_AT_ONCE = 8;

const id = z.number().int().positive();

const fileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((name) => !PATH_SEPARATOR.test(name) && isJpegName(name)),
  bytes: z.number().int().positive().max(MAX_ORIGINAL_BYTES),
});

const batchSchema = z.array(fileSchema).min(1).max(50);

export type OriginalFile = z.infer<typeof fileSchema>;

export interface PreparedOriginal {
  readonly id: number;
  /** The dropped file's name, to find it again in the browser. */
  readonly name: string;
  readonly uploadUrl: string;
}

const requireEditor = async () => {
  const context = await requireStudio();
  return context.can("editor.access") ? context : null;
};

const revalidateEditor = (galleryId: number) => {
  revalidatePath(`/galerias/${galleryId}/limpieza`);
  revalidatePath(`/galerias/${galleryId}`);
  revalidatePath("/editor");
};

/** In batches, so a long list does not open dozens of requests at once. */
const inBatches = async <T, R>(
  items: readonly T[],
  size: number,
  task: (item: T) => Promise<R>
) => {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += size) {
    results.push(
      ...(await Promise.all(items.slice(index, index + size).map(task)))
    );
  }

  return results;
};

/**
 * Registers full-size exports and returns presigned URLs, so the browser
 * uploads them straight to R2. Files are paired with the client's picks by
 * name; picks already sent to the service are skipped (a redo is a separate
 * action). A pick whose upload finished but was never queued (the service
 * was down) is «ready»: it goes straight to confirm, without uploading it
 * again; one whose upload never finished gets a new URL.
 */
export const prepareEditUploads = async (
  galleryId: number,
  files: OriginalFile[]
): Promise<
  | {
      readonly ready: { readonly id: number; readonly name: string }[];
      readonly rejected: string[];
      readonly skipped: string[];
      readonly uploads: PreparedOriginal[];
    }
  | { readonly error: string }
> => {
  if (!(await requireEditor())) {
    return { error: NO_ACCESS };
  }

  if (!isEditorConfigured()) {
    return { error: NOT_READY };
  }

  const parsed = batchSchema.safeParse(files);

  if (!(parsed.success && id.safeParse(galleryId).success)) {
    return { error: "Revisa los archivos: fotos JPG de hasta 80 MB." };
  }

  const supabase = await createClient();
  const { data: gallery } = await supabase
    .from("galleries")
    .select("id, studio_id, purged_at")
    .eq("id", galleryId)
    .maybeSingle();

  if (!gallery) {
    return { error: NOT_FOUND };
  }

  if (gallery.purged_at) {
    return { error: "Las fotos de esta galería ya se borraron." };
  }

  const { data: picks } = await supabase
    .from("gallery_photos")
    .select("id, file_name")
    .eq("gallery_id", galleryId)
    .not("picked_at", "is", null);
  const { pairs, notPicked, notJpeg } = matchOriginals(
    (picks ?? []).map((pick) => ({ id: pick.id, fileName: pick.file_name })),
    parsed.data
  );
  const rejected = [...notPicked, ...notJpeg].map((file) => file.name);

  if (pairs.length === 0) {
    return { ready: [], rejected, skipped: [], uploads: [] };
  }

  const { data: existing } = await supabase
    .from("edit_photos")
    .select("id, gallery_photo_id, status")
    .eq("gallery_id", galleryId)
    .in(
      "gallery_photo_id",
      pairs.map((pair) => pair.photo.id)
    );
  const known = new Map(
    (existing ?? []).map((row) => [row.gallery_photo_id, row])
  );
  const fresh = pairs.filter((pair) => !known.has(pair.photo.id));
  let inserted: { gallery_photo_id: number; id: number }[] = [];

  if (fresh.length) {
    const { data, error } = await supabase
      .from("edit_photos")
      .insert(
        fresh.map((pair) => ({
          studio_id: gallery.studio_id,
          gallery_id: galleryId,
          gallery_photo_id: pair.photo.id,
          file_name: pair.file.name,
          bytes: pair.file.bytes,
        }))
      )
      .select("id, gallery_photo_id");

    if (error) {
      return { error: "No se pudieron registrar las fotos. Reintenta." };
    }

    inserted = data;
  }

  const rowIds = new Map([
    ...inserted.map((row) => [row.gallery_photo_id, row.id] as const),
    ...(existing ?? [])
      .filter((row) => row.status === "uploading")
      .map((row) => [row.gallery_photo_id, row.id] as const),
  ]);
  const resumed = new Set(
    (existing ?? [])
      .filter((row) => row.status === "uploading")
      .map((row) => row.id)
  );
  const targets = await Promise.all(
    pairs
      .filter((pair) => rowIds.has(pair.photo.id))
      .map(async (pair) => {
        const rowId = rowIds.get(pair.photo.id) as number;
        const keys = editPhotoKeys({
          studioId: gallery.studio_id,
          galleryId,
          id: rowId,
        });
        // Same file already in R2 (only the queueing failed): no re-upload.
        const stored = resumed.has(rowId)
          ? await objectSize(keys.original)
          : null;

        return stored === pair.file.bytes
          ? { id: rowId, name: pair.file.name, uploadUrl: null }
          : {
              id: rowId,
              name: pair.file.name,
              uploadUrl: await signedPutUrl(keys.original, UPLOAD_URL_SECONDS),
            };
      })
  );

  return {
    uploads: targets.filter(
      (target): target is PreparedOriginal => target.uploadUrl !== null
    ),
    ready: targets
      .filter((target) => target.uploadUrl === null)
      .map((target) => ({ id: target.id, name: target.name })),
    rejected,
    skipped: pairs
      .filter((pair) => !rowIds.has(pair.photo.id))
      .map((pair) => pair.file.name),
  };
};

export interface UnsentPhoto {
  readonly id: number;
  readonly reason: string;
}

const SERVICE_DOWN = "El servicio de limpieza no respondió. Reintenta.";
const BAD_KEY =
  "El servicio de limpieza rechazó la clave (EDITOR_TOKEN en Cloudflare y Vercel).";

/** Why a stored original cannot be queued, or null when it can. */
const originalProblem = (size: number | null) => {
  if (!size) {
    return "No llegó completa";
  }

  if (size < MIN_ORIGINAL_BYTES) {
    return "Es una copia pequeña: expórtala a tamaño completo";
  }

  return size > MAX_ORIGINAL_BYTES ? "Pesa más de 80 MB" : null;
};

/**
 * Checks that the originals really are in R2 and queues them in the
 * Cloudflare service. Returns the photos that could not be sent and why
 * (they stay «sin subir» and can be dropped again).
 */
export const confirmEditUploads = async (
  galleryId: number,
  photoIds: number[]
): Promise<{ readonly failed: UnsentPhoto[] } | { readonly error: string }> => {
  if (!(await requireEditor())) {
    return { error: NO_ACCESS };
  }

  const ids = z.array(id).min(1).max(50).safeParse(photoIds);

  if (!(ids.success && isEditorConfigured())) {
    return { error: ids.success ? NOT_READY : "Revisa las fotos." };
  }

  // RLS: only photos of galleries this member can see.
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("edit_photos")
    .select("id, studio_id, gallery_id, status, runs")
    .eq("gallery_id", galleryId)
    .eq("status", "uploading")
    .in("id", ids.data);
  const admin = createAdminClient();

  const sent = await inBatches(rows ?? [], 5, async (row) => {
    const keys = editPhotoKeys({
      studioId: row.studio_id,
      galleryId: row.gallery_id,
      id: row.id,
    });

    try {
      const problem = originalProblem(await objectSize(keys.original));

      if (problem) {
        return { id: row.id, reason: problem };
      }

      await queueEditPhoto({ key: keys.original, prefix: keys.prefix });
      const { error } = await admin
        .from("edit_photos")
        .update({
          status: "queued",
          runs: row.runs + 1,
          queued_at: new Date().toISOString(),
          finished_at: null,
          error: null,
        })
        .eq("id", row.id)
        .eq("studio_id", row.studio_id);

      return error ? { id: row.id, reason: SERVICE_DOWN } : null;
    } catch (error) {
      log.error("Editor: could not queue a photo", {
        photo: row.id,
        error: String(error),
      });
      const refused =
        error instanceof EditorServiceError &&
        (error.status === 401 || error.status === 403);
      return { id: row.id, reason: refused ? BAD_KEY : SERVICE_DOWN };
    }
  });

  revalidateEditor(galleryId);
  const known = new Set((rows ?? []).map((row) => row.id));

  return {
    failed: [
      ...sent.filter((value): value is UnsentPhoto => value !== null),
      // Not «sin subir» any more (or not this member's): nothing to send.
      ...ids.data
        .filter((photoId) => !known.has(photoId))
        .map((photoId) => ({ id: photoId, reason: "Ya estaba enviada" })),
    ],
  };
};

interface ActiveRow {
  readonly gallery_id: number;
  readonly id: number;
  readonly runs: number;
  readonly status: string;
  readonly studio_id: number;
}

/** Reads one photo's status.json and stores what changed. */
const syncPhoto = async (
  admin: ReturnType<typeof createAdminClient>,
  row: ActiveRow
) => {
  const keys = editPhotoKeys({
    studioId: row.studio_id,
    galleryId: row.gallery_id,
    id: row.id,
  });
  const raw = await readObjectText(keys.status);
  const update = raw ? statusUpdate(JSON.parse(raw) as EngineStatus) : null;

  if (!update || update.status === row.status) {
    return false;
  }

  if (update.status === "queued" || update.status === "processing") {
    await admin
      .from("edit_photos")
      .update({ status: update.status })
      .eq("id", row.id)
      .eq("runs", row.runs);
    return true;
  }

  // The run's cost goes to the usage ledger once (unique photo + run).
  await admin.from("edit_usage").upsert(
    {
      studio_id: row.studio_id,
      edit_photo_id: row.id,
      gallery_id: row.gallery_id,
      run: row.runs,
      cost: update.cost,
      succeeded: update.status === "done",
    },
    { onConflict: "edit_photo_id,run", ignoreDuplicates: true }
  );
  await admin
    .from("edit_photos")
    .update(
      update.status === "done"
        ? {
            status: "done",
            score: update.score,
            needs_review: update.needsReview,
            review_comment: update.comment,
            error: null,
            finished_at: update.finishedAt,
          }
        : {
            status: "failed",
            error: update.error,
            finished_at: update.finishedAt,
          }
    )
    .eq("id", row.id)
    .eq("runs", row.runs);
  return true;
};

/**
 * Brings the gallery's photos in progress up to date with the service.
 * Called by the clean-up page while it is open; returns how many are still
 * in progress.
 */
export const refreshEditPhotos = async (
  galleryId: number
): Promise<
  | { readonly active: number; readonly changed: number }
  | { readonly error: string }
> => {
  if (!(await requireEditor())) {
    return { error: NO_ACCESS };
  }

  if (!(id.safeParse(galleryId).success && isEditorConfigured())) {
    return { error: NOT_READY };
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("edit_photos")
    .select("id, studio_id, gallery_id, status, runs")
    .eq("gallery_id", galleryId)
    .in("status", ["queued", "processing"]);
  const active = rows ?? [];

  if (active.length === 0) {
    return { active: 0, changed: 0 };
  }

  const admin = createAdminClient();
  const changes = await inBatches(active, STATUS_READS_AT_ONCE, (row) =>
    syncPhoto(admin, row).catch((error) => {
      log.error("Editor: could not read a photo status", {
        photo: row.id,
        error: String(error),
      });
      return false;
    })
  );
  const changed = changes.filter(Boolean).length;

  if (changed) {
    revalidateEditor(galleryId);
  }

  const { count } = await supabase
    .from("edit_photos")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", galleryId)
    .in("status", ["queued", "processing"]);

  return { active: count ?? 0, changed };
};
