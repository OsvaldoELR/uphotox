import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientGalleryView } from "./components/client-gallery";
import { GalleryUnavailable } from "./components/gallery-unavailable";
import { loadClientGallery } from "./data";

// Signed photo links and the live selection: never cached.
export const dynamic = "force-dynamic";

interface ClientGalleryPageProperties {
  readonly params: Promise<{ token: string }>;
}

const longDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
});

/**
 * Client page: studio-branded (no Uphotox share image) and kept out of
 * search engines. The link preview shows a photo of the session.
 */
export const generateMetadata = async ({
  params,
}: ClientGalleryPageProperties): Promise<Metadata> => {
  const gallery = await loadClientGallery((await params).token);
  const title = gallery
    ? `Elige tus fotos · ${gallery.studioName}`
    : "Galería no disponible";
  const description = gallery
    ? `Galería privada de ${gallery.cardTitle}.`
    : "Este enlace no existe.";
  const cover = gallery?.photos[0]?.previewUrl;

  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      locale: "es_ES",
      title,
      description,
      siteName: gallery?.studioName,
      images: cover ? [{ url: cover }] : [],
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      images: cover ? [cover] : [],
    },
  };
};

const ClientGalleryPage = async ({ params }: ClientGalleryPageProperties) => {
  const gallery = await loadClientGallery((await params).token);

  if (!gallery) {
    notFound();
  }

  const studio = {
    studioName: gallery.studioName,
    whatsappUrl: gallery.whatsappUrl,
  };

  if (gallery.state === "expired") {
    return (
      <GalleryUnavailable
        {...studio}
        message={`El plazo terminó el ${gallery.expiresAt ? longDate.format(new Date(gallery.expiresAt)) : "día acordado"}. Escríbenos y te lo abrimos de nuevo.`}
        title="El plazo para elegir terminó"
      />
    );
  }

  if (gallery.state === "purged") {
    return (
      <GalleryUnavailable
        {...studio}
        message="Las fotos de esta selección ya se retiraron. Si necesitas algo, escríbenos."
        title="Esta galería ya no está disponible"
      />
    );
  }

  if (gallery.state === "draft" || gallery.photos.length === 0) {
    return (
      <GalleryUnavailable
        {...studio}
        message="Te avisaremos en cuanto puedas elegir tus fotos."
        title="Tu galería aún no está lista"
      />
    );
  }

  return <ClientGalleryView gallery={gallery} />;
};

export default ClientGalleryPage;
