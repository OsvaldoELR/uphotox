"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { CheckIcon, Undo2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { redoEditPhoto, reviewEditPhotos } from "@/app/actions/editor";
import {
  EDIT_STATE_LABELS,
  type EditState,
  formatCost,
  MAX_NOTE_LENGTH,
  REVIEW_LABELS,
  type ReviewStatus,
} from "@/lib/editor";

export interface EditPhotoItem {
  /** Signed URL of the original at preview size (to compare); may be missing. */
  readonly beforeUrl: string | null;
  readonly comment: string | null;
  readonly cost: number;
  readonly downloaded: boolean;
  readonly error: string | null;
  readonly fileName: string;
  /** Signed URL of the full-size result (framed one when framing is on). */
  readonly fullUrl: string | null;
  readonly id: number;
  readonly note: string | null;
  /** Signed URL of the cleaned preview; null until it is done. */
  readonly previewUrl: string | null;
  readonly reviewStatus: ReviewStatus;
  readonly score: number | null;
  readonly state: EditState;
  readonly zonesUrl: string | null;
}

const TONES: Record<EditState, string> = {
  uploading: "text-muted-foreground",
  queued: "border-signal-ink/30 text-signal-ink",
  processing: "border-signal-ink/60 bg-signal/15 text-signal-ink",
  done: "border-signal-ink/60 text-signal-ink",
  review: "border-flare/40 bg-flare/10 text-flare",
  failed: "border-destructive/40 text-destructive",
};

const chip =
  "whitespace-nowrap border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]";

export const EditStateChip = ({ state }: { readonly state: EditState }) => (
  <span className={cn(chip, TONES[state])}>{EDIT_STATE_LABELS[state]}</span>
);

/** Hold the photo this long to see the original in its place. */
const HOLD_MS = 200;

type View = "after" | "before" | "zones";

