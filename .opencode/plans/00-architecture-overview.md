# Stage Link — Architecture Overview

## Current State

Stage Link is a monolithic Express.js app with vanilla HTML/JS frontend for real-time stage monitoring. Video streams peer-to-peer via PeerJS (WebRTC), signaling and chat via Socket.IO.

### Current Stack
| Layer | Technology |
|---|---|
| Runtime | Bun |
| Server | Express.js v4 (single `server.js`, 222 lines) |
| Realtime | Socket.IO v4 (signaling, chat, settings sync) |
| Video | PeerJS v1.4.7 (WebRTC P2P) |
| Signaling Server | PeerJS server on port 9000 |
| Frontend | Vanilla HTML/JS (inline scripts) |
| Styling | Tailwind CSS v4 (CSS-first config) |
| Auth | express-session + plaintext password |
| Database | None (in-memory state) |

### Current File Structure
```
main/
├── server.js              # Entire backend (routes, Socket.IO, PeerJS server)
├── package.json
├── public/
│   ├── index.html         # Landing page
│   ├── login.html         # Password form
│   ├── host.html          # Host control panel (433 lines, inline JS)
│   ├── viewer.html        # Viewer page (515 lines, inline JS)
│   ├── css/
│   │   ├── input.css      # Tailwind source + 10 custom themes
│   │   └── output.css     # Compiled Tailwind
│   └── js/
│       └── theme.js       # Shared theme switching
```

### Known Issues (to be fixed during migration)
- `measureLatency` function undefined — called every 2s, throws ReferenceError
- Host has no data channel ping handler — never responds to latency pings
- FPS counter measures `requestAnimationFrame` rate (~60fps always), not actual stream frames
- Viewer has NO ICE servers configured (host has only Google STUN)
- No TURN servers = fails behind symmetric NAT / firewalls
- No buffer management = 200-500ms visible delay from browser buffering
- Socket.IO starts with long-polling before upgrading to WebSocket
- P2P limits to ~5-15 viewers (host CPU/upload bottleneck)
- Dead code: `bcryptjs`, `connect-flash`, `node-webcam`, frame listener, `availableCameras` listener
- Duplicate camera change listener in host.html
- Chat messages use `innerHTML` (XSS risk)
- Static file serving bypasses auth middleware for `/host.html`
- theme.js creates a second Socket.IO connection per page

---

## Target State

### Target Stack
| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI Library | shadcn/ui (Radix primitives) |
| Styling | Tailwind CSS v4 + CSS variables |
| Realtime | PartyKit (separate WebSocket server for signaling + chat) |
| Video (Tier 1) | WebRTC P2P (native RTCPeerConnection, no PeerJS) |
| Video (Tier 2) | Cloudflare SFU (host pushes 1 track, viewers pull from edge) |
| TURN/STUN | Cloudflare TURN (both tiers) |
| Auth | Simple session (migrated), proper auth planned for later |
| Database | None initially (in-memory state via PartyKit rooms) |

