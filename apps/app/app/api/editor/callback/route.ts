import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@repo/database/admin";
import { log } from "@repo/observability/log";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { env } from "@/env";
import { notifyEditorBatchDone, syncEditPhoto } from "@/lib/editor-sync";

/**
 * The Cloudflare Editor service calls this when a photo finishes, so its
 * result is stored (and the studio emailed) even with no page open. Public
 * route (see proxy.ts): the shared EDITOR_TOKEN is the credential, and the
 * photo is found by its R2 prefix only.
 */

const PREFIX = /^editor\/(\d+)\/(\d+)\/(\d+)\/$/;

const authorised = (header: string | null) => {
  const expected = Buffer.from(`Bearer ${env.EDITOR_TOKEN ?? ""}`);
  const given = Buffer.from(header ?? "");
  return (
    Boolean(env.EDITOR_TOKEN) &&
    given.length === expected.length &&
    timingSafeEqual(given, expected)
  );
};

export const POST = async (request: Request) => {
  if (!authorised(request.headers.get("authorization"))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    prefix?: unknown;
  } | null;
  const match =
    typeof body?.prefix === "string" ? PREFIX.exec(body.prefix) : null;

  if (!match) {
    return Response.json({ error: "prefix inválido" }, { status: 400 });
  }

  const [studioId, galleryId, photoId] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("edit_photos")
    .select("id, studio_id, gallery_id, status, runs")
    .eq("id", photoId)
    .eq("studio_id", studioId)
    .eq("gallery_id", galleryId)
    .maybeSingle();

  // Removed meanwhile: nothing to store.
  if (!row) {
    return Response.json({ ok: true, stored: false });
  }

  const changed = await syncEditPhoto(admin, row);

  if (changed) {
    revalidatePath(`/galerias/${galleryId}/limpieza`);
    revalidatePath("/editor");
    after(async () => {
      try {
        await notifyEditorBatchDone(admin, galleryId);
      } catch (error) {
        log.error("Editor: batch email failed", {
          gallery: galleryId,
          error: String(error),
        });
      }
    });
  }

  return Response.json({ ok: true, stored: changed });
};
