import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-white/40 selection:bg-gold/30 selection:text-foreground bg-white/5 border-white/10 h-9 w-full min-w-0 rounded-lg border px-2.5 py-1.5 text-[13px] text-foreground shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-gold/50 focus-visible:ring-gold/25 focus-visible:ring-[3px]",
        "aria-invalid:ring-crimson/20 aria-invalid:border-crimson",
        className
      )}
      {...props}
    />
  )
}

export { Input }
