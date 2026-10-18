"use client";

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
import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  confirmEditUploads,
  refreshEditPhotos,
  removeEditPhotos,
} from "@/app/actions/editor";
import { EDIT_STATE_LABELS, type EditState, formatCost } from "@/lib/editor";

/** How often the page asks the service while photos are in progress. */
const POLL_MS = 10_000;

export interface EditPhotoItem {
  readonly comment: string | null;
  readonly cost: number;
  readonly error: string | null;
  readonly fileName: string;
  readonly id: number;
  /** Signed URL of the cleaned preview; null until it is done. */
  readonly previewUrl: string | null;
  readonly score: number | null;
  readonly state: EditState;
}

const TONES: Record<EditState, string> = {
  uploading: "text-muted-foreground",
  queued: "border-signal-ink/30 text-signal-ink",
  processing: "border-signal-ink/60 bg-signal/15 text-signal-ink",
  done: "border-signal-ink/60 text-signal-ink",
  review: "border-flare/40 bg-flare/10 text-flare",
  failed: "border-destructive/40 text-destructive",
};

// Photos that need the studio first («sin subir» have their own strip).
const ORDER: EditState[] = ["review", "failed", "processing", "queued", "done"];
/** Most photos confirmed per server call. */
const CONFIRM_CHUNK = 50;

const chip =
  "whitespace-nowrap border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]";

export const EditStateChip = ({ state }: { readonly state: EditState }) => (
  <span className={cn(chip, TONES[state])}>{EDIT_STATE_LABELS[state]}</span>
);

type Filter = EditState | "all";

/** Confirms photos in chunks; the ones that stay, with their reason. */
const sendAgain = async (galleryId: number, ids: readonly number[]) => {
  const failed = new Map<number, string>();

  for (let index = 0; index < ids.length; index += CONFIRM_CHUNK) {
    const result = await confirmEditUploads(
      galleryId,
      ids.slice(index, index + CONFIRM_CHUNK)
    );

    if ("error" in result) {
      return { error: result.error };
    }

    for (const photo of result.failed) {
      failed.set(photo.id, photo.reason);
    }
  }

  return { failed };
};

const announce = (sent: number, left: number) => {
  if (sent > 0) {
    toast.success(
      `${sent} ${sent === 1 ? "foto enviada" : "fotos enviadas"} al editor`
    );
  }

  if (left > 0) {
    toast.error(`${left} ${left === 1 ? "sigue" : "siguen"} sin enviar`);
  }
};

/**
 * Photos registered but never queued (the upload was cut, or the service
 * refused them). Those already complete in storage can be sent again
 * without dragging them; the rest are dropped again above.
 */
