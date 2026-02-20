# Phase 3 — PartyKit Signaling Server

## Goal
Replace Socket.IO with PartyKit for all real-time communication: WebRTC signaling (offer/answer/ICE relay), chat messages, show settings sync, and theme sync. This eliminates the need for the custom Next.js server (`server.ts`) and the PeerJS signaling server.

## Prerequisites
- Phase 0 complete (Next.js migration done)
- PartyKit account/project set up

## Timing
Phase 3 can be started **during Phase 0** or **after Phase 1** — it's mostly independent. However, the signaling protocol must support both P2P (Phase 1) and SFU (Phase 2) modes.

---

## Architecture

### PartyKit vs PartyServer — Which to Use

| Option | Hosting | npm Package | Deployment |
|---|---|---|---|
| **PartyKit** (original) | PartyKit managed platform | `partykit` | `npx partykit deploy` |
| **PartyServer** (new) | Cloudflare Workers + Durable Objects | `partyserver` | `wrangler deploy` |

**Recommendation: PartyKit (original managed platform)**

Reasons:
- Simpler setup — `npx partykit dev` just works
- No Cloudflare Workers/Durable Objects config to manage
- Built-in deploy previews
- The managed platform is still active (despite development moving to cloudflare/partykit for the library)
- You're already using Cloudflare for TURN/SFU — using PartyKit's managed platform keeps a separation of concerns
- Migration to PartyServer later is straightforward if needed (same client library)

**If you want everything on Cloudflare:** Use PartyServer with Wrangler. This gives you one platform for TURN, SFU, and signaling. But it requires more config.

---

## Room Design

### Single Room Per Show
Each "show" (host session) gets one PartyKit room. The room ID could be:
- The host's user ID (if auth is added later)
- A generated show ID
- For now: a fixed room like `"stage-link-main"` (single-host model)

### Connection Tags
```
host    — the host connection (only one)
viewer  — viewer connections (many)
```

Tags enable targeted messaging (e.g., send only to host, broadcast only to viewers).

---

## Tasks

### 3.1 — PartyKit Server Setup
**Action:** Create PartyKit project in `party/` directory.

**Directory structure:**
```
party/
├── package.json
├── tsconfig.json
├── partykit.json          # PartyKit config (if using managed platform)
└── src/
    └── signaling.ts       # Main server
```

**Or with PartyServer (Cloudflare Workers):**
```
party/
├── package.json
├── tsconfig.json
├── wrangler.jsonc         # Wrangler config
└── src/
    └── signaling.ts       # Main server (exports Durable Object class)
```

---

### 3.2 — Signaling Server Implementation
**Action:** Implement the PartyKit server that handles all real-time communication.

**File:** `party/src/signaling.ts`

**Message Protocol:**

All messages are JSON with a `type` field:

```typescript
// === WebRTC Signaling ===
type SignalOffer = {
  type: 'offer';
  targetId: string;       // Target connection ID
  sdp: string;
};

type SignalAnswer = {
  type: 'answer';
  targetId: string;
  sdp: string;
};

type SignalIceCandidate = {
  type: 'ice-candidate';
  targetId: string;
  candidate: RTCIceCandidateInit;
};

// === Host Announcements ===
type HostReady = {
  type: 'host-ready';
  mode: 'p2p' | 'sfu';
  sfuSessionId?: string;   // Only if SFU mode
  sfuTrackName?: string;   // Only if SFU mode
};

type HostLeft = {
  type: 'host-left';
};

// === Viewer Events ===
type ViewerJoined = {
  type: 'viewer-joined';
  viewerId: string;
};

type ViewerLeft = {
  type: 'viewer-left';
  viewerId: string;
};

// === Show Settings ===
type ShowSettingsUpdate = {
  type: 'show-settings';
  showName: string;
  selectedCamera?: number;
};

// === Theme ===
type ThemeChange = {
  type: 'theme-change';
  theme: string;
};

// === Chat ===
type ChatMessage = {
  type: 'chat-message';
  username: string;
  message: string;
  timestamp: number;
};
```

