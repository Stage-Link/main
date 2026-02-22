---
name: ""
overview: ""
todos: []
isProject: false
---

# Slug-based free full access — implementation plan

Two organization slugs get full access (Showtime-level) without Clerk billing. Allowlist is in code; access and UI are consistent everywhere.

---

## 1. Allowlist and helpers (`[src/lib/billing/plans.ts](src/lib/billing/plans.ts)`)

**Add:**

- **Constant:** `FULL_ACCESS_ORG_SLUGS = new Set(["tyler-s-organization-1771801460", "christian-s-organization-1771625615"])`.
- `**hasFullAccessBySlug(orgSlug: string | null | undefined): boolean`**
  - Return `false` if `orgSlug == null` or `typeof orgSlug !== "string"`.
  - Else return `FULL_ACCESS_ORG_SLUGS.has(orgSlug)`.
  - Ensures no access when slug is missing or invalid.
- `**hasStreamAccess(subscription: unknown, orgSlug: string | null | undefined): boolean**`
  - Return `isPaidSubscription(subscription) || hasFullAccessBySlug(orgSlug)`.
  - Single condition used everywhere for “has plan / can stream”.
- `**getEffectiveViewerCap(sub: unknown, orgSlug: string | null | undefined): number**`
  - If `hasFullAccessBySlug(orgSlug)` return `200` (Showtime cap).
  - Else return `getViewerCap(sub)`.
- `**getEffectiveOrgTier(sub: unknown, orgSlug: string | null | undefined): "crew" | "production" | "showtime"**`
  - If `hasFullAccessBySlug(orgSlug)` return `"showtime"`.
  - Else return `getOrgTier(sub)`.

Export all four. Keep existing `isPaidSubscription`, `getViewerCap`, `getOrgTier` unchanged.

---

## 2. Home page (`[src/app/page.tsx](src/app/page.tsx)`)

**Imports:** Add `hasStreamAccess`, `hasFullAccessBySlug` from `@/lib/billing/plans`.

**Logic:**

- `hasPlan = hasStreamAccess(subscription, organization?.slug)`.
- **Best UX:** `showStreamActions = organization && (hasPlan && !subscriptionLoading || hasFullAccessBySlug(organization?.slug))`  
So allowlisted orgs see Host/View Feed as soon as org is loaded; others still wait for subscription.
- `hasFreeAccessBySlug = hasFullAccessBySlug(organization?.slug)` for the attribution line.

**UI:**

- In the block where you show “Streaming as {organization.name}” (inside `{organization && (...)}`), after that paragraph add:
  - When `hasFreeAccessBySlug`: a second line, e.g.  
  `Free access from Christian Furr`  
  with subtle styling: `text-[11px] text-muted-foreground` (optionally with same motion as the paragraph).
- Only allowlisted orgs see this; paid users do not.

---

## 3. Viewer page (`[src/app/viewer/page.tsx](src/app/viewer/page.tsx)`)

**Imports:** Add `hasStreamAccess`, `hasFullAccessBySlug` from `@/lib/billing/plans`.

**Loading:**

- When `subscriptionLoading` and `!hasFullAccessBySlug(organization?.slug)`: show “Loading plan…” (current behavior).
- When `subscriptionLoading` and `hasFullAccessBySlug(organization?.slug)`: show “Loading…” and then allow through (no need to wait for subscription). So allowlisted users don’t see “Loading plan…” and get in faster.

**Access gate:**

- Replace `if (!subscription || !isPaidSubscription(subscription))` with  
`if (!hasStreamAccess(subscription, organization?.slug))`  
and keep the same “A plan is required” block. So allowlisted orgs pass without a Clerk subscription.

---

## 4. Host page (`[src/app/host/page.tsx](src/app/host/page.tsx)`)

**Imports:** Replace `isPaidSubscription, getViewerCap, getOrgTier` with  
`hasStreamAccess, getEffectiveViewerCap, getEffectiveOrgTier` from `@/lib/billing/plans`.

**Logic:**

- `maxViewers = getEffectiveViewerCap(subscription, organization?.slug)`.
- `orgTier = getEffectiveOrgTier(subscription, organization?.slug)` (keep type `OrgTier`).
- **Loading:** If `subscriptionLoading` and `!hasFullAccessBySlug(organization?.slug)` show “Loading plan…”; if allowlisted, show “Loading…” and then allow through (same pattern as viewer).
- **Paywall:** Replace `if (!subscription || !isPaidSubscription(subscription))` with  
`if (!hasStreamAccess(subscription, organization?.slug))`  
and keep the same “A plan is required to host” block.

---

## 5. Optional copy tweaks (best working)

- **Viewer/Host loading:** When `hasFullAccessBySlug(organization?.slug)` use “Loading…” instead of “Loading plan…” so allowlisted users aren’t told they need a plan.
- **Stream limit:** If you later show “Upgrade your plan” / “View plans” when at stream limit, hide or reword that for allowlisted orgs (e.g. “Stream limit reached” only), since they can’t upgrade. Low priority if those two orgs rarely hit the cap.

---

## 6. SFU / HD (out of scope for this plan)

Allowlisted orgs get **Showtime limits and tier** (e.g. 200 viewers, showtime in lobby). SFU and HD are still gated by Clerk features (`sfu_access`, `hd_video`). So by default allowlisted orgs use P2P and 720p. To give them SFU/HD later you can either grant those features in Clerk for those orgs or add a server-side allowlist in the SFU/HD API routes. No change in this plan.

---

## 7. Implementation order

1. `**[src/lib/billing/plans.ts](src/lib/billing/plans.ts)`** — Add allowlist, `hasFullAccessBySlug`, `hasStreamAccess`, `getEffectiveViewerCap`, `getEffectiveOrgTier`. Strict slug guard in `hasFullAccessBySlug`.
2. `**[src/app/page.tsx](src/app/page.tsx)**` — Use `hasStreamAccess` and `hasFullAccessBySlug`; optional faster `showStreamActions` for allowlisted; add “Free access from Christian Furr” under “Streaming as {org name}”.
3. `**[src/app/viewer/page.tsx](src/app/viewer/page.tsx)**` — Use `hasStreamAccess` for gate; optional “Loading…” when allowlisted during subscription load.
4. `**[src/app/host/page.tsx](src/app/host/page.tsx)**` — Use `getEffectiveViewerCap`, `getEffectiveOrgTier`, `hasStreamAccess`; same loading and paywall logic as above.

---

## 8. Checklist


| File                       | Change                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/billing/plans.ts` | `FULL_ACCESS_ORG_SLUGS`, `hasFullAccessBySlug` (with null/type guard), `hasStreamAccess`, `getEffectiveViewerCap`, `getEffectiveOrgTier`; export all. |
| `src/app/page.tsx`         | `hasPlan`/`showStreamActions` via `hasStreamAccess`/`hasFullAccessBySlug`; “Free access from Christian Furr” when `hasFreeAccessBySlug`.              |
| `src/app/viewer/page.tsx`  | Gate on `hasStreamAccess(subscription, organization?.slug)`; optional “Loading…” when allowlisted.                                                    |
| `src/app/host/page.tsx`    | `maxViewers`/`orgTier` from effective helpers; paywall and loading use `hasStreamAccess`/`hasFullAccessBySlug`.                                       |


No API route changes. No Figma; copy and placement as above give the best working behavior and clear attribution for free access from Christian Furr.