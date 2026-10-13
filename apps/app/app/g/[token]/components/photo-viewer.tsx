"use client";

import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { type TouchEvent, useEffect, useRef } from "react";
import type { ClientPhoto } from "../data";

const SWIPE_DISTANCE = 50;

interface PhotoViewerProperties {
  readonly index: number;
  readonly onClose: () => void;
  readonly onIndexChange: (index: number) => void;
  /** Without it the viewer is read-only (selection already sent). */
  readonly onToggle?: (photoId: number) => void;
  readonly photos: readonly ClientPhoto[];
  readonly picked: ReadonlySet<number>;
}

const arrow =
  "absolute top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-0 sm:flex";

/** Full-screen photo with swipe, arrows and the favourite button. */
export const PhotoViewer = ({
  index,
  onClose,
  onIndexChange,
  onToggle,
  photos,
  picked,
}: PhotoViewerProperties) => {
  const photo = photos[index];
  const touchStart = useRef<number | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const hasPrevious = index > 0;
  const hasNext = index < photos.length - 1;

  // Keyboard, focus and no page scroll behind the viewer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft" && index > 0) {
        onIndexChange(index - 1);
      } else if (event.key === "ArrowRight" && index < photos.length - 1) {
        onIndexChange(index + 1);
      }
    };
    const overflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, onClose, onIndexChange, photos.length]);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  // Warm up the neighbours so swiping feels instant.
  useEffect(() => {
    for (const neighbour of [photos[index - 1], photos[index + 1]]) {
      if (neighbour) {
        const image = new window.Image();
        image.crossOrigin = "anonymous";
        image.src = neighbour.previewUrl;
      }
    }
  }, [index, photos]);

  if (!photo) {
    return null;
  }

  const isPicked = picked.has(photo.id);

  const onTouchStart = (event: TouchEvent) => {
    touchStart.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    const end = event.changedTouches[0]?.clientX;
    touchStart.current = null;

    if (start === null || end === undefined) {
      return;
    }

    if (end - start > SWIPE_DISTANCE && hasPrevious) {
      onIndexChange(index - 1);
    } else if (start - end > SWIPE_DISTANCE && hasNext) {
      onIndexChange(index + 1);
    }
  };

  return (
    <div
      aria-label={`Foto ${index + 1} de ${photos.length}`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-[#0b1220] text-white"
      role="dialog"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="font-mono text-[11px] uppercase tabular-nums tracking-[0.16em]">
          {index + 1} / {photos.length}
          <span className="ml-3 text-white/55">{photo.name}</span>
        </p>
        <button
          aria-label="Cerrar"
          className="flex size-11 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          onClick={onClose}
          ref={closeButton}
          type="button"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 px-2 sm:px-16"
        onTouchEnd={onTouchEnd}
        onTouchStart={onTouchStart}
      >
        {/* The grid thumbnail (already cached) shows at once; the large
            photo paints over it when it arrives. */}
        <div className="relative h-full w-full select-none" key={photo.id}>
          <Image
            alt=""
            aria-hidden="true"
            className="object-contain"
            crossOrigin="anonymous"
            draggable={false}
            fill
            sizes="100vw"
            src={photo.thumbnailUrl}
            unoptimized
          />
          <Image
            alt={`Foto ${photo.name}`}
            className="object-contain"
            crossOrigin="anonymous"
            draggable={false}
            fill
            sizes="100vw"
            src={photo.previewUrl}
            unoptimized
          />
        </div>
        <button
          aria-label="Foto anterior"
          className={cn(arrow, "left-3")}
          disabled={!hasPrevious}
          onClick={() => onIndexChange(index - 1)}
          type="button"
        >
          <ChevronLeftIcon className="size-6" />
        </button>
        <button
          aria-label="Foto siguiente"
          className={cn(arrow, "right-3")}
          disabled={!hasNext}
          onClick={() => onIndexChange(index + 1)}
          type="button"
        >
          <ChevronRightIcon className="size-6" />
        </button>
      </div>

      <div className="flex items-center justify-center px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {onToggle ? (
          <button
            aria-pressed={isPicked}
            className={cn(
              "flex h-12 items-center gap-2 rounded-full px-6 font-bold font-mono text-xs uppercase tracking-[0.14em] transition-colors",
              isPicked
                ? "bg-signal text-primary-foreground"
                : "bg-white/12 text-white hover:bg-white/20"
            )}
            onClick={() => onToggle(photo.id)}
            type="button"
          >
            <HeartIcon className={cn("size-5", isPicked && "fill-current")} />
            {isPicked ? "En mis favoritas" : "Elegir esta foto"}
          </button>
        ) : (
          isPicked && (
            <span className="flex items-center gap-2 font-mono text-[11px] text-signal uppercase tracking-[0.16em]">
              <HeartIcon className="size-4 fill-current" /> Elegida
            </span>
          )
        )}
      </div>
    </div>
  );
};
