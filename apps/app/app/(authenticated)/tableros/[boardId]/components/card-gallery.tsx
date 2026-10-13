"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type CardGallerySummary,
  createGallery,
  getCardGallery,
} from "@/app/actions/galleries";
import { GalleryStateChip } from "@/components/gallery-state-chip";

interface CardGalleryProperties {
  readonly canManage: boolean;
  readonly cardId: number;
  /** False while the photo storage (R2) is not configured. */
  readonly storageReady: boolean;
}

/** The card's selection gallery: status and a way in, or «Crear galería». */
export const CardGallery = ({
  canManage,
  cardId,
  storageReady,
}: CardGalleryProperties) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // undefined = loading, null = the card has no gallery.
  const [summary, setSummary] = useState<CardGallerySummary | null>();

  useEffect(() => {
    let active = true;
    setSummary(undefined);
    getCardGallery(cardId).then((result) => {
      if (active) {
        setSummary(result);
      }
    });
    return () => {
      active = false;
    };
  }, [cardId]);

  const create = () => {
    startTransition(async () => {
      const result = await createGallery(cardId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      router.push(`/galerias/${result.galleryId}`);
    });
  };

  return (
    <div className="grid gap-2">
      <span className="font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]">
        Galería de selección
      </span>
      {summary === undefined && (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      )}
      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-3 border p-3">
          <div className="grid justify-items-start gap-1.5">
            <GalleryStateChip state={summary.state} />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tabular-nums tracking-[0.12em]">
              {summary.photos} fotos · {summary.picked} elegidas
            </span>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/galerias/${summary.id}`}>Abrir galería</Link>
          </Button>
        </div>
      )}
      {summary === null &&
        (canManage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed p-3">
            <p className="max-w-64 text-muted-foreground text-sm">
              {storageReady
                ? "Sube las fotos de la sesión para que el cliente elija sus favoritas."
                : "Falta conectar el almacenamiento de fotos."}
            </p>
            <Button
              disabled={pending || !storageReady}
              onClick={create}
              size="sm"
              variant="outline"
            >
              {pending ? "Creando…" : "Crear galería"}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Sin galería.</p>
        ))}
    </div>
  );
};
