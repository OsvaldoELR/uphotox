import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

interface HudLabelProperties {
  /** center: "── LABEL ──" like the Tokyo hero. start: label + rule. */
  readonly align?: "center" | "start";
  readonly children: ReactNode;
  readonly className?: string;
}

export const HudLabel = ({
  align = "center",
  children,
  className,
}: HudLabelProperties) => (
  <div
    className={cn(
      "flex items-center gap-3 font-mono text-[10px] text-signal-ink uppercase tracking-[0.3em]",
      align === "center" && "justify-center",
      className
    )}
  >
    {align === "center" && (
      <span
        aria-hidden="true"
        className="h-px w-10 bg-linear-to-r from-transparent to-signal-ink/40 sm:w-24"
      />
    )}
    <span className="whitespace-nowrap">{children}</span>
    <span
      aria-hidden="true"
      className={cn(
        "h-px bg-linear-to-l from-transparent to-signal-ink/40",
        align === "center" ? "w-10 sm:w-24" : "flex-1"
      )}
    />
  </div>
);
