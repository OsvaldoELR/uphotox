"use client";

import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { refreshEditPhotos } from "@/app/actions/editor";
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

// Photos that need the studio first.
const ORDER: EditState[] = [
  "review",
  "failed",
  "processing",
  "queued",
  "done",
  "uploading",
];

const chip =
  "whitespace-nowrap border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]";

export const EditStateChip = ({ state }: { readonly state: EditState }) => (
  <span className={cn(chip, TONES[state])}>{EDIT_STATE_LABELS[state]}</span>
);

type Filter = EditState | "all";

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

  const counts = new Map<EditState, number>();

  for (const photo of photos) {
    counts.set(photo.state, (counts.get(photo.state) ?? 0) + 1);
  }

  const filters: { count: number; id: Filter; label: string }[] = [
    { id: "all", label: "Todas", count: photos.length },
    ...ORDER.filter((state) => counts.get(state)).map((state) => ({
      id: state,
      label: EDIT_STATE_LABELS[state],
      count: counts.get(state) ?? 0,
    })),
  ];
  const visible = [...photos]
    .filter((photo) => filter === "all" || photo.state === filter)
    .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state));

  return (
    <div className="grid gap-4">
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
