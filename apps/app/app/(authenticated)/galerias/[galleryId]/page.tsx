import { createClient } from "@repo/database/server";
import { isStorageConfigured, signedGetUrls } from "@repo/storage";
import { galleryPhotoKeys } from "@repo/storage/gallery";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isEmailEnabled } from "@/lib/email";
import {
  compareFileNames,
  galleryState,
  MAX_GALLERY_PHOTOS,
  packageCountFromNotes,
} from "@/lib/gallery";
import { clientGalleryUrl } from "@/lib/gallery-notify";
import { requireStudio } from "@/lib/studio";
import { clientWhatsappDigits, whatsappUrl } from "@/lib/whatsapp";
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
        "id, studio_id, token, status, included_count, extra_price, expires_at, submitted_at, client_note, purged_at, card:cards!galleries_card_id_studio_id_fkey(id, title, board_id, notes, client:clients(full_name, email, phone))"
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
  const { data: sentStage } = await supabase
    .from("board_stages")
    .select("name")
    .eq("board_id", gallery.card.board_id)
    .eq("gallery_role", "sent")
    .maybeSingle();
  const client = gallery.card.client;
  const firstName = client?.full_name.trim().split(" ")[0] ?? "";
  const clientUrl = clientGalleryUrl(gallery.token);
  const clientDigits = clientWhatsappDigits(client?.phone);
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
        access={{
          canEdit: context.can("editor.access"),
          canManage,
          storageReady,
        }}
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
        share={{
          client: {
            email: client?.email ?? null,
            firstName,
            whatsappUrl: clientDigits
              ? whatsappUrl(
                  clientDigits,
                  `Hola${firstName ? ` ${firstName}` : ""}, tus fotos de «${gallery.card.title}» ya están listas para que elijas tus favoritas: ${clientUrl}`
                )
              : null,
          },
          clientUrl,
          emailEnabled: isEmailEnabled(),
          expiresAt: gallery.expires_at,
          sentStageName: sentStage?.name ?? null,
          submittedAt: gallery.submitted_at,
        }}
      />
    </>
  );
};

export default GalleryPage;
