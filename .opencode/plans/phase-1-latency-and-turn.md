# Phase 1 — Latency Fixes + Cloudflare TURN

## Goal
Minimize video streaming delay to near-real-time. Fix all broken stats/metrics. Add Cloudflare TURN for internet connectivity. Replace PeerJS with native `RTCPeerConnection` for P2P mode.

## Prerequisites
- Phase 0 complete (Next.js + shadcn/ui migration done)
- Cloudflare TURN credentials available (`TURN_KEY_ID`, `TURN_KEY_API_TOKEN`)

## Priority
**Lowest possible delay** — sacrifice video quality (720p is fine) for near-real-time streaming.

---

## Tasks

### 1.1 — Optimize getUserMedia Constraints
**Action:** Configure camera capture for minimum latency.

**Current state:** Only `deviceId` is specified — no resolution, framerate, or latency hints.

**Target constraints:**
```typescript
const constraints: MediaStreamConstraints = {
  video: {
    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
    width: { ideal: 1280, max: 1280 },    // 720p
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 30, max: 30 },
    // @ts-ignore — latency hint not in all type defs
    latency: { ideal: 0, max: 0.1 },      // Hint to minimize capture latency
  },
  audio: false,  // No audio — reduces buffering
};
```

**File:** `src/hooks/use-media-stream.ts`

**Why this helps:**
- Fixed resolution prevents browser from negotiating higher resolution and downscaling
- `latency: 0` tells the browser to prioritize capture speed over quality
- No audio eliminates audio buffer synchronization delay (audio buffers add 100-200ms)
- 30fps is a sweet spot — higher fps increases CPU without visible benefit at this resolution

---

### 1.2 — Replace PeerJS with Native RTCPeerConnection
**Action:** Remove PeerJS dependency entirely. Use native WebRTC APIs.

**Why:** PeerJS adds abstraction overhead, bundles its own signaling protocol, and makes it harder to optimize ICE config, SDP, and data channels. Native `RTCPeerConnection` gives full control.

**New hook:** `src/hooks/use-webrtc.ts`

**Host-side logic:**
```typescript
// For each viewer that connects:
const pc = new RTCPeerConnection(iceConfig);

// Add stream tracks
stream.getTracks().forEach(track => pc.addTrack(track, stream));

// Create data channel for latency measurement
const dataChannel = pc.createDataChannel('latency', { ordered: false });

// Create offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

// Send offer via PartyKit (or Socket.IO in Phase 0)
sendSignal({ type: 'offer', sdp: offer.sdp, targetId: viewerId });

// Handle ICE candidates
pc.onicecandidate = (e) => {
  if (e.candidate) {
    sendSignal({ type: 'ice-candidate', candidate: e.candidate, targetId: viewerId });
  }
};
```

**Viewer-side logic:**
```typescript
const pc = new RTCPeerConnection(iceConfig);

// Handle incoming tracks
pc.ontrack = (e) => {
  videoElement.srcObject = e.streams[0];
};

// Handle data channel
pc.ondatachannel = (e) => {
  const channel = e.channel;
  channel.onmessage = handlePingPong;
};

// Set remote description (offer from host)
await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });

// Create and send answer
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
sendSignal({ type: 'answer', sdp: answer.sdp, targetId: hostId });
```

**Files affected:**
- `src/hooks/use-webrtc.ts` — new hook
- `src/app/host/page.tsx` — use hook instead of PeerJS
- `src/app/viewer/page.tsx` — use hook instead of PeerJS
- `server.ts` — remove PeerJS server (no longer needed)
- `package.json` — remove `peer` dependency

---

### 1.3 — Cloudflare TURN Credential Endpoint
**Action:** Create API route that generates short-lived TURN credentials via Cloudflare API.

