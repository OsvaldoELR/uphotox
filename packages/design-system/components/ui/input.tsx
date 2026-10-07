import * as React from "react"

import { cn } from "@repo/design-system/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground border-input bg-field h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base transition-[color,box-shadow,border-color,background-color] duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-signal-ink/60 focus-visible:bg-popover focus-visible:shadow-[0_0_0_3px_var(--glow-soft),0_0_18px_var(--glow-soft)]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