**Server implementation:**

```typescript
import type * as Party from "partykit/server";

interface RoomState {
  hostId: string | null;
  hostMode: 'p2p' | 'sfu' | null;
  sfuSessionId: string | null;
  sfuTrackName: string | null;
  showSettings: {
    showName: string;
    selectedCamera: number;
  };
  theme: string;
}

export default class SignalingServer implements Party.Server {
  state: RoomState = {
    hostId: null,
    hostMode: null,
    sfuSessionId: null,
    sfuTrackName: null,
    showSettings: { showName: 'Stage Link', selectedCamera: 0 },
    theme: 'dark',
  };

  constructor(readonly room: Party.Room) {}

  // Tag connections as 'host' or 'viewer'
  getConnectionTags(connection: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get('role') ?? 'viewer';
    return [role];
  }

  onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get('role') ?? 'viewer';

    if (role === 'host') {
      this.state.hostId = connection.id;
      // Notify all viewers that host connected
      this.room.broadcast(JSON.stringify({
        type: 'host-ready',
        mode: this.state.hostMode,
        sfuSessionId: this.state.sfuSessionId,
        sfuTrackName: this.state.sfuTrackName,
      }), [connection.id]);
    } else {
      // Send current state to new viewer
      connection.send(JSON.stringify({
        type: 'room-state',
        hostId: this.state.hostId,
        hostMode: this.state.hostMode,
        sfuSessionId: this.state.sfuSessionId,
        sfuTrackName: this.state.sfuTrackName,
        showSettings: this.state.showSettings,
        theme: this.state.theme,
      }));

      // Notify host about new viewer (for P2P mode)
      if (this.state.hostId) {
        const host = this.room.getConnection(this.state.hostId);
        host?.send(JSON.stringify({
          type: 'viewer-joined',
          viewerId: connection.id,
        }));
      }
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);

    switch (data.type) {
      // WebRTC signaling — relay to target
      case 'offer':
      case 'answer':
      case 'ice-candidate': {
        const target = this.room.getConnection(data.targetId);
        target?.send(JSON.stringify({ ...data, fromId: sender.id }));
        break;
      }

      // Host announces mode/stream info
      case 'host-ready': {
        this.state.hostMode = data.mode;
        this.state.sfuSessionId = data.sfuSessionId ?? null;
        this.state.sfuTrackName = data.sfuTrackName ?? null;
        this.room.broadcast(message, [sender.id]);
        break;
      }

      // Show settings update (from host)
      case 'show-settings': {
        this.state.showSettings = {
          showName: data.showName,
          selectedCamera: data.selectedCamera ?? 0,
        };
        this.room.broadcast(message, [sender.id]);
        break;
      }

      // Theme change (from host, global)
      case 'theme-change': {
        this.state.theme = data.theme;
        this.room.broadcast(message, [sender.id]);
        break;
      }

      // Chat message — broadcast to everyone (including sender for confirmation)
      case 'chat-message': {
        this.room.broadcast(message);
        break;
      }
    }
  }

  onClose(connection: Party.Connection) {
    if (connection.id === this.state.hostId) {
      this.state.hostId = null;
      this.state.hostMode = null;
      this.state.sfuSessionId = null;
      this.state.sfuTrackName = null;
      this.room.broadcast(JSON.stringify({ type: 'host-left' }));
    } else {
      // Notify host that viewer left
      if (this.state.hostId) {
        const host = this.room.getConnection(this.state.hostId);
        host?.send(JSON.stringify({
          type: 'viewer-left',
          viewerId: connection.id,
        }));
      }
    }
  }
}
```

---

### 3.3 — Client-Side PartyKit Hook
**Action:** Create `src/hooks/use-party.ts` for connecting to the PartyKit room.

