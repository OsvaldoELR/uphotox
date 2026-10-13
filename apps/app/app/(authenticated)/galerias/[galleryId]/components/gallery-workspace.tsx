"use client";

import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteGallery,
  deleteGalleryPhotos,
  updateIncludedCount,
} from "@/app/actions/galleries";
import { GalleryStateChip } from "@/components/gallery-state-chip";
import { formatMoney, type GalleryState, selectionTotals } from "@/lib/gallery";
import { ClientShare, type ClientShareProperties } from "./client-share";
import { type GalleryPhotoItem, PhotoGrid } from "./photo-grid";
import { PhotoUploader } from "./photo-uploader";

export interface GalleryWorkspaceProperties {
  readonly access: {
    readonly canManage: boolean;
    readonly storageReady: boolean;
  };
  readonly card: {
    readonly boardId: number;
    readonly clientName: string | null;
    readonly id: number;
    readonly title: string;
  };
  readonly gallery: {
    readonly clientNote: string | null;
    readonly extraPrice: number;
    readonly id: number;
    readonly includedCount: number | null;
    /** Read from the card notes (e.g. «12 FOTOS»), as a hint. */
    readonly packageHint: number | null;
    readonly purged: boolean;
    readonly state: GalleryState;
  };
  readonly photos: readonly GalleryPhotoItem[];
  /** Sending, sharing and the selection for Lightroom. */
  readonly share: Omit<
    ClientShareProperties,
    "canManage" | "galleryId" | "hasPhotos" | "pickedFileNames" | "state"
  >;
}

const sectionLabel =
  "font-bold font-mono text-sm uppercase tracking-[0.12em] flex items-baseline gap-2";

const Stat = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) => (
  <div className="flex flex-col gap-1 bg-card px-4 py-3">
    <dt className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
      {label}
    </dt>
    <dd className="font-black font-mono text-xl tabular-nums">{value}</dd>
  </div>
);

const PackageForm = ({
  gallery,
}: {
  readonly gallery: GalleryWorkspaceProperties["gallery"];
}) => {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(
    gallery.includedCount === null ? "" : String(gallery.includedCount)
  );
  const current =
    gallery.includedCount === null ? "" : String(gallery.includedCount);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();

    startTransition(async () => {
      const result = await updateIncludedCount(
        gallery.id,
        trimmed === "" ? null : Number(trimmed)
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Paquete guardado");
    });
  };

  return (
    <form className="grid gap-2" onSubmit={save}>
      <Label htmlFor="included-count">Fotos incluidas en el paquete</Label>
      <div className="flex items-center gap-2">
        <Input
          className="w-28"
          id="included-count"
          inputMode="numeric"
          max={2000}
          min={0}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Sin límite"
          type="number"
          value={value}
        />
        <Button
          disabled={pending || value.trim() === current}
          size="sm"
          type="submit"
          variant="outline"
        >
          Guardar
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {gallery.packageHint !== null &&
          gallery.packageHint === gallery.includedCount &&
          "Leído de las notas de la tarjeta. "}
        Cada foto que el cliente elija de más cuesta{" "}
        {formatMoney(gallery.extraPrice)}. Vacío = sin límite.
      </p>
    </form>
  );
};

