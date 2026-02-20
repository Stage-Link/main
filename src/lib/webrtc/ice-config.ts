/**
 * Fetches ICE server configuration with Cloudflare TURN credentials.
 * Falls back to public STUN servers if TURN is unavailable.
 */
export async function getIceConfig(): Promise<RTCConfiguration> {
  try {
    const res = await fetch("/api/turn-credentials");
    if (!res.ok) throw new Error(`TURN API returned ${res.status}`);

    const data = await res.json();

    // Cloudflare returns { iceServers: { urls: [...], username, credential } }
    // RTCPeerConnection expects iceServers to be an Array of objects.
    const turnServer = data.iceServers;

    if (!turnServer || !turnServer.urls) {
      console.warn("TURN response missing iceServers.urls, falling back to STUN");
      throw new Error("Invalid TURN response shape");
    }

    const config: RTCConfiguration = {
      iceServers: [
        // TURN (relay) — required for cross-origin / cross-network peers
        {
          urls: Array.isArray(turnServer.urls) ? turnServer.urls : [turnServer.urls],
          username: turnServer.username,
          credential: turnServer.credential,
        },
        // Fallback public STUN
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    };

    console.log(
      "ICE config loaded — TURN urls:",
      Array.isArray(turnServer.urls) ? turnServer.urls.length : 1,
    );
    return config;
  } catch (error) {
    console.warn("Failed to fetch TURN credentials, falling back to STUN:", error);
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    };
  }
}