**API Route:** `src/app/api/turn-credentials/route.ts`

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.TURN_KEY_ID}/credentials/generate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TURN_KEY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: 86400 }), // 24-hour credential lifetime
    }
  );

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to generate TURN credentials' }, { status: 502 });
  }

  const data = await response.json();
  return NextResponse.json(data);
}
```

**Response format (from Cloudflare):**
```json
{
  "iceServers": {
    "urls": [
      "stun:stun.cloudflare.com:3478",
      "turn:turn.cloudflare.com:3478?transport=udp",
      "turn:turn.cloudflare.com:3478?transport=tcp",
      "turns:turn.cloudflare.com:5349?transport=tcp"
    ],
    "username": "...",
    "credential": "..."
  }
}
```

**Security:** The `TURN_KEY_API_TOKEN` is never exposed to the browser. Clients fetch `/api/turn-credentials` and receive only the time-limited ICE server config.

---

### 1.4 — ICE Configuration
**Action:** Create shared ICE config that uses Cloudflare TURN/STUN on both host and viewer.

**File:** `src/lib/webrtc/ice-config.ts`

```typescript
export async function getIceConfig(): Promise<RTCConfiguration> {
  try {
    const res = await fetch('/api/turn-credentials');
    const data = await res.json();

    return {
      iceServers: [
        data.iceServers,
        // Fallback public STUN
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
      iceCandidatePoolSize: 10,      // Pre-gather candidates
      iceTransportPolicy: 'all',     // Use both STUN and TURN
      bundlePolicy: 'max-bundle',    // Single transport for all media
      rtcpMuxPolicy: 'require',      // Multiplex RTP and RTCP
    };
  } catch {
    // Fallback: STUN only (LAN will still work)
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
    };
  }
}
```

**Key fix:** Currently, the viewer has NO ICE servers at all. The host has only Google STUN. Both will now use Cloudflare TURN + STUN, enabling connectivity through NATs and firewalls.

---

### 1.5 — Video Element Buffer Management (Viewer)
**Action:** Add live-edge seeking to minimize playback buffer delay.

This is the **single biggest source of visible delay** (200-500ms). Browsers buffer incoming WebRTC video for smooth playback. We need to fight this.

**File:** `src/components/video/video-player.tsx`

```typescript
// Snap to live edge every 500ms
useEffect(() => {
  const video = videoRef.current;
  if (!video) return;

  const interval = setInterval(() => {
    if (video.buffered.length > 0) {
      const liveEdge = video.buffered.end(video.buffered.length - 1);
      const lag = liveEdge - video.currentTime;

      if (lag > 0.15) {
        // Jump to live edge if we're more than 150ms behind
        video.currentTime = liveEdge;
      } else if (lag > 0.05) {
        // Speed up playback slightly to catch up
        video.playbackRate = 1.05;
      } else {
        video.playbackRate = 1.0;
      }
    }
  }, 500);

  return () => clearInterval(interval);
}, []);
```

**Video element attributes:**
```tsx
<video
  ref={videoRef}
  autoPlay
  playsInline
  muted               // CRITICAL: prevents autoplay blocking + removes audio buffer
  style={{ objectFit: 'contain' }}
