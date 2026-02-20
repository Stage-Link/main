/**
 * SDP utilities for codec preference optimization.
 * Prefers H.264 for hardware-accelerated encode/decode with lower latency.
 */

/**
 * Set codec preferences on all video transceivers to prefer H.264.
 * Uses the modern transceiver API (cleaner than SDP munging).
 */
export function setH264Preference(pc: RTCPeerConnection): void {
  const transceivers = pc.getTransceivers();

  for (const transceiver of transceivers) {
    if (transceiver.sender.track?.kind === "video" || transceiver.receiver.track?.kind === "video") {
      const capabilities = RTCRtpReceiver.getCapabilities?.("video");
      if (!capabilities) continue;

      const codecs = capabilities.codecs;
      const h264Codecs = codecs.filter((c) => c.mimeType === "video/H264");
      const otherCodecs = codecs.filter((c) => c.mimeType !== "video/H264");

      if (h264Codecs.length > 0) {
        try {
          transceiver.setCodecPreferences([...h264Codecs, ...otherCodecs]);
        } catch (e) {
          // Some browsers don't support setCodecPreferences
          console.warn("Failed to set codec preferences:", e);
        }
      }
    }
  }
}

/**
 * Fallback SDP munging: reorder m=video line to prefer H.264 payload types.
 * Used when setCodecPreferences is not available.
 */
export function preferH264InSDP(sdp: string): string {
  const lines = sdp.split("\r\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("m=video")) {
      // Parse: m=video <port> <proto> <payload types...>
      const parts = line.split(" ");
      if (parts.length < 4) {
        result.push(line);
        continue;
      }

      const payloadTypes = parts.slice(3);
      const h264Payloads: string[] = [];
      const otherPayloads: string[] = [];

      // Find which payload types are H.264 by looking at rtpmap lines
      for (const pt of payloadTypes) {
        const rtpmapLine = lines.find(
          (l) => l.startsWith(`a=rtpmap:${pt} `) && l.toLowerCase().includes("h264"),
        );
        if (rtpmapLine) {
          h264Payloads.push(pt);
        } else {
          otherPayloads.push(pt);
        }
      }

      // Reconstruct m= line with H.264 first
      const reordered = [...h264Payloads, ...otherPayloads];
      result.push([...parts.slice(0, 3), ...reordered].join(" "));
    } else {
      result.push(line);
    }
  }

  return result.join("\r\n");
}
