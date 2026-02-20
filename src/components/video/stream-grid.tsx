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
            <span className="text-xs text-white/60 font-medium">
              {focusedStream.cameraName}
              <span className="text-white/30 ml-1.5">{focusedStream.showName}</span>
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
        <span className="text-[10px] text-white/40 ml-2">
          {streams.length} active stream{streams.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {streams.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 max-w-xs text-center">
            <div className="rounded-full bg-white/[0.06] p-4">
              <WifiOff className="h-8 w-8 text-white/40" />
            </div>
            <p className="text-white/70 text-sm font-medium">
              No active streams
            </p>
            <p className="text-white/40 text-xs leading-relaxed">
              There are no live streams in this organization right now.
              This page will update automatically when a stream begins.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
              <span className="text-[11px] text-white/30">Waiting for streams&hellip;</span>
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
                  <span className="text-[11px] text-white/20">
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
