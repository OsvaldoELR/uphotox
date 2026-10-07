import * as React from "react"
import { Slot as SlotPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@repo/design-system/lib/utils"

// Paralelogramo del template Tokyo. La forma vive en un ::before inclinado
// (no en clip-path) para que el glow y el anillo de foco sigan la silueta.
const slant =
  "isolate before:absolute before:inset-y-0 before:inset-x-[5px] before:-z-10 before:-skew-x-18 before:transition-[background-color,box-shadow,border-color] before:duration-200 before:ease-snap focus-visible:before:ring-2 focus-visible:before:ring-ring focus-visible:before:ring-offset-2 focus-visible:before:ring-offset-background"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-xs font-bold uppercase tracking-[0.14em] transition-[color,transform] duration-150 ease-snap active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:before:border-destructive",
  {
    variants: {
      variant: {
        default: cn(
          slant,
          "text-primary-foreground before:bg-primary hover:before:bg-[color-mix(in_oklab,var(--signal)_85%,white)] hover:before:shadow-[0_0_0_1px_var(--signal),0_0_24px_var(--glow),0_0_56px_var(--glow-soft)]"
        ),
        destructive: cn(
          slant,
          "text-white before:bg-destructive hover:before:shadow-[0_0_24px_color-mix(in_oklab,var(--destructive)_45%,transparent)]"
        ),
        outline: cn(
          slant,
          "text-signal-ink before:border before:border-signal-ink/35 before:bg-signal/8 hover:before:bg-signal/16 hover:before:shadow-[0_0_20px_var(--glow-soft)]"
        ),
        secondary: cn(
          slant,
          "text-flare before:border before:border-flare/40 before:bg-flare/5 hover:before:bg-flare/12 hover:before:shadow-[0_0_20px_color-mix(in_oklab,var(--flare)_28%,transparent)]"
        ),
        ghost:
          "rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
        link: "text-signal-ink underline-offset-4 hover:underline focus-visible:underline",
      },
      size: {
        default: "h-9 px-5",
        sm: "h-8 gap-1.5 px-4 text-[11px]",
        lg: "h-11 px-7 text-[13px]",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? SlotPrimitive.Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
