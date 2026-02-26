"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Maximize2, Minimize2, Play, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VideoPlayerProps {
  stream: MediaStream | null;
  loading?: boolean;
  /** Host is not connected — show "offline" state instead of loading spinner */
  hostOffline?: boolean;
  cameraName?: string;
  mirrored?: boolean;
  stats?: {
    fps?: number | null;
    width?: number | null;
    height?: number | null;
  } | null;
}

export function VideoPlayer({
  stream,
  loading = false,
  hostOffline = false,
  cameraName = "Camera 1",
  mirrored = false,
  stats,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.muted = true;
    setNeedsInteraction(false);

    const tryPlay = () => {
      video.play().catch(() => {
        // Autoplay blocked (non-secure context like local IP over HTTP).
        // Show a tap-to-play overlay so the user can start playback.
        setNeedsInteraction(true);
      });
    };

    if (stream.getVideoTracks().some((t) => t.readyState === "live")) {
      tryPlay();
    } else {
      const onTrack = () => {
        tryPlay();
        stream.removeEventListener("addtrack", onTrack);
      };
      stream.addEventListener("addtrack", onTrack);
      tryPlay();
      return () => stream.removeEventListener("addtrack", onTrack);
    }
  }, [stream]);

  // Manual play triggered by user tap/click
  const handleManualPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().then(() => {
      setNeedsInteraction(false);
    }).catch((e) => {
      console.error("Manual play failed:", e);
    });
  }, []);

  // Buffer management — snap to live edge
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    const interval = setInterval(() => {
      if (video.buffered.length > 0) {
        const liveEdge = video.buffered.end(video.buffered.length - 1);
        const lag = liveEdge - video.currentTime;

        if (lag > 0.15) {
          video.currentTime = liveEdge;
        } else if (lag > 0.05) {
          video.playbackRate = 1.05;
        } else {
          video.playbackRate = 1.0;
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [stream]);

  // Fullscreen handling (standard + webkit for Safari; iOS may only support video.webkitEnterFullscreen)
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!(document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    const isFs = !!(document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);

    if (isFs) {
      const exitFs = document.exitFullscreen ?? (document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen;
      exitFs?.call(document);
      return;
    }

    const requestFs = container?.requestFullscreen ?? (container as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })?.webkitRequestFullscreen;
    if (requestFs) {
      requestFs.call(container).catch((err: unknown) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
      return;
    }

    // iOS: only <video> can go fullscreen
    if (video && typeof (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen === "function") {
      setIsFullscreen(true);
      video.addEventListener("webkitendfullscreen", function onEnd() {
        video.removeEventListener("webkitendfullscreen", onEnd);
        setIsFullscreen(false);
      }, { once: true });
      (video as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
    }
  }, []);

  const resolution =
    stats?.width && stats?.height
      ? `${stats.width}x${stats.height}`
      : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl md:rounded-[20px] overflow-hidden shadow-2xl group transition-all duration-300"
      style={{
        background:
          "linear-gradient(to bottom right, #1a0808, #200e0e, #0f0505)",
      }}
    >
      <div className="aspect-video relative">
        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover relative z-[1] transition-transform duration-200"
          style={mirrored ? { transform: "scaleX(-1)" } : undefined}
        />

        {/* Stage lighting overlays */}
        <div className="absolute inset-0 z-[2] pointer-events-none">
          <div className="absolute inset-0 stage-curtain" />
          <div className="absolute inset-0 stage-spotlight" />
          <div className="absolute inset-0 stage-key-left" />
          <div className="absolute inset-0 stage-key-right" />
          <div className="stage-floor" />
        </div>

        {/* Tap to play — shown when autoplay is blocked (e.g. local IP over HTTP) */}
        {needsInteraction && !loading && (
          <button
            onClick={handleManualPlay}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-gold/20 p-4">
                <Play className="h-8 w-8 text-gold fill-gold" />
              </div>
              <span className="text-xs text-white/70">Tap to play</span>
            </div>
          </button>
        )}

        {/* Host offline — no stream available */}
        {hostOffline && !stream && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-3 max-w-xs text-center">
              <div className="rounded-full bg-white/[0.06] p-4">
                <WifiOff className="h-8 w-8 text-white/40" />
              </div>
              <p className="text-white/70 text-sm font-medium">
                No active stream
              </p>
              <p className="text-white/40 text-xs leading-relaxed">
                The host hasn&apos;t started streaming yet. This page will update
                automatically when a stream begins.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
                <span className="text-[11px] text-white/30">Waiting for host&hellip;</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator — only shown when host IS online but stream not yet received */}
        {loading && !hostOffline && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-gold/20 border-t-gold" />
              <p className="mt-3 text-gold/80 text-xs font-medium">
                Connecting to stream...
              </p>
            </div>
          </div>
        )}

        {/* Top-left badges */}
        <div className="absolute top-2.5 left-2.5 z-[5] flex items-center gap-1.5">
          {hostOffline ? (
            <Badge variant="stat-muted">OFFLINE</Badge>
          ) : (
            <Badge variant="live">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />
              LIVE
            </Badge>
          )}
          {resolution && (
            <Badge variant="stat-muted">{resolution}</Badge>
          )}
          {stats?.fps != null && (
            <Badge variant="stat-muted">{stats.fps} fps</Badge>
          )}
        </div>

        {/* Bottom-right camera label (below fullscreen so it doesn't block clicks) */}
        <div className="absolute bottom-2.5 right-2.5 z-[4]">
          <span className="bg-black/40 backdrop-blur-sm rounded-md px-2 py-1 text-[10px] text-white/60">
            {cameraName}
          </span>
        </div>

        {/* Fullscreen toggle — bottom-left to avoid overlapping camera label; always visible on mobile */}
        <div className="absolute inset-0 z-[5] flex items-end justify-start p-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="pointer-events-auto bg-black/60 backdrop-blur-sm rounded-lg p-2.5 md:p-2 text-white/60 hover:text-gold hover:bg-black/80 transition-all cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" strokeWidth={1.8} />
            ) : (
              <Maximize2 className="h-4 w-4" strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