### Target File Structure
```
main/
├── .opencode/plans/               # Planning documents
├── party/                         # PartyKit server (separate process)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── signaling.ts           # WebRTC signaling + chat + settings sync
├── src/                           # Next.js app
│   ├── app/
│   │   ├── layout.tsx             # Root layout (ThemeProvider, Toaster)
│   │   ├── page.tsx               # Landing page (/)
│   │   ├── login/
│   │   │   └── page.tsx           # Login page
│   │   ├── host/
│   │   │   └── page.tsx           # Host control panel
│   │   ├── viewer/
│   │   │   └── page.tsx           # Viewer page
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── status/route.ts
│   │       ├── turn-credentials/
│   │       │   └── route.ts       # Proxy to Cloudflare TURN API
│   │       └── sfu/
│   │           ├── session/route.ts
│   │           ├── tracks/route.ts
│   │           └── renegotiate/route.ts
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components (auto-generated)
│   │   ├── video/
│   │   │   ├── video-player.tsx   # Viewer video with buffer management
│   │   │   ├── camera-preview.tsx # Host camera preview
│   │   │   └── stats-panel.tsx    # WebRTC stats display
│   │   ├── chat/
│   │   │   ├── chat-panel.tsx
│   │   │   └── chat-message.tsx
│   │   ├── controls/
│   │   │   ├── camera-selector.tsx
│   │   │   ├── theme-selector.tsx
│   │   │   └── show-settings.tsx
│   │   └── layout/
│   │       ├── connection-status.tsx
│   │       └── live-clock.tsx
│   ├── hooks/
│   │   ├── use-webrtc.ts          # WebRTC P2P connection management
│   │   ├── use-sfu.ts             # Cloudflare SFU connection management
│   │   ├── use-party.ts           # PartyKit connection hook
│   │   ├── use-media-stream.ts    # getUserMedia with optimized constraints
│   │   └── use-latency.ts         # Data channel latency measurement
│   ├── lib/
│   │   ├── utils.ts               # shadcn cn() utility
│   │   ├── webrtc/
│   │   │   ├── ice-config.ts      # ICE server config (TURN/STUN)
│   │   │   ├── sdp-utils.ts       # SDP manipulation (codec preference)
│   │   │   └── stats.ts           # RTCPeerConnection.getStats() parser
│   │   ├── sfu/
│   │   │   └── cloudflare.ts      # Cloudflare SFU client helpers
│   │   └── constants.ts
│   └── styles/
│       └── globals.css            # Tailwind imports + 10 theme definitions
├── public/                        # Static assets only
├── next.config.ts
├── tsconfig.json
├── package.json
├── .env.local
└── .env.example
```

---

## Environment Variables

### Current
```
SESSION_SECRET=stagelink-secret
HOST_PASSWORD=stagelink123
PORT=3000
```

### Target
```env
# Auth (keep existing)
SESSION_SECRET=
HOST_PASSWORD=

# Cloudflare TURN (Phase 1)
TURN_KEY_ID=
TURN_KEY_API_TOKEN=

# Cloudflare SFU (Phase 2)
CALLS_APP_ID=
CALLS_APP_SECRET=

# PartyKit (Phase 0)
NEXT_PUBLIC_PARTY_HOST=           # Public — used by browser client

# Next.js
PORT=3000
```

---

## Theme System

### Current: 10 themes via `data-theme` attribute
dark, light, pink, blue, purple, green, red, teal, cyberpunk, ultra-black

Each defines `--color-main-50` through `--color-main-900` color scales.

### Target: Dual variable system
Each theme sets BOTH:
1. Existing `--color-main-*` scale (backward compat)
2. shadcn semantic tokens (`--primary`, `--background`, `--card`, `--muted`, etc.)

This ensures all shadcn/ui components automatically theme correctly while preserving the custom color scale.

---

## Streaming Modes

### Mode 1: WebRTC P2P (Lower Tier)
- Host creates `RTCPeerConnection` per viewer (no PeerJS library)
- Signaling via PartyKit room (offer/answer/ICE relay)
- Data channel for latency ping/pong
- Cloudflare TURN for NAT traversal
- Limit: ~5-15 viewers

### Mode 2: Cloudflare SFU (Higher Tier)
- Host creates ONE `RTCPeerConnection` to Cloudflare SFU
- Pushes track via Cloudflare Calls API (proxied through Next.js API routes)
- Viewers each pull track from Cloudflare by session ID + track name
- Track IDs exchanged via PartyKit room
- Limit: hundreds of viewers

### Shared (Both Modes)
- PartyKit room for signaling, chat, settings, theme sync
- Cloudflare TURN/STUN ICE config
- Same UI components
- Same latency measurement (data channel)

---

## Implementation Phases

| Phase | Focus | Depends On | File |
|---|---|---|---|
| **Phase 0** | Next.js + shadcn/ui migration | Nothing | `phase-0-nextjs-migration.md` |
| **Phase 1** | Latency fixes + Cloudflare TURN | Phase 0 | `phase-1-latency-and-turn.md` |
| **Phase 2** | Cloudflare SFU mode | Phase 1 | `phase-2-cloudflare-sfu.md` |
| **Phase 3** | PartyKit signaling server | Can start during Phase 0 | `phase-3-partykit-signaling.md` |

See individual phase files for detailed tasks and requirements.
