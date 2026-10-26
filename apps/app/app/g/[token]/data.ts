import "server-only";

import { createAdminClient } from "@repo/database/admin";
import { isStorageConfigured, signedGetUrls } from "@repo/storage";
import { galleryPhotoKeys } from "@repo/storage/gallery";
import { cache } from "react";
import {
  baseName,
  compareFileNames,
  type GalleryState,
  galleryState,
  MAX_GALLERY_PHOTOS,
} from "@/lib/gallery";
import type { ProductChoice, ProductKind } from "@/lib/gallery-products";
import { moduleAvailable } from "@/lib/permissions";
import { whatsappUrl } from "@/lib/whatsapp";

const TOKEN = /^[\w-]{32,64}$/;

export interface ClientPhoto {
  readonly height: number;
  readonly id: number;
  /** File name without extension (what the studio sees in Lightroom). */
  readonly name: string;
  readonly picked: boolean;
  readonly previewUrl: string;
  readonly thumbnailUrl: string;
  readonly width: number;
}

export interface ClientGallery {
  readonly cardTitle: string;
  readonly clientName: string;
  readonly expiresAt: string | null;
  readonly extraPrice: number;
  readonly includedCount: number | null;
  readonly photos: ClientPhoto[];
  /** Book and canvas of the package, with the client's choices. */
  readonly products: ProductChoice[];
  /**
   * "purged": the photos were removed after the retention period. "paused":
   * the studio has no Galleries now (switched off or paused by Uphotox).
   */
  readonly state: GalleryState | "purged" | "paused";
  readonly studioName: string;
  readonly submittedAt: string | null;
  readonly token: string;
  /** wa.me link to the studio with a prefilled message, if it has one. */
  readonly whatsappUrl: string | null;
}

/**
 * Everything the client page needs, read with the service role and scoped to
 * the gallery the token opens. Photos are only signed while they can be seen
 * (open or submitted). Cached per request (page + metadata).
 */
export const loadClientGallery = cache(
  async (token: string): Promise<ClientGallery | null> => {
    if (!TOKEN.test(token)) {
      return null;
    }

    const admin = createAdminClient();
    const { data: gallery } = await admin
      .from("galleries")
      .select(
        "id, studio_id, status, expires_at, submitted_at, purged_at, included_count, extra_price, studio:studios(name, whatsapp, modules, suspended_at), card:cards!galleries_card_id_studio_id_fkey(title, client:clients(full_name))"
      )
      .eq("token", token)
      .maybeSingle();

    if (!(gallery?.studio && gallery.card)) {
      return null;
    }

    const galleryStatus = gallery.purged_at
      ? "purged"
      : galleryState({
          status: gallery.status,
          expiresAt: gallery.expires_at,
        });
    const state = moduleAvailable(gallery.studio, "galleries")
      ? galleryStatus
      : "paused";
    const clientName = gallery.card.client?.full_name ?? "";
    const studioName = gallery.studio.name;
    let photos: ClientPhoto[] = [];
    let products: ProductChoice[] = [];

    if ((state === "open" || state === "submitted") && isStorageConfigured()) {
      const { data: rows } = await admin
        .from("gallery_photos")
        .select("id, file_name, width, height, picked_at")
        .eq("gallery_id", gallery.id)
        .not("uploaded_at", "is", null)
        .limit(MAX_GALLERY_PHOTOS);
      const sorted = [...(rows ?? [])].sort((a, b) =>
        compareFileNames(a.file_name, b.file_name)
      );
      const keys = sorted.map((row) =>
        galleryPhotoKeys({
          studioId: gallery.studio_id,
          galleryId: gallery.id,
          id: row.id,
        })
      );
      const urls = await signedGetUrls(
        keys.flatMap((key) => [key.thumbnail, key.preview])
      );

      const { data: productRows } = await admin
        .from("gallery_products")
        .select("id, kind, size_short, size_long, photo_id, back_photo_id")
        .eq("gallery_id", gallery.id)
        .order("id");

      products = (productRows ?? []).map((row) => ({
        id: row.id,
        kind: row.kind as ProductKind,
        short: row.size_short,
        long: row.size_long,
        photoId: row.photo_id,
        backPhotoId: row.back_photo_id,
      }));

      photos = sorted.map((row, index) => ({
        id: row.id,
        name: baseName(row.file_name),
        width: row.width ?? 3,
        height: row.height ?? 2,
        picked: Boolean(row.picked_at),
        thumbnailUrl: urls[index * 2] ?? "",
        previewUrl: urls[index * 2 + 1] ?? "",
      }));
    }

    return {
      token,
      state,
      cardTitle: gallery.card.title,
      clientName,
      studioName,
      includedCount: gallery.included_count,
      extraPrice: gallery.extra_price,
      expiresAt: gallery.expires_at,
      submittedAt: gallery.submitted_at,
      photos,
      products,
      whatsappUrl: gallery.studio.whatsapp
        ? whatsappUrl(
            gallery.studio.whatsapp,
            `Hola ${studioName}${clientName ? `, soy ${clientName}` : ""}. Te escribo por mi galería de «${gallery.card.title}».`
          )
        : null,
    };
  }
);