/>
```

**Why `muted` matters:** Without `muted`, browsers may block autoplay entirely. Even if audio isn't being sent, the video element without `muted` may maintain an audio pipeline that adds buffering latency.

---

### 1.6 — Latency Measurement (Ping/Pong via Data Channel)
**Action:** Implement working latency measurement using WebRTC data channels.

**Current state:** `measureLatency` is called every 2s but the function doesn't exist. Host has no data channel message handler.

**Implementation:**

**Viewer side (sender):** `src/hooks/use-latency.ts`
```typescript
export function useLatency(dataChannel: RTCDataChannel | null) {
  const [latency, setLatency] = useState<number | null>(null);
  const pendingPings = useRef(new Map<string, number>());

  useEffect(() => {
    if (!dataChannel || dataChannel.readyState !== 'open') return;

    // Send ping every 2 seconds
    const interval = setInterval(() => {
      const id = crypto.randomUUID();
      pendingPings.current.set(id, performance.now());
      dataChannel.send(JSON.stringify({ type: 'ping', id }));

      // Clean up old pings (older than 10s)
      const now = performance.now();
      for (const [key, time] of pendingPings.current) {
        if (now - time > 10000) pendingPings.current.delete(key);
      }
    }, 2000);

    // Handle pong responses
    const handleMessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.type === 'pong' && pendingPings.current.has(data.id)) {
        const rtt = performance.now() - pendingPings.current.get(data.id)!;
        setLatency(Math.round(rtt / 2)); // One-way estimate
        pendingPings.current.delete(data.id);
      }
    };

    dataChannel.addEventListener('message', handleMessage);
    return () => {
      clearInterval(interval);
      dataChannel.removeEventListener('message', handleMessage);
    };
  }, [dataChannel]);

  return latency;
}
```

**Host side (responder):** In `use-webrtc.ts` host logic:
```typescript
dataChannel.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'ping') {
    dataChannel.send(JSON.stringify({ type: 'pong', id: data.id }));
  }
};
```

**Data channel config for low latency:**
```typescript
const dataChannel = pc.createDataChannel('latency', {
  ordered: false,      // Don't wait for ordering — latency measurement doesn't need it
  maxRetransmits: 0,   // Don't retransmit — stale pings are useless
});
```

---

### 1.7 — Fix FPS Counter
**Action:** Use `requestVideoFrameCallback` to count actual decoded video frames.

**Current state:** Uses `requestAnimationFrame` which always reads ~60fps regardless of stream.

**File:** `src/components/video/stats-panel.tsx`

```typescript
useEffect(() => {
  const video = videoRef.current;
  if (!video) return;

  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 0;

  const countFrame = (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
    frameCount++;
    const elapsed = now - lastTime;

    if (elapsed >= 1000) {
      fps = Math.round((frameCount * 1000) / elapsed);
      setFps(fps);
      frameCount = 0;
      lastTime = now;
    }

    video.requestVideoFrameCallback(countFrame);
  };

  video.requestVideoFrameCallback(countFrame);
}, []);
```

**Fallback:** `requestVideoFrameCallback` is supported in Chrome 83+, Edge 83+, Opera 69+. For Safari (added in 15.4), check feature availability and fall back to `requestAnimationFrame` with a note that the value is estimated.

---

### 1.8 — WebRTC Stats via getStats()
**Action:** Pull real metrics from `RTCPeerConnection.getStats()`.

**File:** `src/lib/webrtc/stats.ts`

```typescript
export interface WebRTCStats {
  fps: number;
  width: number;
  height: number;
  bitrate: number;           // kbps
  packetsLost: number;
  jitter: number;            // seconds
  roundTripTime: number;     // seconds
  codec: string;
  candidateType: string;     // 'host' | 'srflx' | 'relay' (tells if using TURN)
  transportProtocol: string; // 'udp' | 'tcp'
}

export async function getWebRTCStats(pc: RTCPeerConnection): Promise<WebRTCStats | null> {
  const stats = await pc.getStats();
  let result: Partial<WebRTCStats> = {};

  stats.forEach((report) => {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      result.fps = report.framesPerSecond;
      result.width = report.frameWidth;
      result.height = report.frameHeight;
      result.packetsLost = report.packetsLost;
      result.jitter = report.jitter;
    }
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      result.roundTripTime = report.currentRoundTripTime;
    }
    if (report.type === 'codec' && report.mimeType?.includes('video')) {
      result.codec = report.mimeType;
    }
    if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
      if (report.isRemote === false || report.type === 'local-candidate') {
        result.candidateType = report.candidateType;
        result.transportProtocol = report.protocol;
      }
    }
  });

  return result as WebRTCStats;
}
```

**Usage:** Poll `getWebRTCStats(pc)` every 2 seconds and display in `StatsPanel`.

**Displayed stats:**
| Stat | Source | Display |
|---|---|---|
| FPS | `requestVideoFrameCallback` + `getStats()` | `30 fps` |
| Resolution | `getStats()` inbound-rtp | `1280x720` |
| Bitrate | `getStats()` computed from bytes received | `2.5 Mbps` |
| Latency | Data channel ping/pong | `45 ms` |
| RTT | `getStats()` candidate-pair | `12 ms` |
| Packet Loss | `getStats()` inbound-rtp | `0.1%` |
| Jitter | `getStats()` inbound-rtp | `5 ms` |
| Connection | `getStats()` candidate type | `relay (TURN)` or `host (direct)` |
| Codec | `getStats()` codec report | `video/VP8` |

---

### 1.9 — SDP Optimization (Codec Preference)
**Action:** Prefer H.264 over VP8/VP9 for lower encoding/decoding latency.

**File:** `src/lib/webrtc/sdp-utils.ts`

```typescript
export function preferH264(sdp: string): string {
  // Move H.264 payload type to front of m=video line
  const lines = sdp.split('\r\n');
  // ... SDP manipulation to reorder codec priority
  return lines.join('\r\n');
}

