"use client";

import type { StreamInfo } from "@/lib/streams/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Radio, Plus, X } from "lucide-react";

interface StreamSelectorProps {
  streams: StreamInfo[];
  selectedStreamIds: string[];
  onToggleStream: (streamId: string) => void;
  maxSelectable?: number;
}

export function StreamSelector({
  streams,
  selectedStreamIds,
  onToggleStream,
  maxSelectable,
}: StreamSelectorProps) {
  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 px-3">
        <Radio className="h-5 w-5 text-muted-foreground/30" />
        <p className="text-[11px] text-muted-foreground text-center">
          No live streams
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-1 p-1">
        {streams.map((stream) => {
          const isSelected = selectedStreamIds.includes(stream.streamId);
          const canSelect =
            !maxSelectable || selectedStreamIds.length < maxSelectable || isSelected;

          return (
            <button
              key={stream.streamId}
              type="button"
              onClick={() => {
                if (isSelected || canSelect) {
                  onToggleStream(stream.streamId);
                }
              }}
              disabled={!isSelected && !canSelect}
              className={`
                w-full text-left rounded-lg p-2 transition-all cursor-pointer
                ${
                  isSelected
                    ? "bg-gold/10 border border-gold/20"
                    : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]"
                }
                ${!isSelected && !canSelect ? "opacity-40 cursor-not-allowed" : ""}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">
                      {stream.cameraName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground truncate">
                      {stream.showName} &middot; {stream.hostName}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">
                      <Eye className="inline h-2.5 w-2.5 mr-0.5" />
                      {stream.viewerCount}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge
                    variant={stream.mode === "sfu" ? "mode-gold" : "stat-muted"}
                    className="text-[9px] px-1 py-0 h-4"
                  >
                    {stream.mode.toUpperCase()}
                  </Badge>
                  {isSelected ? (
                    <X className="h-3.5 w-3.5 text-gold" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
