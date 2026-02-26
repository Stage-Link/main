"use client";

import { useState, useCallback } from "react";
import { StreamCell } from "@/components/video/stream-cell";
import type { StreamInfo, GridLayout } from "@/lib/streams/types";
import { GRID_CELL_COUNTS } from "@/lib/streams/types";
import { Button } from "@/components/ui/button";
import { Grid2x2, Grid3x3, Square, Columns2, Maximize2, Minimize2 } from "lucide-react";
import { WifiOff } from "lucide-react";

interface StreamGridProps {
  streams: StreamInfo[];
  orgId: string;
  /** Which streams (by ID) are assigned to grid cells */
  selectedStreamIds: string[];
  onSelectedStreamIdsChange: (ids: string[]) => void;
}

const LAYOUT_ICONS: Record<GridLayout, React.ReactNode> = {
  "1x1": <Square className="h-3.5 w-3.5" />,
  "2x1": <Columns2 className="h-3.5 w-3.5" />,
  "2x2": <Grid2x2 className="h-3.5 w-3.5" />,
  "3x3": <Grid3x3 className="h-3.5 w-3.5" />,
};

const LAYOUT_LABELS: Record<GridLayout, string> = {
  "1x1": "1",
  "2x1": "2",
  "2x2": "4",
  "3x3": "9",
};

const GRID_CLASSES: Record<GridLayout, string> = {
  "1x1": "grid-cols-1 grid-rows-1",
  "2x1": "grid-cols-2 grid-rows-1",
  "2x2": "grid-cols-2 grid-rows-2",
  "3x3": "grid-cols-3 grid-rows-3",
};

export function StreamGrid({
  streams,
  orgId,
  selectedStreamIds,
  onSelectedStreamIdsChange,
}: StreamGridProps) {
  const [layout, setLayout] = useState<GridLayout>("1x1");
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null);

  const cellCount = GRID_CELL_COUNTS[layout];
  const isCompact = layout === "3x3";

  const handleFocus = useCallback((streamId: string) => {
    setFocusedStreamId(streamId);
  }, []);

  const handleUnfocus = useCallback(() => {
    setFocusedStreamId(null);
  }, []);

  // Auto-fill selected streams if user hasn't explicitly chosen
  const visibleIds = selectedStreamIds.length > 0
    ? selectedStreamIds.slice(0, cellCount)
    : streams.slice(0, cellCount).map((s) => s.streamId);

  const streamMap = new Map(streams.map((s) => [s.streamId, s]));

  // If a stream is focused, show only that one
  if (focusedStreamId) {
    const focusedStream = streamMap.get(focusedStreamId);
    if (focusedStream) {
      return (
        <div className="h-full flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground font-medium">
              {focusedStream.cameraName}
              <span className="text-muted-foreground/50 ml-1.5">{focusedStream.showName}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnfocus}
              className="h-7 gap-1 text-xs"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Exit Focus
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <StreamCell
              streamInfo={focusedStream}
              orgId={orgId}
              focused
              onUnfocus={handleUnfocus}
            />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Layout selector */}
      <div className="flex items-center gap-1 px-1 shrink-0">
        {(Object.keys(LAYOUT_ICONS) as GridLayout[]).map((l) => (
          <Button
            key={l}
            variant={layout === l ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setLayout(l);
              setFocusedStreamId(null);
            }}
            className="h-7 w-7 p-0"
            title={`${LAYOUT_LABELS[l]} streams`}
          >
            {LAYOUT_ICONS[l]}
          </Button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-2">
          {streams.length} active stream{streams.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {streams.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 max-w-xs text-center">
            {/* Theater curtain illustration */}
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none" className="text-gold/20">
              {/* Stage floor */}
              <rect x="10" y="65" width="100" height="4" rx="2" fill="currentColor" opacity="0.3" />
              {/* Left curtain */}
              <path d="M10 5 C10 5 12 35 10 65 C10 65 25 60 30 65 C30 65 28 35 30 5 Z" fill="currentColor" opacity="0.5" />
              {/* Right curtain */}
              <path d="M110 5 C110 5 108 35 110 65 C110 65 95 60 90 65 C90 65 92 35 90 5 Z" fill="currentColor" opacity="0.5" />
              {/* Top valance */}
              <path d="M5 5 Q60 15 115 5 L115 0 L5 0 Z" fill="currentColor" opacity="0.6" />
              {/* Spotlight beam */}
              <ellipse cx="60" cy="55" rx="15" ry="6" fill="currentColor" opacity="0.15" />
              <path d="M55 10 L48 55 L72 55 L65 10 Z" fill="currentColor" opacity="0.08" />
            </svg>
            <p className="text-foreground/70 text-sm font-display font-semibold">
              The stage is empty
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              No live streams in this organization right now.
              This page updates automatically when a stream begins.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gold/30 animate-pulse" />
              <span className="text-[11px] text-muted-foreground/50">Waiting for curtain call&hellip;</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={`flex-1 min-h-0 grid ${GRID_CLASSES[layout]} gap-1.5`}>
          {Array.from({ length: cellCount }).map((_, i) => {
            const streamId = visibleIds[i];
            const stream = streamId ? streamMap.get(streamId) : undefined;

            if (!stream) {
              return (
                <div
                  key={`empty-${i}`}
                  className="rounded-xl border border-dashed border-white/[0.08] bg-surface-1 flex items-center justify-center"
                >
                  <span className="text-[11px] text-muted-foreground/30">
                    No stream assigned
                  </span>
                </div>
              );
            }

            return (
              <div key={stream.streamId} className="min-h-0 min-w-0 rounded-xl overflow-hidden">
                <StreamCell
                  streamInfo={stream}
                  orgId={orgId}
                  compact={isCompact}
                  onFocus={() => handleFocus(stream.streamId)}
                  onUnfocus={handleUnfocus}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