const RedoDialog = ({
  galleryId,
  photo,
}: {
  readonly galleryId: number;
  readonly photo: EditPhotoItem;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(photo.note ?? "");
  const [pending, startTransition] = useTransition();

  const redo = () => {
    startTransition(async () => {
      const result = await redoEditPhoto(galleryId, photo.id, note);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`${photo.fileName} vuelve a la cola`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Rehacer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rehacer {photo.fileName}</DialogTitle>
          <DialogDescription>
            Se limpia otra vez desde el original (unos $0,20). Si algo quedó
            mal, dilo aquí y se añade a las instrucciones de la IA.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={`note-${photo.id}`}>Qué debe arreglar</Label>
          <Textarea
            id={`note-${photo.id}`}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Por ejemplo: quita también la línea del suelo a la izquierda"
            rows={3}
            value={note}
          />
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={redo}>
            Rehacer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ReviewActions = ({
  galleryId,
  photo,
}: {
  readonly galleryId: number;
  readonly photo: EditPhotoItem;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const finished = photo.state === "done" || photo.state === "review";

  const decide = (decision: ReviewStatus) => {
    startTransition(async () => {
      const result = await reviewEditPhotos(galleryId, [photo.id], decision);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  };

  if (photo.reviewStatus !== "pending") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            chip,
            photo.reviewStatus === "approved"
              ? "border-signal-ink bg-signal/15 text-signal-ink"
              : "text-muted-foreground"
          )}
        >
          {REVIEW_LABELS[photo.reviewStatus]}
          {photo.downloaded && " · descargada"}
        </span>
        <Button
          disabled={pending}
          onClick={() => decide("pending")}
          size="sm"
          variant="ghost"
        >
          <Undo2Icon className="size-3.5" />
          Deshacer
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {finished && (
        <Button disabled={pending} onClick={() => decide("approved")} size="sm">
          <CheckIcon className="size-3.5" />
          Aprobar
        </Button>
      )}
      <RedoDialog galleryId={galleryId} photo={photo} />
      <Button
        disabled={pending}
        onClick={() => decide("discarded")}
        size="sm"
        variant="ghost"
      >
        Descartar
      </Button>
    </div>
  );
};

/** The cleaned photo; hold it to see the original, «Zonas» shows the AI's areas. */
const Picture = ({
  photo,
  view,
  onHold,
}: {
  readonly onHold: (holding: boolean) => void;
  readonly photo: EditPhotoItem;
  readonly view: View;
}) => {
  const timer = useRef<number | undefined>(undefined);
  const sources: Record<View, string | null> = {
    after: photo.previewUrl,
    before: photo.beforeUrl ?? photo.previewUrl,
    zones: photo.zonesUrl ?? photo.previewUrl,
  };
  const source = sources[view];

  if (!source) {
    return (
      <span
        className={cn(
          "flex size-full items-center justify-center p-3 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]",
          photo.state === "processing" && "animate-pulse"
        )}
      >
        {EDIT_STATE_LABELS[photo.state]}
      </span>
    );
  }

  const release = () => {
    window.clearTimeout(timer.current);
    onHold(false);
  };

  return (
    <Image
      alt={photo.fileName}
      className="size-full cursor-zoom-in select-none object-cover"
      crossOrigin="anonymous"
      draggable={false}
      height={600}
      loading="lazy"
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={release}
      onPointerDown={() => {
        timer.current = window.setTimeout(() => onHold(true), HOLD_MS);
      }}
      onPointerLeave={release}
      onPointerUp={release}
      src={source}
      unoptimized
      width={400}
    />
  );
};

const viewFor = (holding: boolean, zones: boolean): View => {
  if (holding) {
    return "before";
  }

  return zones ? "zones" : "after";
};

/** Reviewer's score and comment (or the error), and the studio's note. */
const Details = ({ photo }: { readonly photo: EditPhotoItem }) => (
  <>
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
    {photo.note && (
      <p className="text-xs">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
          Tu nota:
        </span>{" "}
        {photo.note}
      </p>
    )}
  </>
);

const Links = ({
  onZones,
  photo,
  zones,
}: {
  readonly onZones: () => void;
  readonly photo: EditPhotoItem;
  readonly zones: boolean;
}) => (
  <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em]">
    <button
      className={cn(
        "underline-offset-2 hover:underline",
        zones ? "text-signal-ink" : "text-muted-foreground"
      )}
      onClick={onZones}
      type="button"
    >
      {zones ? "Ocultar zonas" : "Ver zonas"}
    </button>
    {photo.fullUrl && (
      <a
        className="text-muted-foreground underline-offset-2 hover:underline"
        href={photo.fullUrl}
        rel="noopener"
        target="_blank"
      >
        Tamaño real
      </a>
    )}
    {photo.cost > 0 && (
      <span className="text-muted-foreground tabular-nums">
        {formatCost(photo.cost)}
      </span>
    )}
  </div>
);

export const EditPhotoCard = ({
  galleryId,
  photo,
}: {
  readonly galleryId: number;
  readonly photo: EditPhotoItem;
}) => {
  const [holding, setHolding] = useState(false);
  const [zones, setZones] = useState(false);
  const finished = photo.state === "done" || photo.state === "review";

  return (
    <li
      className={cn(
        "grid content-start gap-2",
        photo.reviewStatus === "discarded" && "opacity-60"
      )}
    >
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden border bg-secondary",
          photo.reviewStatus === "approved" &&
            "border-signal-ink ring-1 ring-signal-ink"
        )}
      >
        <Picture
          onHold={setHolding}
          photo={photo}
          view={viewFor(holding, zones)}
        />
        {holding && (
          <span className="absolute top-1 left-1 bg-background/85 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
            Original
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px]">{photo.fileName}</span>
        <EditStateChip state={photo.state} />
      </div>
      <Details photo={photo} />
      {finished && (
        <Links
          onZones={() => setZones((value) => !value)}
          photo={photo}
          zones={zones}
        />
      )}
      {(finished || photo.state === "failed") && (
        <ReviewActions galleryId={galleryId} photo={photo} />
      )}
    </li>
  );
};