const PendingUploads = ({
  galleryId,
  photos,
}: {
  readonly galleryId: number;
  readonly photos: readonly EditPhotoItem[];
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reasons, setReasons] = useState<ReadonlyMap<number, string>>(
    new Map()
  );

  const retry = () => {
    startTransition(async () => {
      const result = await sendAgain(
        galleryId,
        photos.map((photo) => photo.id)
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setReasons(result.failed);
      announce(photos.length - result.failed.size, result.failed.size);
      router.refresh();
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await removeEditPhotos(
        galleryId,
        photos.map((photo) => photo.id)
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Fotos quitadas del editor");
      router.refresh();
    });
  };

  return (
    <section className="grid gap-3 border border-dashed bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid max-w-prose gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
            {photos.length} sin terminar de enviar
          </span>
          <p className="text-muted-foreground text-sm">
            Se registraron pero no llegaron a la cola (la subida se cortó o el
            servicio no las aceptó). «Reintentar envío» manda las que ya
            subieron completas; las demás, vuelve a arrastrarlas arriba.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={retry} size="sm">
            Reintentar envío
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={pending} size="sm" variant="ghost">
                Quitar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  ¿Quitar estas {photos.length} fotos del editor?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Se borran los originales que llegaron a subir. Las fotos de la
                  galería y la selección del cliente no se tocan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Quitar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <li
            className="border bg-background px-2 py-1 font-mono text-[11px]"
            key={photo.id}
          >
            {photo.fileName}
            {reasons.get(photo.id) && (
              <span className="ml-2 font-sans text-destructive text-xs">
                {reasons.get(photo.id)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

interface EditPhotoListProperties {
  readonly galleryId: number;
  readonly photos: readonly EditPhotoItem[];
}

export const EditPhotoList = ({
  galleryId,
  photos,
}: EditPhotoListProperties) => {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const inProgress = photos.some(
    (photo) => photo.state === "queued" || photo.state === "processing"
  );

  // While the service works, ask it every few seconds and redraw on change.
  useEffect(() => {
    if (!inProgress) {
      return;
    }

    let stopped = false;
    const tick = async () => {
      const result = await refreshEditPhotos(galleryId);

      if (!stopped && "changed" in result && result.changed > 0) {
        router.refresh();
      }
    };
    const timer = window.setInterval(tick, POLL_MS);
    tick();

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [galleryId, inProgress, router]);

  if (photos.length === 0) {
    return (
      <p className="border border-dashed px-4 py-10 text-center text-muted-foreground text-sm">
        Todavía no has enviado fotos al editor.
      </p>
    );
  }

  const waiting = photos.filter((photo) => photo.state === "uploading");
  const listed = photos.filter((photo) => photo.state !== "uploading");
  const counts = new Map<EditState, number>();

  for (const photo of listed) {
    counts.set(photo.state, (counts.get(photo.state) ?? 0) + 1);
  }

  const filters: { count: number; id: Filter; label: string }[] = [
    { id: "all", label: "Todas", count: listed.length },
    ...ORDER.filter((state) => counts.get(state)).map((state) => ({
      id: state,
      label: EDIT_STATE_LABELS[state],
      count: counts.get(state) ?? 0,
    })),
  ];
  const visible = listed
    .filter((photo) => filter === "all" || photo.state === filter)
    .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state));

  return (
    <div className="grid gap-4">
      {waiting.length > 0 && (
        <PendingUploads galleryId={galleryId} photos={waiting} />
      )}

      {filters.length > 2 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((option) => (
            <button
              className={cn(
                "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
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

      {inProgress && (
        <p className="text-muted-foreground text-xs">
          Limpiando en la nube. Puedes cerrar esta página: el trabajo sigue y
          aquí verás el resultado al volver.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {visible.map((photo) => (
          <li className="grid content-start gap-2" key={photo.id}>
            <div className="relative aspect-[2/3] overflow-hidden border bg-secondary">
              {photo.previewUrl ? (
                <a href={photo.previewUrl} rel="noopener" target="_blank">
                  <Image
                    alt={photo.fileName}
                    className="size-full object-cover"
                    crossOrigin="anonymous"
                    draggable={false}
                    height={600}
                    loading="lazy"
                    src={photo.previewUrl}
                    unoptimized
                    width={400}
                  />
                </a>
              ) : (
                <span
                  className={cn(
                    "flex size-full items-center justify-center p-3 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]",
                    photo.state === "processing" && "animate-pulse"
                  )}
                >
                  {EDIT_STATE_LABELS[photo.state]}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[11px]">
                {photo.fileName}
              </span>
              <EditStateChip state={photo.state} />
            </div>
            {(photo.comment || photo.error) && (
              <p
                className={cn(
                  "line-clamp-3 text-xs",
                  photo.error ? "text-destructive" : "text-muted-foreground"
                )}
                title={photo.error ?? photo.comment ?? undefined}
              >
                {photo.score !== null && (
                  <span className="mr-1 font-bold font-mono text-foreground">
                    {photo.score}/10
                  </span>
                )}
                {photo.error ?? photo.comment}
              </p>
            )}
            {photo.cost > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {formatCost(photo.cost)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
