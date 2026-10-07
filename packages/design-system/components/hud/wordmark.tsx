import { cn } from "@repo/design-system/lib/utils";

const SIZES = {
  sm: "text-lg tracking-[0.12em]",
  md: "text-2xl tracking-[0.14em]",
  xl: "text-[clamp(3.5rem,9vw,7.5rem)] tracking-[-0.02em]",
} as const;

interface WordmarkProperties {
  readonly className?: string;
  /** Periodic cyan/magenta glitch from the Tokyo title. */
  readonly glitch?: boolean;
  /** 写真 ("fotografía") above the name, as 東京 sat over TOKYO. */
  readonly kanji?: boolean;
  readonly size?: keyof typeof SIZES;
}

export const Wordmark = ({
  className,
  glitch = false,
  kanji = false,
  size = "sm",
}: WordmarkProperties) => (
  <span
    className={cn("inline-flex select-none flex-col leading-none", className)}
  >
    {kanji && (
      <span className="mb-1 font-mono text-[9px] text-signal-ink/70 tracking-[0.4em]">
        写真
      </span>
    )}
    <span
      className={cn(
        "inline-block font-black font-mono uppercase",
        SIZES[size],
        glitch && "animate-glitch"
      )}
    >
      Upho<span className="text-glow text-signal-ink">tox</span>
    </span>
  </span>
);
