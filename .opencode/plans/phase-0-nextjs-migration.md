# Phase 0 — Next.js + shadcn/ui Migration

## Goal
Migrate the existing vanilla Express.js + HTML/JS app to Next.js 15 (App Router) with TypeScript, shadcn/ui, and Tailwind CSS v4. This phase is purely structural — no new features, no streaming improvements. The app should work identically to the current version when this phase is complete.

## Prerequisites
- Bun installed
- Current app understood (see `00-architecture-overview.md`)

## Decision Log
| Decision | Choice | Rationale |
|---|---|---|
| Router | App Router | Modern, supports RSC, layouts, loading states |
| Runtime | Bun | Already in use, fully supports Next.js |
| Language | TypeScript | Better DX, shadcn/ui is TypeScript-native |
| UI Library | shadcn/ui | Accessible, customizable, owns the source |
| Realtime | PartyKit (Phase 3) | Replaced Socket.IO — but Phase 0 keeps Socket.IO temporarily |
| Auth | Keep current simple auth | Proper auth (NextAuth/Clerk) planned for later |

---

## Tasks

### 0.1 — Initialize Next.js Project
**Action:** Scaffold a new Next.js 15 app in-place (or in a subdirectory, then move).

```bash
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Requirements:**
- App Router enabled
- TypeScript enabled
- Tailwind CSS v4 (Next.js scaffolding should use v4 by default now)
- `src/` directory structure
- `@/*` import alias

**Output:** Working Next.js skeleton that builds and starts with `bun run dev`.

---

### 0.2 — Initialize shadcn/ui
**Action:** Run shadcn init and add required components.

```bash
bunx shadcn@latest init
```

**Components to install:**
```bash
bunx shadcn@latest add button card dialog select tabs switch slider badge sonner dropdown-menu tooltip scroll-area input label separator popover
```

**Requirements:**
- `components.json` created at project root
- `@/components/ui/` populated with component source files
- `@/lib/utils.ts` created with `cn()` utility
- `globals.css` updated with shadcn CSS variables

---

### 0.3 — Migrate Theme System
**Action:** Port all 10 themes from `public/css/input.css` to `src/styles/globals.css`.

**Current themes:** dark (default), light, pink, blue, purple, green, red, teal, cyberpunk, ultra-black

**Approach:**
1. Keep `data-theme` attribute on `<html>` for theme switching
2. Each theme class defines:
   - Original `--color-main-50` through `--color-main-900` scale
   - shadcn semantic tokens mapped from the main scale:
     ```css
     [data-theme="cyberpunk"] {
       /* Existing scale */
       --color-main-50: #f0fdf4;
       /* ... */
       --color-main-900: #052e16;

       /* shadcn mappings */
       --background: var(--color-main-900);
       --foreground: var(--color-main-50);
       --card: var(--color-main-800);
       --card-foreground: var(--color-main-50);
       --primary: var(--color-main-500);
       --primary-foreground: var(--color-main-950);
       --secondary: var(--color-main-700);
       --secondary-foreground: var(--color-main-100);
       --muted: var(--color-main-800);
       --muted-foreground: var(--color-main-400);
       --accent: var(--color-main-700);
       --accent-foreground: var(--color-main-100);
       --border: var(--color-main-700);
       --input: var(--color-main-700);
       --ring: var(--color-main-500);
       --radius: 0.5rem;
     }
     ```
3. Create `ThemeProvider` component wrapping the app
4. Persist theme to `localStorage` (preserve current behavior)

**Files:**
- `src/styles/globals.css` — theme definitions
- `src/components/theme-provider.tsx` — client component for theme state
- `src/components/controls/theme-selector.tsx` — dropdown using shadcn Select

---

### 0.4 — Migrate Landing Page
**Action:** Convert `public/index.html` to `src/app/page.tsx`.

**Current functionality:**
- Two cards: "Host Control" (links to `/host`) and "View Feed" (links to `/viewer`)
- Theme selector
- Styled with Tailwind

**Requirements:**
- Server Component (no client-side JS needed beyond theme)
- Use shadcn Card components
- Use shadcn Button for navigation links
- Responsive layout

---

### 0.5 — Migrate Login Page
**Action:** Convert `public/login.html` to `src/app/login/page.tsx`.

**Current functionality:**
- Password input form
- POST to `/login`
- Error display via `?error=true` query param
- Link back to home

**Requirements:**
- Client Component (form handling)
- Use shadcn Input, Button, Card, Label
- Form submits to `/api/auth/login` (API route)
- Show error via Sonner toast or inline message
- Handle redirect after successful login

---

### 0.6 — Migrate Auth API Routes
**Action:** Convert Express auth routes to Next.js API routes.

**Current routes to migrate:**
| Express Route | Next.js API Route | Method |
|---|---|---|
| `POST /login` | `src/app/api/auth/login/route.ts` | POST |
| `GET /logout` | `src/app/api/auth/logout/route.ts` | POST |
| `GET /api/auth/status` | `src/app/api/auth/status/route.ts` | GET |

**Auth mechanism:**
- Use `cookies()` from `next/headers` for session management
- Compare password to `process.env.HOST_PASSWORD` (keep plaintext for now)
- Set a signed/encrypted cookie for auth state
- Middleware in `src/middleware.ts` to protect `/host` route

**Requirements:**
- `src/middleware.ts` — intercepts requests to `/host`, redirects to `/login` if not authenticated
- Auth cookie should be `httpOnly`, `sameSite: 'lax'`, `secure` in production
- No external auth library yet (keep it simple)

**Implementation detail:** Since we're not using a database or proper auth library, use a simple approach:
```typescript
// On successful login, set a signed cookie
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose'; // lightweight JWT

