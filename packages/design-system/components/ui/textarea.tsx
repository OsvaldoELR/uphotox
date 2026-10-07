import * as React from "react"

import { cn } from "@repo/design-system/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-field placeholder:text-muted-foreground/70 focus-visible:border-signal-ink/60 focus-visible:bg-popover focus-visible:shadow-[0_0_0_3px_var(--glow-soft),0_0_18px_var(--glow-soft)] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-md border px-3 py-2 text-base transition-[color,box-shadow,border-color,background-color] duration-150 outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