```typescript
'use client';

import usePartySocket from 'partysocket/react';
import { useCallback, useState } from 'react';

interface RoomState {
  hostId: string | null;
  hostMode: 'p2p' | 'sfu' | null;
  sfuSessionId: string | null;
  sfuTrackName: string | null;
  showSettings: { showName: string; selectedCamera: number };
  theme: string;
}

interface UsePartyOptions {
  room: string;
  role: 'host' | 'viewer';
  onSignal?: (data: any) => void;
  onViewerJoined?: (viewerId: string) => void;
  onViewerLeft?: (viewerId: string) => void;
  onHostReady?: (mode: string, sfuSessionId?: string, sfuTrackName?: string) => void;
  onHostLeft?: () => void;
  onChatMessage?: (username: string, message: string, timestamp: number) => void;
  onShowSettings?: (settings: { showName: string; selectedCamera: number }) => void;
  onThemeChange?: (theme: string) => void;
}

export function useParty(options: UsePartyOptions) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);

  const ws = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTY_HOST!,
    room: options.room,
    query: { role: options.role },

    onMessage(event) {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'room-state':
          setRoomState(data);
          options.onShowSettings?.(data.showSettings);
          options.onThemeChange?.(data.theme);
          if (data.hostId && data.hostMode) {
            options.onHostReady?.(data.hostMode, data.sfuSessionId, data.sfuTrackName);
          }
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          options.onSignal?.(data);
          break;

        case 'viewer-joined':
          options.onViewerJoined?.(data.viewerId);
          break;

        case 'viewer-left':
          options.onViewerLeft?.(data.viewerId);
          break;

        case 'host-ready':
          options.onHostReady?.(data.mode, data.sfuSessionId, data.sfuTrackName);
          break;

        case 'host-left':
          options.onHostLeft?.();
          break;

        case 'chat-message':
          options.onChatMessage?.(data.username, data.message, data.timestamp);
          break;

        case 'show-settings':
          options.onShowSettings?.(data);
          break;

        case 'theme-change':
          options.onThemeChange?.(data.theme);
          break;
      }
    },
  });

  // Send methods
  const sendSignal = useCallback((data: any) => {
    ws.send(JSON.stringify(data));
  }, [ws]);

  const sendChat = useCallback((username: string, message: string) => {
    ws.send(JSON.stringify({
      type: 'chat-message',
      username,
      message,
      timestamp: Date.now(),
    }));
  }, [ws]);

  const updateShowSettings = useCallback((showName: string, selectedCamera?: number) => {
    ws.send(JSON.stringify({
      type: 'show-settings',
      showName,
      selectedCamera: selectedCamera ?? 0,
    }));
  }, [ws]);

  const changeTheme = useCallback((theme: string) => {
    ws.send(JSON.stringify({
      type: 'theme-change',
      theme,
    }));
  }, [ws]);

  const announceHostMode = useCallback((mode: 'p2p' | 'sfu', sfuSessionId?: string, sfuTrackName?: string) => {
    ws.send(JSON.stringify({
      type: 'host-ready',
      mode,
      sfuSessionId,
      sfuTrackName,
    }));
  }, [ws]);

  return {
    connectionId: ws.id,
    roomState,
    sendSignal,
    sendChat,
    updateShowSettings,
    changeTheme,
    announceHostMode,
  };
}
```

---

### 3.4 — Remove Socket.IO
**Action:** Remove all Socket.IO code from the application.

**Items to remove:**
- `socket.io` from `package.json` dependencies
- Socket.IO server attachment in `server.ts` (custom server)
- All `io()` / `socket.on()` / `socket.emit()` calls in components
- `theme.js` (its Socket.IO connection for theme sync — replaced by `useParty`)

**Items to replace:**
| Old (Socket.IO) | New (PartyKit) |
|---|---|
| `socket.emit('hostReady', peerId)` | `announceHostMode('p2p')` |
| `socket.emit('updateShowSettings', data)` | `updateShowSettings(name, camera)` |
| `socket.emit('themeChange', theme)` | `changeTheme(theme)` |
| `socket.emit('chatMessage', msg)` | `sendChat(username, message)` |
| `socket.on('hostId', cb)` | `onHostReady` callback |
| `socket.on('showSettings', cb)` | `onShowSettings` callback |
| `socket.on('themeUpdate', cb)` | `onThemeChange` callback |
| `socket.on('chatMessage', cb)` | `onChatMessage` callback |

