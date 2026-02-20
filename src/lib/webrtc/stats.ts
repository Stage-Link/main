/**
 * WebRTC stats extraction from RTCPeerConnection.getStats().
 * Provides real metrics instead of the fake rAF-based counters.
 */

export interface WebRTCStats {
  fps: number | null;
  width: number | null;
  height: number | null;
  bitrate: number | null; // kbps
  packetsLost: number | null;
  jitter: number | null; // ms
  roundTripTime: number | null; // ms
  codec: string | null;
  candidateType: string | null; // 'host' | 'srflx' | 'relay'
  transportProtocol: string | null; // 'udp' | 'tcp'
}

// Track previous bytes received for bitrate calculation
let prevBytesReceived = 0;
let prevTimestamp = 0;

/**
 * Extract meaningful stats from an RTCPeerConnection.
 * Call every 2 seconds for accurate bitrate calculation.
 */
export async function getWebRTCStats(
  pc: RTCPeerConnection,
): Promise<WebRTCStats> {
  const result: WebRTCStats = {
    fps: null,
    width: null,
    height: null,
    bitrate: null,
    packetsLost: null,
    jitter: null,
    roundTripTime: null,
    codec: null,
    candidateType: null,
    transportProtocol: null,
  };

  try {
    const stats = await pc.getStats();
    let codecId: string | null = null;

    stats.forEach((report) => {
      // Inbound video RTP stats (viewer side)
      if (report.type === "inbound-rtp" && report.kind === "video") {
        result.fps = report.framesPerSecond ?? null;
        result.width = report.frameWidth ?? null;
        result.height = report.frameHeight ?? null;
        result.packetsLost = report.packetsLost ?? null;
        result.jitter = report.jitter != null ? Math.round(report.jitter * 1000) : null;
        codecId = report.codecId ?? null;

        // Bitrate calculation
        const bytesReceived = report.bytesReceived ?? 0;
        const timestamp = report.timestamp ?? 0;
        if (prevTimestamp > 0 && timestamp > prevTimestamp) {
          const deltaBytes = bytesReceived - prevBytesReceived;
          const deltaTime = (timestamp - prevTimestamp) / 1000; // seconds
          result.bitrate = Math.round((deltaBytes * 8) / deltaTime / 1000); // kbps
        }
        prevBytesReceived = bytesReceived;
        prevTimestamp = timestamp;
      }

      // Outbound video RTP stats (host side)
      if (report.type === "outbound-rtp" && report.kind === "video") {
        result.fps = result.fps ?? (report.framesPerSecond ?? null);
        result.width = result.width ?? (report.frameWidth ?? null);
        result.height = result.height ?? (report.frameHeight ?? null);
        codecId = codecId ?? (report.codecId ?? null);

        // Bitrate calculation for outbound
        const bytesSent = report.bytesSent ?? 0;
        const timestamp = report.timestamp ?? 0;
        if (prevTimestamp > 0 && timestamp > prevTimestamp && result.bitrate === null) {
          const deltaBytes = bytesSent - prevBytesReceived;
          const deltaTime = (timestamp - prevTimestamp) / 1000;
          result.bitrate = Math.round((deltaBytes * 8) / deltaTime / 1000);
        }
        if (result.bitrate === null) {
          prevBytesReceived = bytesSent;
          prevTimestamp = timestamp;
        }
      }

      // Active candidate pair — RTT and connection type
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        result.roundTripTime =
          report.currentRoundTripTime != null
            ? Math.round(report.currentRoundTripTime * 1000)
            : null;
      }

      // Local candidate — tells us if we're using TURN
      if (report.type === "local-candidate") {
        result.candidateType = result.candidateType ?? (report.candidateType ?? null);
        result.transportProtocol = result.transportProtocol ?? (report.protocol ?? null);
      }
    });

    // Resolve codec name from codec ID
    if (codecId) {
      stats.forEach((report) => {
        if (report.type === "codec" && report.id === codecId) {
          result.codec = report.mimeType ?? null;
        }
      });
    }
  } catch (error) {
    console.warn("Failed to get WebRTC stats:", error);
  }

  return result;
}

/**
 * Reset bitrate tracking state. Call when a new connection is established.
 */
export function resetStatsTracking(): void {
  prevBytesReceived = 0;
  prevTimestamp = 0;
}
