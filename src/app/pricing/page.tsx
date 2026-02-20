"use client";

import { useState } from "react";
import { CheckoutButton, usePlans } from "@clerk/nextjs/experimental";
import { useOrganization, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";

type BillingPeriod = "month" | "annual";

const PLANS = [
  {
    key: "crew",
    name: "Crew",
    tagline: "For small crews getting started with live stage monitoring.",
    priceMonth: 12,
    priceAnnual: 120,
    features: [
      "P2P Direct streaming",
      "Up to 5 viewers",
      "720p video quality",
      "Live crew chat",
      "3 color themes",
      "Unlimited shows",
    ],
    hasTrial: true,
    trialCopy: "14-day free trial · No credit card required",
    mostPopular: false,
  },
  {
    key: "production",
    name: "Production",
    tagline: "For production teams that need scale and reliability.",
    priceMonth: 39,
    priceAnnual: 396,
    features: [
      "Cloudflare SFU streaming",
      "Up to 50 viewers",
      "1080p video quality",
      "Live crew chat",
      "All 10 themes",
      "Internet streaming + TURN relay",
      "Email support",
    ],
    hasTrial: false,
    mostPopular: true,
  },
  {
    key: "showtime",
    name: "Showtime",
    tagline: "For large venues and professional productions.",
    priceMonth: 99,
    priceAnnual: 1008,
    features: [
      "Cloudflare SFU streaming",
      "Up to 200 viewers",
      "1080p video quality",
      "Live crew chat + talkback",
      "All 10 themes + custom branding",
      "Internet streaming + TURN relay",
      "Priority support + dedicated account manager",
    ],
    hasTrial: false,
    mostPopular: false,
  },
] as const;

const ENV_PLAN_IDS = {
  crew: process.env.NEXT_PUBLIC_PLAN_ID_CREW,
  production: process.env.NEXT_PUBLIC_PLAN_ID_PRODUCTION,
  showtime: process.env.NEXT_PUBLIC_PLAN_ID_SHOWTIME,
} as const;

function matchPlanIdFromPlans(
  plans: { id: string; name?: string }[],
  planName: string
): string | undefined {
  const normalized = planName.toLowerCase().trim();
  const found = plans.find(
    (p) => p.name?.toLowerCase().trim() === normalized
  );
  return found?.id;
}

export default function PricingPage() {
  const router = useRouter();
  const { organization, isLoaded } = useOrganization();
  const { has } = useAuth();
  const { data: plansData } = usePlans({ for: "organization", pageSize: 10 });
  const plans = plansData ?? [];
  const isAdmin = has?.({ role: "org:admin" }) ?? false;
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("month");

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!organization) {
    router.replace("/org-select");
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center text-muted-foreground text-sm">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 text-foreground">
      <header className="border-b border-white/10 px-4 py-3 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-semibold text-foreground">
            Plans for <span className="text-gold">{organization.name}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Only Crew includes a 14-day free trial. Org admins can change plans.
          </p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-lg border border-white/10 bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setBillingPeriod("month")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                billingPeriod === "month"
                  ? "bg-gold text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("annual")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                billingPeriod === "annual"
                  ? "bg-gold text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annually
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const planId =
              ENV_PLAN_IDS[plan.key] ??
              matchPlanIdFromPlans(plans, plan.name);
            const canCheckout = isAdmin && planId;
            const price =
              billingPeriod === "annual" ? plan.priceAnnual : plan.priceMonth;
            const priceLabel =
              billingPeriod === "annual" ? `/yr` : `/mo`;

            const cardClassName = `relative rounded-2xl border bg-surface-2 p-6 flex flex-col text-left ${
              plan.mostPopular
                ? "border-gold/50 ring-1 ring-gold/20"
                : "border-white/10"
            }`;

            return (
              <div key={plan.key} className={cardClassName}>
                {plan.mostPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-black">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <h2 className="text-xl font-display font-semibold text-foreground">
                  {plan.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.tagline}
                </p>

                <div className="mt-6 flex items-baseline gap-0.5">
                  <span className="text-3xl font-semibold text-gold">
                    ${price}
                  </span>
                  <span className="text-muted-foreground text-sm">{priceLabel}</span>
                </div>

                <ul className="mt-6 space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <Check className="h-4 w-4 shrink-0 text-gold mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 space-y-3">
                  {canCheckout && planId ? (
                    <CheckoutButton
                      planId={planId}
                      planPeriod={billingPeriod}
                      for="organization"
                      onSubscriptionComplete={() => router.push("/host")}
                      newSubscriptionRedirectUrl="/host"
                    >
                      <Button className="w-full bg-gold text-black hover:bg-gold-bright">
                        {plan.hasTrial
                          ? "Start Free Trial"
                          : billingPeriod === "annual"
                            ? "Subscribe annually"
                            : "Subscribe"}
                      </Button>
                    </CheckoutButton>
                  ) : !isAdmin ? (
                    <p className="text-xs text-muted-foreground text-center">
                      Ask an org admin to change the plan.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">
                      Plan not found. Create Crew, Production, and Showtime in
                      Clerk Dashboard → Billing → Plans.
                    </p>
                  )}
                  {plan.hasTrial && plan.trialCopy && (
                    <p className="text-xs text-muted-foreground text-center">
                      {plan.trialCopy}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
