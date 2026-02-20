"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export type StreamMode = "p2p" | "sfu";

interface StreamModeSelectorProps {
  mode: StreamMode;
  onModeChange: (mode: StreamMode) => void;
  disabled?: boolean;
  sfuStatus?: "disconnected" | "connecting" | "connected" | "error";
}

export function StreamModeSelector({
  mode,
  onModeChange,
  disabled = false,
  sfuStatus,
}: StreamModeSelectorProps) {
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
      <Tabs
        value={mode}
        onValueChange={(v) => onModeChange(v as StreamMode)}
      >
        <TabsList className="w-full">
          <TabsTrigger value="p2p" disabled={disabled} className="flex-1">
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium">P2P</span>
              <span className="text-[10px] text-muted-foreground">Direct</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="sfu" disabled={disabled} className="flex-1">
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium">SFU</span>
              <span className="text-[10px] text-muted-foreground">Scalable</span>
            </div>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        {mode === "p2p"
          ? "Direct connection. Best for LAN, up to ~15 viewers."
          : "Cloudflare edge relay. Scales to hundreds of viewers."}
      </p>
    </div>
  );
}
