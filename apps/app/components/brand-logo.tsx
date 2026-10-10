import { Wordmark } from "@repo/design-system/components/hud/wordmark";
import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";

// Symbol files are 340×256 (public/brand). Navy brackets disappear on the
// dark theme, so it swaps to the white-bracket version.
const SYMBOL_HEIGHT = {
  sm: "h-7",
  md: "h-9",
} as const;

interface BrandLogoProperties {
  readonly className?: string;
  readonly size?: keyof typeof SYMBOL_HEIGHT;
}

/** Uphotox symbol + wordmark. The wordmark is the accessible name. */
export const BrandLogo = ({ className, size = "sm" }: BrandLogoProperties) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
    <Image
      alt=""
      className={cn("w-auto dark:hidden", SYMBOL_HEIGHT[size])}
      height={256}
      priority
      src="/brand/logo-symbol.png"
      width={340}
    />
    <Image
      alt=""
      className={cn("hidden w-auto dark:block", SYMBOL_HEIGHT[size])}
      height={256}
      src="/brand/logo-symbol-dark.png"
      width={340}
    />
    <Wordmark size={size} />
  </span>
);
