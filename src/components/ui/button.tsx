import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-gold/50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-gold text-primary-foreground hover:bg-gold/90 shadow-sm",
        destructive:
          "bg-crimson text-white hover:bg-crimson/90 focus-visible:ring-crimson/40",
        secondary:
          "bg-crimson text-white hover:bg-crimson/80",
        outline:
          "border border-gold/30 bg-transparent text-gold hover:bg-gold/10 hover:border-gold/50",
        "outline-crimson":
          "border border-crimson/40 bg-transparent text-crimson hover:bg-crimson/10 hover:border-crimson/60",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        link: "text-gold underline-offset-4 hover:underline hover:text-gold-bright",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-lg px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5 text-[13px]",
        lg: "h-10 rounded-xl px-6 has-[>svg]:px-4",
        xl: "h-12 rounded-xl px-8 has-[>svg]:px-6 text-base",
        icon: "size-9",
        "icon-xs": "size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
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
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