---

### 3.5 — Remove Custom Server
**Action:** After Socket.IO is removed, the custom `server.ts` is no longer needed. Next.js can run normally.

**Before (Phase 0):**
```json
{
  "scripts": {
    "dev": "bun run server.ts",
    "build": "next build",
    "start": "NODE_ENV=production bun run server.ts"
  }
}
```

**After (Phase 3):**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "party:dev": "npx partykit dev --dir party",
    "party:deploy": "npx partykit deploy --dir party"
  }
}
```

**Development:** Two processes — `bun run dev` for Next.js, `bun run party:dev` for PartyKit.

---

### 3.6 — PartyKit Deployment Config
**Action:** Configure PartyKit for deployment.

**If using PartyKit managed platform:**

**File:** `party/partykit.json`
```json
{
  "name": "stage-link",
  "main": "src/signaling.ts",
  "compatibilityDate": "2024-01-01"
}
```

**If using PartyServer (Cloudflare Workers):**

**File:** `party/wrangler.jsonc`
```jsonc
{
  "name": "stage-link-signaling",
  "main": "src/signaling.ts",
  "compatibility_date": "2024-01-01",
  "durable_objects": {
    "bindings": [
      {
        "name": "SignalingServer",
        "class_name": "SignalingServer"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["SignalingServer"]
    }
  ]
}
```

---

### 3.7 — Reconnection Handling
**Action:** Handle connection drops and reconnections gracefully.

**PartySocket features:**
- Auto-reconnects with exponential backoff (built-in)
- Connection ID is preserved across reconnections (if `id` is specified)
- Room state is re-sent on reconnect via `onConnect`

**Additional handling needed:**
- When viewer reconnects, request fresh room state
- When host reconnects, re-announce mode and re-establish WebRTC connections with existing viewers
- Show "Reconnecting..." status in UI during reconnection

```typescript
const ws = usePartySocket({
  // ...
  onClose() {
    setConnectionStatus('reconnecting');
  },
  onOpen() {
    setConnectionStatus('connected');
    // Re-request room state
  },
});
```

---

### 3.8 — Viewer Count
**Action:** Track and display the number of connected viewers.

**Server-side:**
```typescript
// In onConnect / onClose, broadcast viewer count
const viewerCount = [...this.room.getConnections('viewer')].length;
this.room.broadcast(JSON.stringify({
  type: 'viewer-count',
  count: viewerCount,
}));
```

**Client-side:** Display in host UI (useful for monitoring).

---

## Verification Checklist

- [ ] PartyKit server starts with `bun run party:dev`
- [ ] Host connects to PartyKit room as 'host'
- [ ] Viewer connects to PartyKit room as 'viewer'
- [ ] WebRTC signaling works (offer/answer/ICE relay via PartyKit)
- [ ] Chat messages are sent and received via PartyKit
- [ ] Show settings sync works via PartyKit
- [ ] Global theme change broadcasts to all viewers via PartyKit
- [ ] Host disconnect is detected by viewers
- [ ] Viewer count is tracked and displayed
- [ ] Auto-reconnection works on connection drop
- [ ] Socket.IO is completely removed from the project
- [ ] Custom `server.ts` is removed — Next.js runs normally
- [ ] PeerJS server is removed (port 9000 no longer needed)
- [ ] `bun run dev` and `bun run party:dev` work side by side
- [ ] All features work with two separate processes (Next.js + PartyKit)

---

## Environment Variables

```env
# Add to .env.local
NEXT_PUBLIC_PARTY_HOST=127.0.0.1:1999    # Local dev (PartyKit default port)

# Production
NEXT_PUBLIC_PARTY_HOST=stage-link.username.partykit.dev
```

---

## Estimated Effort
- **Tasks:** 8
- **Complexity:** Medium (well-defined protocol, PartyKit handles most WebSocket complexity)
- **Risk areas:** Two dev processes (DX friction), PartyKit managed platform availability, reconnection edge cases, migration of all Socket.IO event handling
