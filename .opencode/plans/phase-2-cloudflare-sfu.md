# Phase 2 — Cloudflare SFU Mode

## Goal
Add Cloudflare SFU as an alternative streaming mode for higher-tier plans. Host pushes ONE track to Cloudflare's edge network, viewers pull from Cloudflare. Scales to hundreds of viewers without increasing host CPU/bandwidth.

## Prerequisites
- Phase 1 complete (native WebRTC, TURN working, stats working)
- Cloudflare Calls credentials available (`CALLS_APP_ID`, `CALLS_APP_SECRET`)

---

## Architecture

### How Cloudflare Calls SFU Works
```
┌──────────┐         ┌────────────────────┐         ┌──────────┐
│   Host   │ ──────► │  Cloudflare SFU    │ ──────► │ Viewer 1 │
│ (1 track)│  push   │  (edge network)    │  pull   │          │
└──────────┘         │                    │         └──────────┘
                     │  310+ cities       │ ──────► ┌──────────┐
                     │  anycast WebRTC    │  pull   │ Viewer 2 │
                     │  NACK shield       │         └──────────┘
                     │                    │ ──────► ┌──────────┐
                     │                    │  pull   │ Viewer N │
                     └────────────────────┘         └──────────┘
```

### API Flow
1. **Host creates session:** `POST /v1/apps/{APP_ID}/sessions/new` → returns `sessionId`
2. **Host pushes track:** Create `RTCPeerConnection`, add video track, create offer → `POST /v1/apps/{APP_ID}/sessions/{sessionId}/tracks/new` with offer SDP → returns answer SDP
3. **Host announces track:** Sends `{ sessionId, trackName }` to PartyKit room
4. **Viewer creates session:** Same endpoint → returns viewer's `sessionId`
5. **Viewer pulls track:** `POST /v1/apps/{APP_ID}/sessions/{viewerSessionId}/tracks/new` with host's `sessionId` + `trackName` → returns answer SDP
6. **Renegotiation:** Cloudflare may send renegotiation signals when tracks are added/removed

### Key Concepts
| Concept | Description |
|---|---|
| **Session** | A logical participant. Each host and viewer gets one. |
| **Track** | A media track (video or audio) within a session. |
| **Push** | Host sends track TO Cloudflare (`sendonly` transceiver). |
| **Pull** | Viewer receives track FROM Cloudflare (`recvonly` transceiver). |
| **No rooms** | Cloudflare has no "room" concept. Track routing is explicit (pull by session ID + track name). |

---

## Tasks

### 2.1 — SFU Proxy API Routes
**Action:** Create Next.js API routes that proxy Cloudflare Calls API requests. The Cloudflare `CALLS_APP_SECRET` must never be exposed to browsers.

**Routes:**

