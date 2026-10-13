import { createClient } from "@repo/database/server";
import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import { Panel } from "@repo/design-system/components/hud/panel";
import { isStorageConfigured } from "@repo/storage";
import { ChevronRightIcon, ImagesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryStateChip } from "@/components/gallery-state-chip";
import { type GalleryState, galleryState } from "@/lib/gallery";
import { requireStudio } from "@/lib/studio";
import { Header } from "../components/header";
import { StorageNotice } from "./components/storage-notice";

export const metadata: Metadata = {
  title: "Galerías · Uphotox",
  description: "Galerías de selección de los clientes.",
};

const shortDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
});

const dateLine = (
  state: GalleryState,
  gallery: {
    readonly created_at: string;
    readonly expires_at: string | null;
    readonly submitted_at: string | null;
  }
) => {
  if (state === "submitted" && gallery.submitted_at) {
    return `Elegida el ${shortDate.format(new Date(gallery.submitted_at))}`;
  }

  if (state === "open" && gallery.expires_at) {
    return `Caduca el ${shortDate.format(new Date(gallery.expires_at))}`;
  }

  if (state === "expired" && gallery.expires_at) {
    return `Caducó el ${shortDate.format(new Date(gallery.expires_at))}`;
  }

  return `Creada el ${shortDate.format(new Date(gallery.created_at))}`;
};

const countOf = (value: { count: number }[] | null) => value?.[0]?.count ?? 0;

const GalleriesPage = async () => {
  const context = await requireStudio();

  if (!(context.can("galleries.view") || context.can("galleries.manage"))) {
    notFound();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("galleries")
    .select(
      "id, status, created_at, expires_at, submitted_at, photos:gallery_photos(count), picked:gallery_photos(count), card:cards!galleries_card_id_studio_id_fkey(title, client:clients(full_name))"
    )
    .not("photos.uploaded_at", "is", null)
    .not("picked.picked_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const galleries = data ?? [];

  return (
    <>
      <Header page="Galerías" trail={[{ label: "Panel", href: "/" }]} />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-4 pb-12 md:px-10">
        <div className="flex flex-col gap-2">
          <HudLabel align="start">
            Galerías · {String(galleries.length).padStart(2, "0")}
          </HudLabel>
          <p className="max-w-prose text-muted-foreground text-sm">
            Fotos para que cada cliente elija sus favoritas. Se crean desde la
            tarjeta del cliente en el tablero.
          </p>
        </div>

        {!isStorageConfigured() && <StorageNotice />}

        {galleries.length > 0 ? (
          <ul className="divide-y border bg-card">
            {galleries.map((gallery) => {
              const state = galleryState({
                status: gallery.status,
                expiresAt: gallery.expires_at,
              });
              const photos = countOf(gallery.photos);
              const picked = countOf(gallery.picked);

              return (
                <li key={gallery.id}>
                  <Link
                    className="flex w-full items-center gap-4 px-4 py-3 transition-colors hover:bg-accent"
                    href={`/galerias/${gallery.id}`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium text-sm">
                        {gallery.card?.title ?? "Sin tarjeta"}
                      </span>
                      <span className="truncate text-muted-foreground text-xs">
                        {gallery.card?.client?.full_name ?? "Sin cliente"}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <GalleryStateChip state={state} />
                      <span className="font-mono text-[10px] text-muted-foreground uppercase tabular-nums tracking-[0.12em]">
                        {photos} fotos
                        {picked > 0 && ` · ${picked} elegidas`} ·{" "}
                        {dateLine(state, gallery)}
                      </span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Panel className="flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
            <ImagesIcon className="size-8 text-signal-ink/60" />
            <p className="font-bold font-mono text-xs uppercase tracking-[0.25em]">
              Sin galerías
            </p>
            <p className="max-w-sm text-muted-foreground text-sm">
              Abre la tarjeta de un cliente en el tablero y pulsa «Crear
              galería» para subir las fotos de su sesión.
            </p>
          </Panel>
        )}
      </div>
    </>
  );
};

export default GalleriesPage;
