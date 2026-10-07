import { cn } from "@repo/design-system/lib/utils";

const CORNERS = [
  "top-0 left-0 border-t border-l",
  "top-0 right-0 border-t border-r",
  "bottom-0 left-0 border-b border-l",
  "bottom-0 right-0 border-b border-r",
] as const;

interface CropMarksProperties {
  /** Position the frame, e.g. "inset-6". Defaults to the parent's edges. */
  readonly className?: string;
  /** Size and color of each bracket, e.g. "size-6 border-flare/40". */
  readonly markClassName?: string;
}

/**
 * Marcas de encuadre: las esquinas del Hero de Tokyo leídas como el visor de
 * una cámara. Firma visual de Uphotox; enmarcan la zona de trabajo principal.
 */
export const CropMarks = ({
  className,
  markClassName,
}: CropMarksProperties) => (
  <div
    aria-hidden="true"
    className={cn("pointer-events-none absolute inset-0", className)}
  >
    {CORNERS.map((corner) => (
      <span
        className={cn(
          "absolute size-4 border-signal-ink/40",
          corner,
          markClassName
        )}
        key={corner}
      />
    ))}
  </div>
);
