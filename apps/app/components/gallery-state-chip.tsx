import { cn } from "@repo/design-system/lib/utils";
import { GALLERY_STATE_LABELS, type GalleryState } from "@/lib/gallery";

const TONES: Record<GalleryState, string> = {
  draft: "text-muted-foreground",
  open: "border-signal-ink/30 text-signal-ink",
  expired: "border-flare/30 text-flare",
  submitted: "border-signal-ink/60 bg-signal/15 text-signal-ink",
};

export const GalleryStateChip = ({
  className,
  state,
}: {
  readonly className?: string;
  readonly state: GalleryState;
}) => (
  <span
    className={cn(
      "whitespace-nowrap border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
      TONES[state],
      className
    )}
  >
    {GALLERY_STATE_LABELS[state]}
  </span>
);
