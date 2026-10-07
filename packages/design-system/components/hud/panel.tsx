import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";
import { ScanLine } from "./scan-line";

interface PanelProperties extends ComponentProps<"div"> {
  /** Hover lift, cyan edge, glow and scan line (Tokyo product card). */
  readonly interactive?: boolean;
  /** Data-stream bar along the top edge (SEN-NIN). */
  readonly stream?: boolean;
}

/**
 * Superficie HUD: vidrio claro sobre la mesa de luz, esquinas recortadas
 * (donde el navegador soporta corner-shape) y profundidad solo por borde.
 */
export const Panel = ({
  children,
  className,
  interactive = false,
  stream = false,
  ...properties
}: PanelProperties) => (
  <div
    className={cn(
      "group/panel corner-notch relative overflow-hidden border border-border bg-card backdrop-blur-md [--notch:14px]",
      "transition-[transform,box-shadow,border-color] duration-300 ease-snap",
      interactive &&
        "hover:-translate-y-1 hover:border-signal-ink/40 hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--signal)_30%,transparent),0_18px_40px_-18px_var(--glow)]",
      className
    )}
    {...properties}
  >
    {stream && (
      <div
        aria-hidden="true"
        className="data-stream absolute inset-x-0 top-0 h-0.5"
      />
    )}
    {children}
    {interactive && (
      <ScanLine className="hidden group-hover/panel:block" duration={2.4} />
    )}
  </div>
);
