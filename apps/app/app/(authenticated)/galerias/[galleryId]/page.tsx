import { createClient } from "@repo/database/server";
import { isStorageConfigured, signedGetUrls } from "@repo/storage";
import { galleryPhotoKeys } from "@repo/storage/gallery";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  compareFileNames,
  galleryState,
  MAX_GALLERY_PHOTOS,
  packageCountFromNotes,
} from "@/lib/gallery";
import { requireStudio } from "@/lib/studio";
import { Header } from "../../components/header";
import { GalleryWorkspace } from "./components/gallery-workspace";

export const metadata: Metadata = {
  title: "Galería · Uphotox",
  description: "Fotos de la sesión para que el cliente elija.",
};

interface GalleryPageProperties {
  readonly params: Promise<{ galleryId: string }>;
}

const GalleryPage = async ({ params }: GalleryPageProperties) => {
  const context = await requireStudio();
  const canManage = context.can("galleries.manage");

  if (!(canManage || context.can("galleries.view"))) {
    notFound();
  }

  const galleryId = Number((await params).galleryId);

  if (!Number.isSafeInteger(galleryId) || galleryId <= 0) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: gallery }, { data: rows }] = await Promise.all([
    supabase
      .from("galleries")
      .select(
        "id, studio_id, status, included_count, extra_price, expires_at, client_note, purged_at, card:cards!galleries_card_id_studio_id_fkey(id, title, board_id, notes, client:clients(full_name))"
      )
      .eq("id", galleryId)
      .maybeSingle(),
    supabase
      .from("gallery_photos")
      .select("id, file_name, uploaded_at, picked_at")
      .eq("gallery_id", galleryId)
      .limit(MAX_GALLERY_PHOTOS),
  ]);

  // RLS hides galleries of other studios and of cards the member can't see.
  if (!gallery?.card) {
    notFound();
  }

  const storageReady = isStorageConfigured();
  const photos = [...(rows ?? [])].sort((a, b) =>
    compareFileNames(a.file_name, b.file_name)
  );
  const uploaded = photos.filter((photo) => photo.uploaded_at);
  const thumbnailUrls =
    storageReady && !gallery.purged_at && uploaded.length
      ? await signedGetUrls(
          uploaded.map(
            (photo) =>
              galleryPhotoKeys({
                studioId: gallery.studio_id,
                galleryId,
                id: photo.id,
              }).thumbnail
          )
        )
      : [];
  const thumbnails = new Map(
    uploaded.map((photo, index) => [photo.id, thumbnailUrls[index] ?? null])
  );

  return (
    <>
      <Header
        page={gallery.card.title}
        trail={[
          { label: "Panel", href: "/" },
          { label: "Galerías", href: "/galerias" },
        ]}
      />
      <GalleryWorkspace
        access={{ canManage, storageReady }}
        card={{
          id: gallery.card.id,
          boardId: gallery.card.board_id,
          title: gallery.card.title,
          clientName: gallery.card.client?.full_name ?? null,
        }}
        gallery={{
          id: gallery.id,
          state: galleryState({
            status: gallery.status,
            expiresAt: gallery.expires_at,
          }),
          includedCount: gallery.included_count,
          extraPrice: gallery.extra_price,
          clientNote: gallery.client_note,
          packageHint: packageCountFromNotes(gallery.card.notes),
          purged: Boolean(gallery.purged_at),
        }}
        photos={photos.map((photo) => ({
          id: photo.id,
          fileName: photo.file_name,
          uploaded: Boolean(photo.uploaded_at),
          picked: Boolean(photo.picked_at),
          thumbnailUrl: thumbnails.get(photo.id) ?? null,
        }))}
      />
    </>
  );
};

export default GalleryPage;
