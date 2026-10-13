"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { HeartIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteGalleryPhotos } from "@/app/actions/galleries";

export interface GalleryPhotoItem {
  readonly fileName: string;
  readonly id: number;
  readonly picked: boolean;
  /** Signed thumbnail URL; null until the upload finished. */
  readonly thumbnailUrl: string | null;
  readonly uploaded: boolean;
}

type Filter = "all" | "picked" | "pending";

const chip =
  "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors";

interface PhotoGridProperties {
  readonly canManage: boolean;
  readonly galleryId: number;
  readonly photos: readonly GalleryPhotoItem[];
}

export const PhotoGrid = ({
  canManage,
  galleryId,
  photos,
}: PhotoGridProperties) => {
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const picked = photos.filter((photo) => photo.picked).length;
  const unfinished = photos.filter((photo) => !photo.uploaded).length;
  const visible = photos.filter((photo) => {
    if (filter === "picked") {
      return photo.picked;
    }

    if (filter === "pending") {
      return !photo.uploaded;
    }

    return true;
  });

  const filters: { count: number; id: Filter; label: string }[] = [
    { id: "all", label: "Todas", count: photos.length },
    ...(picked > 0
      ? [{ id: "picked" as const, label: "Elegidas", count: picked }]
      : []),
    ...(unfinished > 0
      ? [{ id: "pending" as const, label: "Sin terminar", count: unfinished }]
      : []),
  ];

  const remove = (photo: GalleryPhotoItem) => {
    startTransition(async () => {
      const result = await deleteGalleryPhotos(galleryId, [photo.id]);

      if ("error" in result) {
        toast.error(result.error);
      }
    });
  };

  if (photos.length === 0) {
    return (
      <p className="border border-dashed px-4 py-10 text-center text-muted-foreground text-sm">
        Todavía no hay fotos en esta galería.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {filters.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((option) => (
            <button
              className={cn(
                chip,
                filter === option.id
                  ? "border-signal-ink bg-signal/15 text-signal-ink"
                  : "bg-card text-muted-foreground hover:bg-accent"
              )}
              key={option.id}
              onClick={() => setFilter(option.id)}
              type="button"
            >
              {option.label} · {option.count}
            </button>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
        {visible.map((photo) => (
          <li className="group relative grid gap-1" key={photo.id}>
            <div
              className={cn(
                "relative aspect-square overflow-hidden border bg-secondary",
                photo.picked && "border-signal-ink ring-1 ring-signal-ink"
              )}
            >
              {photo.thumbnailUrl ? (
                <Image
                  alt={photo.fileName}
                  className="size-full object-cover"
                  crossOrigin="anonymous"
                  draggable={false}
                  height={300}
                  loading="lazy"
                  src={photo.thumbnailUrl}
                  unoptimized
                  width={300}
                />
              ) : (
                <span className="flex size-full items-center justify-center p-2 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                  {photo.uploaded ? "Sin vista previa" : "Sin terminar"}
                </span>
              )}
              {photo.picked && (
                <span className="absolute bottom-1 left-1 flex size-6 items-center justify-center bg-signal text-primary-foreground">
                  <HeartIcon className="size-3.5 fill-current" />
                  <span className="sr-only">Elegida</span>
                </span>
              )}
              {canManage && (
                <Button
                  aria-label={`Quitar ${photo.fileName}`}
                  className="absolute top-1 right-1 size-7 bg-background/85 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  disabled={pending}
                  onClick={() => remove(photo)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <XIcon className="size-4" />
                </Button>
              )}
            </div>
            <span className="truncate font-mono text-[10px] text-muted-foreground tracking-[0.04em]">
              {photo.fileName}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
