"use client";

import { cn } from "@repo/design-system/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import Image from "next/image";
import {
  type MouseEvent,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { EDIT_STATE_LABELS, editLabel } from "@/lib/editor";
import {
  type EditPhotoItem,
  EditStateChip,
  ReviewActions,
} from "./edit-photo-card";

type Side = "after" | "before" | "zones";

/** Point of the photo that was clicked, as shares of its width and height. */
interface Focus {
  readonly x: number;
  readonly y: number;
}

const arrow =
  "absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-0 sm:flex";

const toggle = (active: boolean) =>
  cn(
    "h-10 rounded-full px-4 font-bold font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
    active
      ? "bg-signal text-primary-foreground"
      : "bg-white/12 text-white hover:bg-white/20"
  );

/**
 * Where the click fell on a photo drawn with object-contain (the element
 * is bigger than the picture: bands around it do not count).
 */
const focusOf = (
  image: HTMLImageElement,
  event: MouseEvent<HTMLButtonElement>
): Focus => {
  const box = image.getBoundingClientRect();
  const scale = Math.min(
    box.width / (image.naturalWidth || box.width),
    box.height / (image.naturalHeight || box.height)
  );
  const width = (image.naturalWidth || box.width) * scale;
  const height = (image.naturalHeight || box.height) * scale;
  const left = box.left + (box.width - width) / 2;
  const top = box.top + (box.height - height) / 2;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  return {
    x: clamp((event.clientX - left) / width),
    y: clamp((event.clientY - top) / height),
  };
};

interface EditPhotoViewerProperties {
  readonly galleryId: number;
  readonly index: number;
  readonly onClose: () => void;
  readonly onIndexChange: (index: number) => void;
  readonly photos: readonly EditPhotoItem[];
}

/**
 * Full-screen review: the cleaned photo large, click to see it at full size
 * where you clicked (click again to go back), the original and the AI's
 * areas, and the review buttons. Arrows (or ← →) move between photos.
 */
export const EditPhotoViewer = ({
  galleryId,
  index,
  onClose,
  onIndexChange,
  photos,
}: EditPhotoViewerProperties) => {
  const photo = photos[index];
  const [side, setSide] = useState<Side>("after");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [loading, setLoading] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const centred = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const hasPrevious = index > 0;
  const hasNext = index < photos.length - 1;

  // A new photo starts as the cleaned one, not zoomed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on photo change only
  useEffect(() => {
    setSide("after");
    setFocus(null);
  }, [photo?.id]);

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

  if (!photo) {
    return null;
  }

  const finished = photo.state === "done" || photo.state === "review";
  const previews: Record<Side, string | null> = {
    after: photo.previewUrl,
    before: photo.beforeUrl,
    zones: photo.zonesUrl,
  };
  const preview = previews[side] ?? photo.previewUrl;
  // Zoomed in: the full-size file (the original when comparing).
  const full =
    side === "before"
      ? (photo.originalUrl ?? photo.fullUrl)
      : (photo.fullUrl ?? photo.previewUrl);

  const zoomIn = (event: MouseEvent<HTMLButtonElement>) => {
    if (!picture.current) {
      return;
    }

    centred.current = false;
    setLoading(true);
    setFocus(focusOf(picture.current, event));
  };

  // Once the big photo arrives, put the clicked point in the middle.
  const onFullLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    setLoading(false);
    const box = scroller.current;

    if (!(box && focus) || centred.current) {
      return;
    }

    const image = event.currentTarget;
    box.scrollLeft = focus.x * image.naturalWidth - box.clientWidth / 2;
    box.scrollTop = focus.y * image.naturalHeight - box.clientHeight / 2;
    centred.current = true;
  };

  const choose = (next: Side) => {
    setSide((current) => (current === next ? "after" : next));

    if (next === "before" || side === "before") {
      setLoading(focus !== null);
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
        <p className="flex min-w-0 items-center gap-3 font-mono text-[11px] uppercase tabular-nums tracking-[0.16em]">
          <span>
            {index + 1} / {photos.length}
          </span>
          <span className="truncate text-white/55">{photo.fileName}</span>
          <EditStateChip state={photo.state} />
          <span className="hidden truncate text-white/55 md:inline">
            {editLabel(photo.choice, photo.winner)}
          </span>
        </p>
        <button
          aria-label="Cerrar"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          onClick={onClose}
          ref={closeButton}
          type="button"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 px-2 sm:px-16">
        {preview && focus && (
          <div className="absolute inset-0 overflow-auto" ref={scroller}>
            <button
              aria-label="Volver a la foto entera"
              className="block cursor-zoom-out"
              onClick={() => setFocus(null)}
              type="button"
            >
              <Image
                alt={photo.fileName}
                className="max-w-none select-none"
                crossOrigin="anonymous"
                draggable={false}
                height={0}
                onLoad={onFullLoad}
                sizes="100vw"
                src={full ?? preview}
                style={{ width: "auto", height: "auto" }}
                unoptimized
                width={0}
              />
            </button>
          </div>
        )}
        {preview && !focus && (
          <button
            aria-label="Ver a tamaño real"
            className="relative h-full w-full cursor-zoom-in"
            onClick={zoomIn}
            type="button"
          >
            <Image
              alt={photo.fileName}
              className="select-none object-contain"
              crossOrigin="anonymous"
              draggable={false}
              fill
              ref={picture}
              sizes="100vw"
              src={preview}
              unoptimized
            />
          </button>
        )}
        {!preview && (
          <span className="m-auto font-mono text-[11px] text-white/60 uppercase tracking-[0.16em]">
            {EDIT_STATE_LABELS[photo.state]}
          </span>
        )}
        {loading && focus && (
          <span className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
            Cargando a tamaño real…
          </span>
        )}
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

      <div className="flex flex-wrap items-center justify-center gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {finished && (
          <>
            <button
              className={toggle(side === "before")}
              disabled={!photo.beforeUrl}
              onClick={() => choose("before")}
              type="button"
            >
              {photo.beforeUrl ? "Ver original" : "Sin original"}
            </button>
            <button
              className={toggle(side === "zones")}
              onClick={() => choose("zones")}
              type="button"
            >
              Zonas
            </button>
            <span className="mx-1 hidden h-6 w-px bg-white/20 sm:block" />
          </>
        )}
        <div className="rounded-full bg-white px-2 py-1 text-foreground">
          <ReviewActions galleryId={galleryId} photo={photo} />
        </div>
        <p className="w-full text-center text-white/50 text-xs">
          {focus
            ? "Clic para volver · desliza para moverte"
            : "Clic en la foto para verla a tamaño real"}
        </p>
      </div>
    </div>
  );
};
