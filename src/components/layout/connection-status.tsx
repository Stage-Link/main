"use client";

import { Badge } from "@/components/ui/badge";

interface ConnectionStatusProps {
  status: "connected" | "disconnected" | "error" | "connecting" | "reconnecting";
}

const STATUS_CONFIG = {
  connected: {
    label: "Connected",
    variant: "mode-gold" as const,
    dotClassName: "bg-gold animate-live-pulse",
  },
  disconnected: {
    label: "Disconnected",
    variant: "mode-crimson" as const,
    dotClassName: "bg-crimson",
  },
  error: {
    label: "Error",
    variant: "mode-crimson" as const,
    dotClassName: "bg-crimson",
  },
  connecting: {
    label: "Connecting...",
    variant: "mode-gold" as const,
    dotClassName: "bg-gold animate-live-pulse",
  },
  reconnecting: {
    label: "Reconnecting...",
    variant: "mode-gold" as const,
    dotClassName: "bg-gold animate-live-pulse",
  },
} as const;

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClassName}`} />
      {config.label}
    </Badge>
  );
}
