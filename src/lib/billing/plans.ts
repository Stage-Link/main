const FREE_PLAN_SLUGS = new Set(["free", "free_org"]);

const PLAN_ID_CREW = process.env.NEXT_PUBLIC_PLAN_ID_CREW;
const PLAN_ID_PRODUCTION = process.env.NEXT_PUBLIC_PLAN_ID_PRODUCTION;
const PLAN_ID_SHOWTIME = process.env.NEXT_PUBLIC_PLAN_ID_SHOWTIME;

const PAID_PLAN_IDS = new Set<string>();
if (PLAN_ID_CREW) PAID_PLAN_IDS.add(PLAN_ID_CREW);
if (PLAN_ID_PRODUCTION) PAID_PLAN_IDS.add(PLAN_ID_PRODUCTION);
if (PLAN_ID_SHOWTIME) PAID_PLAN_IDS.add(PLAN_ID_SHOWTIME);

const VIEWER_CAP: Record<string, number> = {};
if (PLAN_ID_CREW) VIEWER_CAP[PLAN_ID_CREW] = 5;
if (PLAN_ID_PRODUCTION) VIEWER_CAP[PLAN_ID_PRODUCTION] = 50;
if (PLAN_ID_SHOWTIME) VIEWER_CAP[PLAN_ID_SHOWTIME] = 200;

export const DEFAULT_VIEWER_CAP = 5;

interface SubscriptionPlan {
  id?: string;
  slug?: string;
  name?: string;
}

interface SubscriptionItem {
  plan?: SubscriptionPlan;
  planId?: string;
}

interface Subscription {
  subscriptionItems?: SubscriptionItem[];
  planId?: string;
  status?: string;
}

/** Extract the first plan from a Clerk subscription object (handles nested shape). */
function extractPlan(sub: unknown): SubscriptionPlan | undefined {
  const s = sub as Subscription | undefined;
  if (!s) return undefined;
  const items = s.subscriptionItems;
  if (Array.isArray(items) && items.length > 0) {
    return items[0].plan ?? undefined;
  }
  return undefined;
}

/** Extract planId from subscription — tries subscriptionItems[0].plan.id, then subscriptionItems[0].planId, then top-level planId. */
export function extractPlanId(sub: unknown): string | undefined {
  const s = sub as Subscription | undefined;
  if (!s) return undefined;
  const items = s.subscriptionItems;
  if (Array.isArray(items) && items.length > 0) {
    const item = items[0];
    if (item.plan?.id) return item.plan.id;
    if (item.planId) return item.planId;
  }
  if (typeof s.planId === "string") return s.planId;
  return undefined;
}

/** Extract plan slug from subscription. */
export function extractPlanSlug(sub: unknown): string | undefined {
  return extractPlan(sub)?.slug;
}

const PAID_SLUGS = new Set(["crew", "production", "showtime"]);

/** True only if the subscription is on a known paid plan. Defaults to false for safety. */
export function isPaidSubscription(sub: unknown): boolean {
  if (!sub) return false;

  const slug = extractPlanSlug(sub);
  if (slug) {
    if (FREE_PLAN_SLUGS.has(slug)) return false;
    if (PAID_SLUGS.has(slug)) return true;
    return false;
  }

  const planId = extractPlanId(sub);
  if (planId && PAID_PLAN_IDS.has(planId)) return true;

  return false;
}

export function getViewerCap(sub: unknown): number {
  const planId = extractPlanId(sub);
  if (planId && planId in VIEWER_CAP) return VIEWER_CAP[planId];
  return DEFAULT_VIEWER_CAP;
}

const PLAN_TIER: Record<string, "crew" | "production" | "showtime"> = {};
if (PLAN_ID_CREW) PLAN_TIER[PLAN_ID_CREW] = "crew";
if (PLAN_ID_PRODUCTION) PLAN_TIER[PLAN_ID_PRODUCTION] = "production";
if (PLAN_ID_SHOWTIME) PLAN_TIER[PLAN_ID_SHOWTIME] = "showtime";

const SLUG_TO_TIER: Record<string, "crew" | "production" | "showtime"> = {
  crew: "crew",
  production: "production",
  showtime: "showtime",
};

export function getOrgTier(sub: unknown): "crew" | "production" | "showtime" {
  const planId = extractPlanId(sub);
  if (planId && planId in PLAN_TIER) return PLAN_TIER[planId];
  const slug = extractPlanSlug(sub);
  if (slug && slug in SLUG_TO_TIER) return SLUG_TO_TIER[slug];
  return "crew";
}

// ─── Slug-based full access allowlist ────────────────────────────

const FULL_ACCESS_ORG_SLUGS = new Set([
  "tyler-s-organization-1771801460",
  "christian-s-organization-1771625615",
]);

export function hasFullAccessBySlug(
  orgSlug: string | null | undefined,
): boolean {
  if (orgSlug == null || typeof orgSlug !== "string") return false;
  return FULL_ACCESS_ORG_SLUGS.has(orgSlug);
}

export function hasStreamAccess(
  subscription: unknown,
  orgSlug: string | null | undefined,
): boolean {
  return isPaidSubscription(subscription) || hasFullAccessBySlug(orgSlug);
}

export function getEffectiveViewerCap(
  sub: unknown,
  orgSlug: string | null | undefined,
): number {
  if (hasFullAccessBySlug(orgSlug)) return 200;
  return getViewerCap(sub);
}

export function getEffectiveOrgTier(
  sub: unknown,
  orgSlug: string | null | undefined,
): "crew" | "production" | "showtime" {
  if (hasFullAccessBySlug(orgSlug)) return "showtime";
  return getOrgTier(sub);
}
