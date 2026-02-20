"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CameraPreviewProps {
  stream: MediaStream | null;
  loading?: boolean;
  mirrored?: boolean;
}

export function CameraPreview({ stream, loading = false, mirrored = false }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl md:rounded-[20px] overflow-hidden shadow-2xl transition-all duration-300 group"
      style={{
        background:
          "linear-gradient(to bottom right, #0a0a0a, #111111, #050505)",
      }}
    >
      <div className="aspect-video relative">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
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

        {/* LIVE badge */}
        <div className="absolute top-2.5 left-2.5 z-[5]">
          <Badge variant="live">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />
            LIVE
          </Badge>
        </div>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-gold/20 border-t-gold" />
              <p className="mt-3 text-gold/80 text-xs font-medium">
                Starting camera...
              </p>
            </div>
          </div>
        )}

        {/* Fullscreen toggle — bottom-left so it doesn't overlap LIVE badge; always visible on mobile */}
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
