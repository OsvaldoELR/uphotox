import { createAdminClient } from "@repo/database/admin";
import { log } from "@repo/observability/log";
import { isStorageConfigured } from "@repo/storage";
import { flushStorageDeletions } from "@repo/storage/cleanup";
import { env } from "@/env";
import { isExpiredEditPhoto } from "@/lib/editor";

/**
 * Daily (vercel.json): deletes the Editor photos whose keep days are over
 * (Ajustes → Editor) or whose upload was abandoned. Deleting the rows
 * queues their R2 files in storage_deletions (trigger), which is emptied
 * here too. Public route (proxy.ts): Vercel sends CRON_SECRET as a Bearer
 * token.
 */

const PAGE = 1000;
const DELETE_CHUNK = 200;

export const GET = async (request: Request) => {
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  ) {
    return new Response("No autorizado", { status: 401 });
  }

  if (!isStorageConfigured()) {
    return Response.json({ skipped: "storage not configured" });
  }

  const admin = createAdminClient();
  const now = new Date();
  const expired: number[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("edit_photos")
      .select(
        "id, status, created_at, finished_at, studio:studios(editor_keep_days)"
      )
      .order("id")
      .range(from, from + PAGE - 1);

    if (error) {
      log.error("Purge: could not read edit photos", { error: error.message });
      return new Response(error.message, { status: 500 });
    }

    for (const row of data) {
      const old = isExpiredEditPhoto(
        {
          status: row.status,
          createdAt: row.created_at,
          finishedAt: row.finished_at,
          keepDays: row.studio?.editor_keep_days ?? 30,
        },
        now
      );

      if (old) {
        expired.push(row.id);
      }
    }

    if (data.length < PAGE) {
      break;
    }
  }

  for (let index = 0; index < expired.length; index += DELETE_CHUNK) {
    const { error } = await admin
      .from("edit_photos")
      .delete()
      .in("id", expired.slice(index, index + DELETE_CHUNK));

    if (error) {
      log.error("Purge: could not delete edit photos", {
        error: error.message,
      });
      return new Response(error.message, { status: 500 });
    }
  }

  const flushed = await flushStorageDeletions();
  log.info("Purge done", { editPhotos: expired.length, objects: flushed });
  return Response.json({ editPhotos: expired.length, objects: flushed });
};
