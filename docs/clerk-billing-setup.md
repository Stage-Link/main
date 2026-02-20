# Clerk Billing Setup (Manual)

Complete these steps in the Clerk Dashboard before using the pricing page and plan-gated features.

1. **Navigate to Subscription Plans**  
   [dashboard.clerk.com → Billing → Plans](https://dashboard.clerk.com/~/billing/plans)

2. **Connect Stripe**  
   Use a Stripe test account for development; use a separate Stripe account for production.

3. **Create three plans**

   | Plan        | Price   | Notes                    |
   |------------|---------|---------------------------|
   | Crew       | $12/mo  | P2P, 5 viewers, 720p     |
   | Production | $39/mo  | SFU, 50 viewers, 1080p, TURN |
   | Showtime   | $99/mo  | SFU, 200 viewers, 1080p, TURN |

4. **Create Features** (Billing → Features)  
   - `sfu_access` — enables SFU streaming (Production, Showtime)  
   - `turn_relay` — enables TURN relay (Production, Showtime)  
   - `hd_video` — enables 1080p (Production, Showtime)

5. **Assign features to plans**  
   - Crew: no features  
   - Production: `sfu_access`, `turn_relay`, `hd_video`  
   - Showtime: `sfu_access`, `turn_relay`, `hd_video`

6. **Wire plan IDs for viewer caps (optional)**  
   After creating plans, copy `.env.example` to `.env.local` or set these so the host sends the correct viewer cap to PartyKit:

   | Plan        | Env var                          | Plan ID (example)              | Viewers |
   |-------------|-----------------------------------|--------------------------------|--------|
   | Crew        | `NEXT_PUBLIC_PLAN_ID_CREW`        | `cplan_39umSy5XUCkLwD6zjWAJs5ny0X8` | 5      |
   | Production  | `NEXT_PUBLIC_PLAN_ID_PRODUCTION`  | `cplan_39umfn1I31nb4x0gkCetn40nPhE`  | 50     |
   | Showtime    | `NEXT_PUBLIC_PLAN_ID_SHOWTIME`    | `cplan_39umjADpVjWC1hYCQQ20OZHhZ5L`  | 200    |

   If unset, the app still recognizes paid plans by name (Crew/Production/Showtime) and defaults to 5 viewers per stream.

Viewer caps are enforced in the PartyKit signaling server; the host sends `maxViewers` in the `host-ready` message from the org’s subscription plan.
