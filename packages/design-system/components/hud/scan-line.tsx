import { cn } from "@repo/design-system/lib/utils";

interface ScanLineProperties {
  readonly className?: string;
  /** Seconds per sweep. Defaults to the --animate-scan value (3.2s). */
  readonly duration?: number;
}

/**
 * Línea de escaneo del template Tokyo. Se mueve un contenedor a tamaño
 * completo con la línea en su borde inferior, así solo se anima transform.
 * El padre debe ser `relative`.
 */
export const ScanLine = ({ className, duration }: ScanLineProperties) => (
  <div
    aria-hidden="true"
    className={cn(
      "pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden",
      className
    )}
  >
    <div
      className="absolute inset-0 animate-scan"
      style={duration ? { animationDuration: `${duration}s` } : undefined}
    >
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-r from-transparent via-signal to-transparent shadow-[0_0_12px_var(--glow)]" />
    </div>
  </div>
);
