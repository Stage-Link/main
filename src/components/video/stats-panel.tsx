"use client";

import { useRef, useEffect } from "react";
import type { WebRTCStats } from "@/lib/webrtc/stats";

const MAX_HISTORY = 20;

interface StatsPanelProps {
  webrtcStats?: WebRTCStats | null;
  latency?: number | null;
  fps?: number | null;
  resolution?: string | null;
  quality?: string | null;
}

export function StatsPanel({
  webrtcStats,
  latency,
  fps: legacyFps,
  resolution: legacyResolution,
  quality: legacyQuality,
}: StatsPanelProps) {
  const fps = webrtcStats?.fps ?? legacyFps ?? null;
  const resolution =
    webrtcStats?.width && webrtcStats?.height
      ? `${webrtcStats.width}x${webrtcStats.height}`
      : (legacyResolution ?? null);
  const quality = webrtcStats?.width
    ? webrtcStats.width >= 1920
      ? "HD"
      : webrtcStats.width >= 1280
        ? "720p"
        : "Standard"
    : (legacyQuality ?? null);
  const bitrate = webrtcStats?.bitrate ?? null;
  const rtt = webrtcStats?.roundTripTime ?? null;
  const packetsLost = webrtcStats?.packetsLost ?? null;
  const jitter = webrtcStats?.jitter ?? null;
  const candidateType = webrtcStats?.candidateType ?? null;
  const codec = webrtcStats?.codec ?? null;

  const connectionLabel =
    candidateType === "relay"
      ? "TURN (relay)"
      : candidateType === "srflx"
        ? "STUN (server-reflexive)"
        : candidateType === "host"
          ? "Direct (LAN)"
          : candidateType ?? null;

  // ── FPS history for real sparkline ────────────────────────────
  const fpsHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    if (fps !== null) {
      const history = fpsHistoryRef.current;
      history.push(fps);
      if (history.length > MAX_HISTORY) {
        history.shift();
      }
    }
  }, [fps]);

  const fpsHistory = fpsHistoryRef.current;
  const graphPath = buildSparklinePath(fpsHistory, 150, 24);

  return (
    <div className="space-y-1.5">
      <StatRow label="FPS" value={fps !== null ? `${fps}` : null} highlight />
      <StatRow label="Resolution" value={resolution} />
      <StatRow label="Quality" value={quality} highlight />
      {bitrate !== null && (
        <StatRow
          label="Bitrate"
          value={bitrate >= 1000 ? `${(bitrate / 1000).toFixed(1)} Mbps` : `${bitrate} kbps`}
        />
      )}
      {latency !== undefined && (
        <StatRow
          label="Latency"
          value={latency !== null ? `${latency}ms` : null}
          highlight
        />
      )}
      {rtt !== null && (
        <StatRow label="RTT" value={`${rtt}ms`} highlight />
      )}
      {packetsLost !== null && (
        <StatRow
          label="Packets Lost"
          value={`${packetsLost}`}
          warn={packetsLost > 0}
        />
      )}
      {jitter !== null && (
        <StatRow label="Jitter" value={`${jitter}ms`} />
      )}
      {connectionLabel && (
        <StatRow label="Connection" value={connectionLabel} />
      )}
      {codec && (
        <StatRow
          label="Codec"
          value={codec.replace("video/", "")}
        />
      )}

      {/* Mini Graph — real FPS history */}
      <div className="pt-2">
        <svg
          viewBox="0 0 150 24"
          className="w-full h-6"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="graph-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A227" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#C9A227" stopOpacity="0" />
            </linearGradient>
          </defs>
          {graphPath ? (
            <>
              <path
                d={graphPath + " L150,24 L0,24 Z"}
                fill="url(#graph-fill)"
              />
              <path
                d={graphPath}
                fill="none"
                stroke="#C9A227"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-graph-draw"
              />
            </>
          ) : (
            <text
              x="75"
              y="14"
              textAnchor="middle"
              fill="rgba(255,255,255,0.3)"
              fontSize="8"
            >
              Waiting for data...
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

/** Build an SVG path string from an array of FPS values. */
function buildSparklinePath(
  data: number[],
  width: number,
  height: number,
): string | null {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (MAX_HISTORY - 1);

  // Map data points to SVG coordinates — Y is inverted (0 = top)
  const points = data.map((val, i) => {
    const x = i * step;
    const y = height - ((val - min) / range) * (height - 2) - 1; // 1px padding top/bottom
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M${points.join(" L")}`;
}

function StatRow({
  label,
  value,
  highlight = false,
  warn = false,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-[11px]">
      <span className="text-white/60">{label}</span>
      <span
        className={
          warn
            ? "text-crimson font-medium"
            : highlight
              ? "text-gold font-medium"
              : "text-white font-medium"
        }
      >
        {value ?? "--"}
      </span>
    </div>
  );
}