// Sign a token with SESSION_SECRET
const token = await new SignJWT({ authenticated: true })
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('24h')
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET));

cookies().set('auth-token', token, { httpOnly: true, sameSite: 'lax' });
```

---

### 0.7 — Migrate Host Page
**Action:** Convert `public/host.html` to `src/app/host/page.tsx`.

This is the most complex page. Break into components:

**Components needed:**
| Component | File | Type | Responsibility |
|---|---|---|---|
| HostPage | `src/app/host/page.tsx` | Client | Main page layout, orchestrates everything |
| CameraPreview | `src/components/video/camera-preview.tsx` | Client | `<video>` element showing own camera |
| CameraSelector | `src/components/controls/camera-selector.tsx` | Client | Dropdown to pick camera device |
| ShowSettings | `src/components/controls/show-settings.tsx` | Client | Show name input + update button |
| ThemeSelector | `src/components/controls/theme-selector.tsx` | Client | Global + local theme selectors |
| ConnectionStatus | `src/components/layout/connection-status.tsx` | Client | Green/red dot + text |
| LiveClock | `src/components/layout/live-clock.tsx` | Client | Current time display |
| StatsPanel | `src/components/video/stats-panel.tsx` | Client | FPS, resolution, quality display |

**Current host.html features to preserve:**
1. Camera enumeration and selection via `getUserMedia` + `enumerateDevices`
2. Video preview of selected camera
3. Show name editing (broadcasts to viewers)
4. Global theme control (broadcasts to viewers)
5. Local theme control (host-only)
6. Connection status indicator
7. Live clock
8. Stream stats (FPS, resolution, quality)
9. Logout button
10. Link to viewer mode
11. PeerJS peer creation + call handling (viewer connections)
12. Socket.IO connection for signaling

**Important:** In Phase 0, keep PeerJS and Socket.IO working as-is. The WebRTC rewrite happens in Phase 1, Socket.IO replacement in Phase 3. Phase 0 is a UI/structure migration only.

**Temporary approach for Phase 0:**
- Load PeerJS from CDN via `<Script>` tag (next/script)
- Connect to existing Socket.IO server (will be replaced in Phase 3)
- Wrap PeerJS logic in `useEffect` with proper cleanup

---

### 0.8 — Migrate Viewer Page
**Action:** Convert `public/viewer.html` to `src/app/viewer/page.tsx`.

**Components needed:**
| Component | File | Type | Responsibility |
|---|---|---|---|
| ViewerPage | `src/app/viewer/page.tsx` | Client | Main page layout |
| VideoPlayer | `src/components/video/video-player.tsx` | Client | `<video>` element for received stream |
| StatsPanel | `src/components/video/stats-panel.tsx` | Client | FPS, resolution, quality, latency |
| ChatPanel | `src/components/chat/chat-panel.tsx` | Client | Chat sidebar with messages |
| ChatMessage | `src/components/chat/chat-message.tsx` | Client | Individual chat message |
| ConnectionStatus | (shared) | Client | Reused from host |
| LiveClock | (shared) | Client | Reused from host |
| ThemeSelector | (shared) | Client | Local theme only |

**Current viewer.html features to preserve:**
1. Receive video stream from host via PeerJS
2. Display video fullscreen-capable
3. Chat sidebar (username + messages)
4. Theme selector (local, but receives global from host)
5. Connection status
6. Live clock
7. Stats panel (toggleable) — FPS, resolution, quality, latency
8. Auto-reconnect on connection loss
9. Fullscreen button
10. Stream info panel (show name, connection info)

**Same temporary approach:** Keep PeerJS + Socket.IO for Phase 0, replace later.

**Chat security fix:** Replace `innerHTML` with `textContent` for chat messages (XSS fix).

---

### 0.9 — Root Layout
**Action:** Create `src/app/layout.tsx` with shared providers and structure.

**Requirements:**
- ThemeProvider wrapping children
- Sonner `<Toaster />` for notifications
- Meta tags (title, description, viewport)
- Import `globals.css`
- Font setup (keep system fonts or add Inter)

---

### 0.10 — Remove Old Files
**Action:** After all pages are migrated and working, remove legacy files.

**Files to remove:**
- `server.js` (replaced by Next.js API routes + middleware)
- `public/index.html` (replaced by `src/app/page.tsx`)
- `public/login.html` (replaced by `src/app/login/page.tsx`)
- `public/host.html` (replaced by `src/app/host/page.tsx`)
- `public/viewer.html` (replaced by `src/app/viewer/page.tsx`)
- `public/js/theme.js` (replaced by ThemeProvider component)
- `public/css/input.css` (merged into `src/styles/globals.css`)
- `public/css/output.css` (Tailwind now built by Next.js)

**Dependencies to remove from package.json:**
- `express` — replaced by Next.js
- `express-session` — replaced by cookie-based auth
- `socket.io` — temporarily kept, removed in Phase 3
- `connect-flash` — never used properly
- `bcryptjs` — never used
- `node-webcam` — never used
- `install` — accidental dependency
- `peer` — PeerJS server, temporarily kept
- `nodemon` — not used (Bun --watch is used)
- `@tailwindcss/cli` — Next.js handles Tailwind building
- `@tailwindcss/postcss` — Next.js handles PostCSS

**Dependencies to add:**
- `next` — framework
- `react`, `react-dom` — UI library
- `jose` — lightweight JWT for auth cookies
- shadcn component deps (auto-installed: `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`)

---

### 0.11 — Temporary Socket.IO + PeerJS Compatibility Layer
**Action:** During Phase 0, the app still needs Socket.IO and PeerJS to function. Since we're removing `server.js`, we need a temporary solution.

**Options:**
1. **Keep `server.js` as a custom Next.js server** — Use Next.js custom server mode to mount Socket.IO and PeerJS alongside Next.js. This is temporary until Phase 3 (PartyKit) replaces Socket.IO and Phase 1 replaces PeerJS.
2. **Run Socket.IO + PeerJS as a separate process** — Keep a stripped-down `server.js` running alongside `next dev`.

**Recommended:** Option 1 — custom Next.js server. This keeps it as a single process and is the simplest to develop against. The custom server file (`server.ts`) would:
- Start Next.js
- Attach Socket.IO to the HTTP server
- Start PeerJS on port 9000
- Handle all Socket.IO events (copied from current `server.js`)

**File:** `server.ts` (root level, replaces `server.js`)

```typescript
// Temporary custom server — removed after Phase 3
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { PeerServer } from 'peer';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server);
  // ... Socket.IO event handlers from current server.js ...

  const peerServer = PeerServer({ port: 9000, path: '/peerjs' });

  server.listen(3000);
});
```

**package.json scripts update:**
```json
{
  "scripts": {
    "dev": "bun run server.ts",
    "build": "next build",
    "start": "NODE_ENV=production bun run server.ts"
  }
}
```

---

## Verification Checklist
After Phase 0 is complete, verify:

- [ ] `bun run dev` starts the app successfully
- [ ] Landing page renders at `/` with two cards
- [ ] Login page renders at `/login`
- [ ] Login with correct password redirects to `/host`
- [ ] Login with wrong password shows error
- [ ] `/host` is protected (redirects to `/login` if not authenticated)
- [ ] Host page shows camera preview with camera selector
- [ ] Host can update show name
- [ ] Host can change global theme (viewers receive it)
- [ ] Host can change local theme
- [ ] Viewer page renders at `/viewer`
- [ ] Viewer receives video stream from host
- [ ] Viewer can send/receive chat messages
- [ ] Theme selector works on all pages
- [ ] All 10 themes render correctly with shadcn components
- [ ] Stats panel shows on viewer (even if values are wrong — fixed in Phase 1)
- [ ] Fullscreen works on viewer
- [ ] Connection status indicator works
- [ ] Live clock works
- [ ] `bun run build` completes without errors
- [ ] No TypeScript errors

---

## Estimated Effort
- **Tasks:** 11
- **Complexity:** Medium-high (structural rewrite, no new logic)
- **Risk areas:** Custom server + Socket.IO compatibility, theme variable mapping, PeerJS in React lifecycle