const DangerZone = ({
  galleryId,
  hasPhotos,
  title,
}: {
  readonly galleryId: number;
  readonly hasPhotos: boolean;
  readonly title: string;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const clear = () => {
    startTransition(async () => {
      const result = await deleteGalleryPhotos(galleryId, "all");

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Fotos eliminadas");
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteGallery(galleryId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Galería eliminada");
      router.push("/galerias");
    });
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
      <p className="max-w-prose text-muted-foreground text-sm">
        Las fotos se borran solas 60 días después de que el cliente elija.
      </p>
      <div className="flex flex-wrap gap-2">
        {hasPhotos && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={pending} variant="ghost">
                Quitar todas las fotos
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Quitar todas las fotos?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borran de la galería y del almacenamiento. La galería se
                  queda vacía para volver a subirlas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={clear}>Quitar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={pending} variant="ghost">
              Eliminar galería
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Eliminar la galería de «{title}»?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Se borran las fotos y la selección del cliente, y su enlace deja
                de funcionar. La tarjeta se conserva.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
};

export const GalleryWorkspace = ({
  access,
  card,
  gallery,
  photos,
  share,
}: GalleryWorkspaceProperties) => {
  const uploaded = photos.filter((photo) => photo.uploaded);
  const totals = selectionTotals({
    picked: photos.filter((photo) => photo.picked).length,
    includedCount: gallery.includedCount,
    extraPrice: gallery.extraPrice,
  });
  const canUpload = access.canManage && access.storageReady && !gallery.purged;

  return (
    <div className="flex flex-1 flex-col gap-10 px-4 pt-4 pb-12 md:px-10">
      <section className="flex flex-col gap-4">
        <HudLabel align="start">Galería de selección</HudLabel>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="font-black font-mono text-3xl uppercase tracking-[-0.02em] md:text-4xl">
              {card.title}
            </h1>
            {card.clientName && card.clientName !== card.title && (
              <p className="text-muted-foreground text-sm">{card.clientName}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GalleryStateChip state={gallery.state} />
            <Button asChild size="sm" variant="outline">
              <Link href={`/tableros/${card.boardId}?tarjeta=${card.id}`}>
                Ver tarjeta
              </Link>
            </Button>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px border bg-border sm:grid-cols-4">
          <Stat label="Fotos" value={String(uploaded.length)} />
          <Stat label="Elegidas" value={String(totals.picked)} />
          <Stat
            label="Incluidas"
            value={
              gallery.includedCount === null
                ? "—"
                : String(gallery.includedCount)
            }
          />
          <Stat
            label="Extras"
            value={
              totals.extras > 0
                ? `${totals.extras} · ${formatMoney(totals.extraTotal)}`
                : "0"
            }
          />
        </dl>
        {gallery.clientNote && (
          <blockquote className="border-signal-ink border-l-2 bg-card px-4 py-3 text-sm">
            <span className="mb-1 block font-mono text-[10px] text-signal-ink uppercase tracking-[0.2em]">
              Comentario del cliente
            </span>
            {gallery.clientNote}
          </blockquote>
        )}
      </section>

      {gallery.purged ? null : (
        <ClientShare
          {...share}
          canManage={access.canManage}
          galleryId={gallery.id}
          hasPhotos={uploaded.length > 0}
          pickedFileNames={photos
            .filter((photo) => photo.picked)
            .map((photo) => photo.fileName)}
          state={gallery.state}
        />
      )}

      {access.canManage && !gallery.purged && (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="grid gap-3">
            <h2 className={sectionLabel}>
              <span className="text-signal-ink">01</span> Subir fotos
            </h2>
            {canUpload ? (
              <PhotoUploader
                galleryId={gallery.id}
                uploadedNames={uploaded.map((photo) => photo.fileName)}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Falta conectar el almacenamiento de fotos.
              </p>
            )}
          </div>
          <div className="grid content-start gap-3">
            <h2 className={sectionLabel}>
              <span className="text-signal-ink">02</span> Paquete
            </h2>
            <PackageForm gallery={gallery} />
          </div>
        </section>
      )}

      {gallery.purged && (
        <p className="border px-4 py-3 text-muted-foreground text-sm">
          Las fotos de esta galería ya se borraron del almacenamiento. Se
          conservan los nombres de archivo y la selección del cliente.
        </p>
      )}

      <section className="grid gap-3">
        <h2 className={sectionLabel}>
          <span className="text-signal-ink">
            {access.canManage && !gallery.purged ? "03" : "01"}
          </span>{" "}
          Fotos
        </h2>
        <PhotoGrid
          canManage={access.canManage && !gallery.purged}
          galleryId={gallery.id}
          photos={photos}
        />
      </section>

      {access.canManage && (
        <DangerZone
          galleryId={gallery.id}
          hasPhotos={photos.length > 0}
          title={card.title}
        />
      )}
    </div>
  );
};
