import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-gold text-primary-foreground [a&]:hover:bg-gold/90",
        secondary:
          "bg-crimson text-white [a&]:hover:bg-crimson/90",
        destructive:
          "bg-crimson text-white [a&]:hover:bg-crimson/90",
        outline:
          "border-white/10 text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-gold underline-offset-4 [a&]:hover:underline",
        live: "bg-crimson/80 text-white text-[10px] font-semibold gap-1.5 px-2 py-0.5 rounded-[4px]",
        "mode-gold": "bg-gold/[0.09] text-gold text-[10px] font-medium shadow-[0_0_10px_rgba(201,162,39,0.19)]",
        "mode-crimson": "bg-crimson/[0.09] text-crimson text-[10px] font-medium shadow-[0_0_10px_rgba(183,28,46,0.19)]",
        stat: "bg-gold/10 text-gold text-[10px] font-medium px-1.5 py-0.5",
        "stat-muted": "bg-white/10 text-white/60 text-[10px] font-medium px-1.5 py-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