#### `src/app/api/sfu/session/route.ts`
```typescript
// POST — Create a new SFU session
export async function POST() {
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/apps/${process.env.CALLS_APP_ID}/sessions/new`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CALLS_APP_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );
  const data = await res.json();
  return NextResponse.json(data);
}
```

#### `src/app/api/sfu/tracks/route.ts`
```typescript
// POST — Push or pull tracks
// Body: { sessionId, tracks: [{ location: 'local'|'remote', trackName, sessionDescription }] }
export async function POST(request: Request) {
  const body = await request.json();
  const { sessionId, ...rest } = body;

  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/apps/${process.env.CALLS_APP_ID}/sessions/${sessionId}/tracks/new`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CALLS_APP_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rest),
    }
  );
  const data = await res.json();
  return NextResponse.json(data);
}
```

#### `src/app/api/sfu/renegotiate/route.ts`
```typescript
// PUT — Handle renegotiation (Cloudflare sends new offer when tracks change)
export async function PUT(request: Request) {
  const body = await request.json();
  const { sessionId, sessionDescription } = body;

  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/apps/${process.env.CALLS_APP_ID}/sessions/${sessionId}/renegotiate`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.CALLS_APP_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionDescription }),
    }
  );
  const data = await res.json();
  return NextResponse.json(data);
}
```

---

### 2.2 — SFU Host Hook
**Action:** Create `src/hooks/use-sfu.ts` for host-side SFU connection.

**Flow:**
1. Create SFU session via `/api/sfu/session`
2. Create `RTCPeerConnection` with Cloudflare TURN config
3. Add video track as `sendonly` transceiver
4. Create offer SDP
5. Send offer to Cloudflare via `/api/sfu/tracks` (push track)
6. Set Cloudflare's answer as remote description
7. Announce `{ sessionId, trackName }` to PartyKit room so viewers can pull

```typescript
export function useSfuHost(stream: MediaStream | null) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [trackName, setTrackName] = useState<string | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const connect = useCallback(async () => {
    if (!stream) return;
    setStatus('connecting');

    // 1. Create session
    const sessionRes = await fetch('/api/sfu/session', { method: 'POST' });
    const { sessionId } = await sessionRes.json();
    setSessionId(sessionId);

    // 2. Create peer connection
    const iceConfig = await getIceConfig();
    const pc = new RTCPeerConnection(iceConfig);
    pcRef.current = pc;

    // 3. Add video track (sendonly)
    const videoTrack = stream.getVideoTracks()[0];
    const transceiver = pc.addTransceiver(videoTrack, { direction: 'sendonly' });
    const trackName = `video-${Date.now()}`;

    // 4. Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 5. Push track to Cloudflare
    const trackRes = await fetch('/api/sfu/tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        tracks: [{
          location: 'local',
          trackName,
          sessionDescription: {
            type: 'offer',
            sdp: pc.localDescription!.sdp,
          },
        }],
      }),
    });

    const trackData = await trackRes.json();

    // 6. Set answer
    await pc.setRemoteDescription({
      type: 'answer',
      sdp: trackData.sessionDescription.sdp,
    });

    setTrackName(trackName);
    setStatus('connected');
  }, [stream]);

  return { sessionId, trackName, status, connect, disconnect };
}
```

---

### 2.3 — SFU Viewer Hook
**Action:** Create viewer-side SFU connection in `src/hooks/use-sfu.ts` (same file, separate hook).

**Flow:**
1. Receive `{ sessionId: hostSessionId, trackName }` from PartyKit room
2. Create own SFU session via `/api/sfu/session`
3. Create `RTCPeerConnection`
4. Add `recvonly` transceiver
5. Create offer
6. Send to Cloudflare via `/api/sfu/tracks` (pull track)
7. Set answer
8. Handle `ontrack` event to get video stream
9. Handle renegotiation (Cloudflare may re-offer)

```typescript
export function useSfuViewer(hostSessionId: string | null, hostTrackName: string | null) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const connect = useCallback(async () => {
    if (!hostSessionId || !hostTrackName) return;
    setStatus('connecting');

    // 1. Create own session
    const sessionRes = await fetch('/api/sfu/session', { method: 'POST' });
    const { sessionId } = await sessionRes.json();

    // 2. Create peer connection
    const iceConfig = await getIceConfig();
    const pc = new RTCPeerConnection(iceConfig);

    // 3. Handle incoming track
    pc.ontrack = (e) => {
      setStream(e.streams[0]);
      setStatus('connected');
    };

    // 4. Add recvonly transceiver
    pc.addTransceiver('video', { direction: 'recvonly' });

    // 5. Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 6. Pull track from Cloudflare
    const trackRes = await fetch('/api/sfu/tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        tracks: [{
          location: 'remote',
          trackName: hostTrackName,
          sessionDescription: {
            type: 'offer',
            sdp: pc.localDescription!.sdp,
          },
        }],
      }),
    });

    const trackData = await trackRes.json();

    // 7. Set answer
    await pc.setRemoteDescription({
      type: 'answer',
      sdp: trackData.sessionDescription.sdp,
    });

    // 8. Handle renegotiation
    pc.onnegotiationneeded = async () => {
      const newOffer = await pc.createOffer();
      await pc.setLocalDescription(newOffer);

      const renegRes = await fetch('/api/sfu/renegotiate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionDescription: {
            type: 'offer',
            sdp: pc.localDescription!.sdp,
          },
        }),
      });

      const renegData = await renegRes.json();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: renegData.sessionDescription.sdp,
      });
    };
  }, [hostSessionId, hostTrackName]);

  return { stream, status, connect, disconnect };
}
```

---

### 2.4 — Streaming Mode Selector
**Action:** Add UI for host to choose between P2P and SFU mode.

**File:** `src/app/host/page.tsx` and new component `src/components/controls/stream-mode-selector.tsx`

**UI:**
- shadcn `Tabs` or `ToggleGroup` with two options: "P2P (Direct)" and "SFU (Scalable)"
- Show viewer count limit: P2P shows "Up to 15 viewers", SFU shows "Unlimited viewers"
- Show connection status specific to the mode
- Mode selection should be done BEFORE starting the stream (can't switch mid-stream without interruption)

**State flow:**
```typescript
type StreamMode = 'p2p' | 'sfu';

