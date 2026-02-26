"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-gold" />,
        info: <InfoIcon className="size-4 text-gold-bright" />,
        warning: <TriangleAlertIcon className="size-4 text-amber" />,
        error: <OctagonXIcon className="size-4 text-crimson" />,
        loading: <Loader2Icon className="size-4 animate-spin text-gold" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface-2)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.75rem",
          "--success-bg": "var(--surface-2)",
          "--success-text": "var(--foreground)",
          "--success-border": "rgba(201, 162, 39, 0.2)",
          "--error-bg": "var(--surface-2)",
          "--error-text": "var(--foreground)",
          "--error-border": "rgba(183, 28, 46, 0.2)",
          "--info-bg": "var(--surface-2)",
          "--info-text": "var(--foreground)",
          "--info-border": "rgba(201, 162, 39, 0.15)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
