"use client";

import { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface CameraPreviewProps {
  stream: MediaStream | null;
  loading?: boolean;
  mirrored?: boolean;
}

export function CameraPreview({ stream, loading = false, mirrored = false }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className="relative w-full rounded-[20px] overflow-hidden shadow-2xl transition-all duration-300"
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
      </div>
    </div>
  );
}