const [streamMode, setStreamMode] = useState<StreamMode>('p2p');
const [isStreaming, setIsStreaming] = useState(false);

// Use appropriate hook based on mode
const p2p = useWebRTC(streamMode === 'p2p' ? stream : null);
const sfu = useSfuHost(streamMode === 'sfu' ? stream : null);
```

---

### 2.5 — Viewer Auto-Detection
**Action:** Viewer should automatically detect whether the host is using P2P or SFU mode and connect accordingly.

**Signaling message from host (via PartyKit):**
```typescript
// Host announces its mode
sendToRoom({
  type: 'host-mode',
  mode: 'sfu',                    // or 'p2p'
  sfuSessionId: sessionId,        // only if SFU
  sfuTrackName: trackName,        // only if SFU
});
```

**Viewer logic:**
```typescript
// On receiving host mode announcement
if (hostMode === 'sfu') {
  // Connect via Cloudflare SFU
  sfuViewer.connect();
} else {
  // Connect via P2P (native RTCPeerConnection)
  webrtc.connect();
}
```

---

### 2.6 — SFU Data Channel for Latency
**Action:** Cloudflare SFU supports data channels. Use them for latency measurement in SFU mode.

The same ping/pong mechanism from Phase 1 works, but the data channel goes through Cloudflare's edge network instead of directly between peers.

**Note:** SFU data channel latency will be slightly higher than P2P on LAN (extra hop through Cloudflare edge), but will be lower than P2P over the internet (Cloudflare's anycast network is faster than typical internet routing).

---

### 2.7 — Camera Switch in SFU Mode
**Action:** When host switches camera, replace the track in the SFU session without creating a new session.

```typescript
const replaceTrack = async (newTrack: MediaStreamTrack) => {
  const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
  if (sender) {
    await sender.replaceTrack(newTrack);
  }
};
```

**Key:** `replaceTrack()` swaps the track without renegotiation. Viewers continue receiving the stream seamlessly. This is a significant improvement over the current PeerJS behavior which re-calls all connected peers on camera change.

---

## Verification Checklist

- [ ] Host can select SFU mode before starting stream
- [ ] Host can select P2P mode before starting stream
- [ ] SFU mode: host pushes one track to Cloudflare
- [ ] SFU mode: multiple viewers can pull the track simultaneously
- [ ] SFU mode: video plays with low latency on viewers
- [ ] SFU mode: stats panel shows correct metrics
- [ ] SFU mode: latency measurement works via data channel
- [ ] SFU mode: camera switch works without reconnection
- [ ] P2P mode: still works as before (Phase 1)
- [ ] Viewer auto-detects host mode and connects appropriately
- [ ] `/api/sfu/*` routes proxy correctly to Cloudflare
- [ ] `CALLS_APP_SECRET` is never exposed to browser
- [ ] Chat still works in both modes (via PartyKit)
- [ ] Theme sync still works in both modes
- [ ] Show settings sync still works in both modes
- [ ] Test with 5+ simultaneous viewers in SFU mode

---

## Pricing Reference
| Resource | Free Tier | Paid |
|---|---|---|
| Cloudflare SFU | First 1,000 GB/month | $0.05/GB after |
| Cloudflare TURN | First 1,000 GB/month | $0.05/GB after |
| TURN via SFU | FREE (no charge when TURN is used with SFU) | FREE |

---

## Estimated Effort
- **Tasks:** 7
- **Complexity:** High (Cloudflare API integration, dual streaming modes, auto-detection)
- **Risk areas:** Cloudflare API error handling, renegotiation edge cases, track replacement timing, SFU data channel availability
