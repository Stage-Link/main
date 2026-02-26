---
name: Main app UI cleanup and design alignment
overview: Align Stage Link main app with DESIGN_GUIDE (warm dark palette, typography, surfaces), polish UI, then commit and push to both remotes.
todos:
  - id: phase-1-tokens
    content: Update globals.css and layout.tsx Clerk to DESIGN_GUIDE tokens (warm surfaces, foreground, muted)
    status: pending
  - id: phase-2-typography
    content: Add .font-display-thin and typography scale in globals.css
    status: pending
  - id: phase-3-shell
    content: App shell + consistent logo; top bar height and sidebar styling
    status: pending
  - id: phase-4-video
    content: CameraPreview/VideoPlayer gradient and controls; StatsPanel alignment
    status: pending
  - id: phase-5-chat
    content: ChatPanel message style and optional role label per DESIGN_GUIDE
    status: pending
  - id: phase-6-dialogs
    content: Dialog and Input surfaces (card/popover, focus ring)
    status: pending
  - id: phase-7-pricing
    content: "Pricing page: Save 15%, popular card glow, toggle and card styling"
    status: pending
  - id: phase-8-home
    content: "Home page: display thin title, card hovers, warm cards"
    status: pending
  - id: phase-9-buttons
    content: Verify Button/Badge and ConnectionStatus/Tabs; loading states
    status: pending
  - id: phase-10-clerk
    content: Clerk appearance warm surfaces; remove hardcoded hex where possible
    status: pending
  - id: phase-11-commit-push
    content: Commit all changes in main directory and push to both remotes (origin and stagelink)
    status: pending
isProject: false
---

# Main app UI cleanup and design alignment

Align the Stage Link main app (`/Users/christianfurr/Desktop/Code/main`) with the DESIGN_GUIDE (warm dark palette, typography, surfaces) from the homepage project, clean up the UI, then **commit and push to both remotes**.

---

## Phases 1–10 (implementation)

- **Phase 1**: Design tokens in `globals.css` (warm `#0C0A09`, `#F5F0E8`, `#A89B8C`, surface scale `#121010`–`#2A2520`) and Clerk `appearance` in `layout.tsx`.
- **Phase 2**: Typography: `.font-display-thin`, body/small/badge scale.
- **Phase 3**: App shell top bar (~44px), sidebar `surface-1`/borders, consistent logo (Stage + Link gold).
- **Phase 4**: Video container gradient `#1a0808`, `#200e0e`, `#0f0505`; LIVE badge; camera controls bar; StatsPanel key-value + graph.
- **Phase 5**: ChatPanel name/role/body colors and 11px; optional "(Role)" and "X crew online".
- **Phase 6**: Dialog `bg-card`/popover, border white/10; Input focus ring gold.
- **Phase 7**: Pricing billing toggle, "Save 15%" on annual, most-popular card glow.
- **Phase 8**: Home page display thin title, card hovers, warm cards.
- **Phase 9**: Button/Badge/ConnectionStatus/Tabs; loading copy.
- **Phase 10**: Clerk warm surfaces; replace hardcoded hex with tokens.

---

## Phase 11: Commit and push (required after completion)

Once all implementation phases are done:

1. **Commit** all changes in the **main app directory** (`/Users/christianfurr/Desktop/Code/main`):
  - `git add -A`
  - `git status` (review)
  - `git commit -m "UI: align with DESIGN_GUIDE, warm dark palette and polish"` (or equivalent message)
2. **Push to both remotes**:
  - `git push origin <branch>`  (e.g. `master` or current branch)
  - `git push stagelink <branch>`

Remotes in main repo:

- **origin**: `https://github.com/Stage-Link/main.git`
- **stagelink**: `https://github.com/christianfurr/stagelink-main.git`

Ensure the same branch is pushed to both so both remotes are in sync after the UI work.