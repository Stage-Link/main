"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export type StreamMode = "p2p" | "sfu";

interface StreamModeSelectorProps {
  mode: StreamMode;
  onModeChange: (mode: StreamMode) => void;
  disabled?: boolean;
  sfuStatus?: "disconnected" | "connecting" | "connected" | "error";
  /** If false, SFU option is disabled and upgrade prompt is shown */
  canUseSfu?: boolean;
}

export function StreamModeSelector({
  mode,
  onModeChange,
  disabled = false,
  sfuStatus,
  canUseSfu = true,
}: StreamModeSelectorProps) {
  const handleValueChange = (v: string) => {
    if (v === "sfu" && !canUseSfu) return;
    onModeChange(v as StreamMode);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Stream Mode</span>
        {mode === "sfu" && sfuStatus && (
          <Badge
            variant={
              sfuStatus === "connected"
                ? "mode-gold"
                : sfuStatus === "connecting"
                  ? "stat-muted"
                  : sfuStatus === "error"
                    ? "mode-crimson"
                    : "stat-muted"
            }
          >
            {sfuStatus === "connected"
              ? "SFU Connected"
              : sfuStatus === "connecting"
                ? "Connecting..."
                : sfuStatus === "error"
                  ? "SFU Error"
                  : "SFU Off"}
          </Badge>
        )}
      </div>
      <Tabs value={mode} onValueChange={handleValueChange}>
        <TabsList className="w-full">
          <TabsTrigger value="p2p" disabled={disabled} className="flex-1">
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium">P2P</span>
              <span className="text-[10px] text-muted-foreground">Direct</span>
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="sfu"
            disabled={disabled || !canUseSfu}
            className="flex-1"
          >
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium">SFU</span>
              <span className="text-[10px] text-muted-foreground">Scalable</span>
            </div>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {!canUseSfu && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          SFU mode is available on Production and Showtime plans.{" "}
          <Link href="/pricing" className="text-gold hover:underline">
            Upgrade
          </Link>
        </p>
      )}
      {canUseSfu && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {mode === "p2p"
            ? "Direct connection. Best for LAN, up to ~15 viewers."
            : "Cloudflare edge relay. Scales to hundreds of viewers."}
        </p>
      )}
    </div>
  );
}
