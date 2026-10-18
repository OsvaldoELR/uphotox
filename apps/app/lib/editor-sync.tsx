import "server-only";

import type { createAdminClient } from "@repo/database/admin";
import { EditorReadyTemplate } from "@repo/email/templates/editor-ready";
import { log } from "@repo/observability/log";
import { readObjectText } from "@repo/storage";
import { editPhotoKeys } from "@repo/storage/editor";
import { env } from "@/env";
import { type EngineStatus, editState, statusUpdate } from "./editor";
import { isEmailEnabled, sendEmail } from "./email";

/**
 * Brings Editor photos up to date with the Cloudflare service (its
 * status.json in R2). Used by the clean-up page while it is open and by the
 * service's notice when a photo finishes. Writes with the admin client: the
 * caller already checked access (RLS for members, the token for the
 * service).
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export interface SyncRow {
  readonly gallery_id: number;
  readonly id: number;
  readonly runs: number;
  readonly status: string;
  readonly studio_id: number;
}

/** Reads one photo's status and stores what changed; true when it did. */
export const syncEditPhoto = async (admin: AdminClient, row: SyncRow) => {
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

// A batch is what finished since the last photo was queued; older finished
// photos are not counted again in the email.
const BATCH_WINDOW_MS = 12 * 3_600_000;

/**
 * When a gallery has no photo left in the cloud, emails each member who
 * sent photos of that batch: «N fotos están listas para revisar». Resend's
 * idempotency key (gallery + last queue time + member) avoids repeats.
 */
export const notifyEditorBatchDone = async (
  admin: AdminClient,
  galleryId: number
) => {
  if (!isEmailEnabled()) {
    return;
  }

  const { count } = await admin
    .from("edit_photos")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", galleryId)
    .in("status", ["queued", "processing"]);

  if (count) {
    return;
  }

  const since = new Date(Date.now() - BATCH_WINDOW_MS).toISOString();
  const [{ data: photos }, { data: gallery }] = await Promise.all([
    admin
      .from("edit_photos")
      .select(
        "status, needs_review, queued_at, created_by, author:profiles!edit_photos_created_by_fkey(id, email)"
      )
      .eq("gallery_id", galleryId)
      .gte("finished_at", since),
    admin
      .from("galleries")
      .select(
        "id, studio:studios(name), card:cards!galleries_card_id_studio_id_fkey(title)"
      )
      .eq("id", galleryId)
      .maybeSingle(),
  ]);

  if (!(photos?.length && gallery?.card && gallery.studio)) {
    return;
  }

  const batch = photos
    .map((photo) => photo.queued_at ?? "")
    .sort()
    .at(-1);
  const recipients = new Map<string, string>();
  const counts = { ready: 0, review: 0, failed: 0 };

  for (const photo of photos) {
    const state = editState({
      status: photo.status as "done" | "failed",
      needsReview: photo.needs_review,
    });
    counts.failed += state === "failed" ? 1 : 0;
    counts.ready += state === "done" || state === "review" ? 1 : 0;
    counts.review += state === "review" ? 1 : 0;

    if (photo.author?.email) {
      recipients.set(photo.author.id, photo.author.email);
    }
  }

  for (const [personId, email] of recipients) {
    const result = await sendEmail({
      fromName: "Uphotox",
      to: email,
      subject: `Fotos limpias listas · ${gallery.card.title}`,
      idempotencyKey: `editor-ready/${galleryId}/${batch}/${personId}`,
      react: (
        <EditorReadyTemplate
          cardTitle={gallery.card.title}
          failed={counts.failed}
          ready={counts.ready}
          review={counts.review}
          reviewUrl={`${env.NEXT_PUBLIC_APP_URL}/galerias/${galleryId}/limpieza`}
          studioName={gallery.studio.name}
        />
      ),
    });

    if (result.status === "failed") {
      log.error("Editor: ready email failed", {
        gallery: galleryId,
        error: result.message,
      });
    }
  }
};
