"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { VideoPlayer } from "@/components/video/video-player";
import { useViewerWebRTC } from "@/hooks/use-webrtc";
import { useSfuViewer } from "@/hooks/use-sfu";
import { useParty, type SignalMessage, type HostModeInfo } from "@/hooks/use-party";
import type { StreamInfo } from "@/lib/streams/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Maximize2, Minimize2, Users } from "lucide-react";

interface StreamCellProps {
  streamInfo: StreamInfo;
  orgId: string;
  /** Whether this cell is in focused/expanded mode */
  focused?: boolean;
  onFocus?: () => void;
  onUnfocus?: () => void;
  /** Compact mode for small grid cells (hides some UI) */
  compact?: boolean;
}

export function StreamCell({
  streamInfo,
  orgId,
  focused = false,
  onFocus,
  onUnfocus,
  compact = false,
}: StreamCellProps) {
  const webrtc = useViewerWebRTC();
  const [hostOnline, setHostOnline] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [hostMode, setHostMode] = useState<HostModeInfo>({
    mode: streamInfo.mode,
    sfuSessionId: streamInfo.sfuSessionId,
    sfuTrackName: streamInfo.sfuTrackName,
  });

  const sfuViewer = useSfuViewer(hostMode.sfuSessionId, hostMode.sfuTrackName);
  const prevHostModeRef = useRef<"p2p" | "sfu">(streamInfo.mode);

  const room = `${orgId}:${streamInfo.streamId}`;

  const party = useParty({
    room,
    role: "viewer",
    orgId,

    onSignal: useCallback(
      (data: SignalMessage) => {
        webrtc.handleSignal(data);
      },
      [webrtc.handleSignal],
    ),

    onHostReady: useCallback((info: HostModeInfo) => {
      setHostOnline(true);
      setHostMode(info);
    }, []),

    onHostLeft: useCallback(() => {
      setHostOnline(false);
      setHostMode({ mode: "p2p", sfuSessionId: null, sfuTrackName: null });
    }, []),

    onRoomFull: useCallback(() => {
      setRoomFull(true);
    }, []),
  });

  // Wire sendSignal
  useEffect(() => {
    if (party.connectionStatus === "connected") {
      webrtc.setSendSignal(party.sendSignal);
    }
  }, [party.connectionStatus, party.sendSignal, webrtc.setSendSignal]);

  // Set viewerId
  useEffect(() => {
    if (party.connectionId) {
      webrtc.setViewerId(party.connectionId);
    }
  }, [party.connectionId, webrtc.setViewerId]);

  // Auto-connect/disconnect SFU
  useEffect(() => {
    const prev = prevHostModeRef.current;
    prevHostModeRef.current = hostMode.mode;

    if (
      hostMode.mode === "sfu" &&
      hostMode.sfuSessionId &&
      hostMode.sfuTrackName
    ) {
      if (sfuViewer.status === "connected" || sfuViewer.status === "connecting") {
        sfuViewer.disconnect();
      }
      const timer = setTimeout(
        () => sfuViewer.connect(),
        prev === "sfu" ? 200 : 0,
      );
      return () => clearTimeout(timer);
    } else if (hostMode.mode === "p2p" && prev === "sfu") {
      sfuViewer.disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostMode.mode, hostMode.sfuSessionId, hostMode.sfuTrackName]);

  const isSfuMode = hostMode.mode === "sfu";
  const activeStream = isSfuMode ? sfuViewer.stream : webrtc.stream;
  const activeLoading = isSfuMode
    ? sfuViewer.status === "connecting" || sfuViewer.status === "disconnected"
    : webrtc.loading;

  if (roomFull) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-surface-2 p-4 text-center">
        <Users className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Viewer limit reached</p>
        <p className="text-xs text-muted-foreground">
          This stream has reached its plan&apos;s viewer cap. Ask your org admin to upgrade for more viewers.
        </p>
        <Button asChild size="sm" variant="outline" className="border-gold/30 text-gold">
          <Link href="/pricing">View plans</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full group/cell">
      <VideoPlayer
        stream={activeStream}
        loading={activeLoading}
        hostOffline={!hostOnline}
        cameraName={streamInfo.cameraName}
      />

      {/* Stream overlay info */}
      <div className="absolute bottom-0 left-0 right-0 z-[6] bg-gradient-to-t from-black/70 to-transparent p-2 pointer-events-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-foreground/90 font-medium truncate">
              {streamInfo.cameraName}
            </span>
            {!compact && (
              <span className="text-[9px] text-muted-foreground truncate">
                {streamInfo.showName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!compact && (
              <Badge variant="stat-muted" className="text-[9px] px-1 py-0 h-4">
                <Eye className="h-2.5 w-2.5" />
                {streamInfo.viewerCount}
              </Badge>
            )}
            <Badge
              variant={isSfuMode ? "mode-gold" : "stat-muted"}
              className="text-[9px] px-1 py-0 h-4"
            >
              {isSfuMode ? "SFU" : "P2P"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Focus/unfocus button */}
      <div className="absolute top-2 right-2 z-[6] opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-auto">
        <button
          type="button"
          onClick={focused ? onUnfocus : onFocus}
          className="bg-black/60 backdrop-blur-sm rounded-lg p-1.5 text-white/60 hover:text-gold hover:bg-black/80 transition-all cursor-pointer"
        >
          {focused ? (
            <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          )}
        </button>
      </div>
    </div>
  );
}