// Alternative: Use transceiver codec preferences (cleaner)
export function setCodecPreferences(pc: RTCPeerConnection) {
  const transceivers = pc.getTransceivers();
  for (const transceiver of transceivers) {
    if (transceiver.receiver.track?.kind === 'video') {
      const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs ?? [];
      const h264 = codecs.filter(c => c.mimeType === 'video/H264');
      const others = codecs.filter(c => c.mimeType !== 'video/H264');
      transceiver.setCodecPreferences([...h264, ...others]);
    }
  }
}
```

**Why H.264:** Hardware-accelerated encode/decode on most devices. VP8/VP9 may use software encoding which adds 10-50ms latency.

---

### 1.10 — Force WebSocket Transport (Temporary)
**Action:** If Socket.IO is still in use (before Phase 3 replaces it), force WebSocket-only transport.

**File:** Client-side Socket.IO connections

```typescript
const socket = io({ transports: ['websocket'] });
```

**Server-side (server.ts):**
```typescript
const io = new SocketIOServer(server, {
  transports: ['websocket'],
});
```

**Why:** Socket.IO defaults to long-polling first, then upgrades to WebSocket. This adds 1-2 seconds to initial connection. Forcing WebSocket skips the polling phase.

---

### 1.11 — Clean Up Dead Code
**Action:** Remove all dead/unused code identified in analysis.

**Items to remove:**
| Item | Location | Issue |
|---|---|---|
| `bcryptjs` import | Was in `server.js` | Imported but never called |
| `connect-flash` | Was in `server.js` | Initialized but never used |
| `node-webcam` | `package.json` | Never imported |
| `install` | `package.json` | Accidental dependency |
| `nodemon` | `package.json` devDeps | Not used (Bun --watch) |
| `frame` listener | Was in `host.html` | Server never emits `frame` |
| `availableCameras` listener | Was in both HTML files | Server never emits it |
| `requestCameraAccess` emit | Was in `server.js` | No client handles it |
| Duplicate camera listener | Was in `host.html` | Two identical listeners |

Most of these are already gone after Phase 0 migration. Verify none were accidentally carried over.

---

## Verification Checklist
After Phase 1 is complete, verify:

- [ ] Camera captures at 720p/30fps with low latency
- [ ] Video element is `muted` and `playsInline`
- [ ] TURN credentials are fetched from `/api/turn-credentials`
- [ ] Both host and viewer use Cloudflare TURN + STUN
- [ ] Video streams over the internet (not just LAN) — test with two different networks
- [ ] Stats panel shows real values:
  - [ ] FPS is actual stream FPS (not always 60)
  - [ ] Resolution shows actual stream resolution
  - [ ] Latency shows real round-trip measurement
  - [ ] Bitrate is calculated correctly
  - [ ] Connection type shows host/srflx/relay
  - [ ] Codec shows actual codec in use
- [ ] Buffer management keeps delay under 200ms on LAN
- [ ] Data channel latency ping/pong works (viewer measures, host responds)
- [ ] PeerJS is completely removed (no CDN script, no PeerJS server)
- [ ] Socket.IO uses WebSocket transport only (no long-polling)
- [ ] No dead code remains
- [ ] All TypeScript compiles without errors

---

## Estimated Effort
- **Tasks:** 11
- **Complexity:** High (WebRTC internals, SDP manipulation, stats parsing)
- **Risk areas:** Native WebRTC without PeerJS (more code to write), TURN credential caching/refresh, H.264 codec preference across browsers
