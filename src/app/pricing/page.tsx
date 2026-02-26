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
    <div
      className="min-h-screen bg-surface-0 text-foreground"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0 L4 4 M36 0 L40 4 M0 36 L4 40 M36 36 L40 40 M20 0 L24 4 M20 36 L24 40 M0 20 L4 24 M36 20 L40 24' stroke='%23C9A227' stroke-width='0.5' opacity='0.06' fill='none'/%3E%3C/svg%3E")`,
      }}
    >
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
          <div className="inline-flex rounded-xl border border-gold/30 bg-surface-1 p-1">
            <button
              type="button"
              onClick={() => setBillingPeriod("month")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                billingPeriod === "month"
                  ? "bg-gold/15 text-gold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("annual")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                billingPeriod === "annual"
                  ? "bg-gold/15 text-gold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="ml-1.5 text-[10px] text-crimson font-semibold">Save 15%</span>
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

            const cardClassName = `relative rounded-2xl border-2 p-8 flex flex-col text-left transition-colors ${
              plan.mostPopular
                ? "border-gold bg-card shadow-[0_0_40px_rgba(201,162,39,0.15)] scale-[1.02] lg:scale-105"
                : "border-border bg-card hover:border-gold/40"
            }`;

            return (
              <div key={plan.key} className={cardClassName}>
                {plan.mostPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="rounded-full bg-gold/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold">
                      Most Popular
                    </span>
                  </div>
                )}

                <h2 className="text-xl font-display font-semibold text-foreground">
                  {plan.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.tagline}
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground">
                    ${price}
                  </span>
                  <span className="text-muted-foreground text-sm">{priceLabel}</span>
                  {billingPeriod === "annual" && (
                    <span className="ml-2 text-xs text-muted-foreground">billed annually</span>
                  )}
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
                      onSubscriptionComplete={() => router.push("/")}
                      newSubscriptionRedirectUrl="/"
                    >
                      <Button className="w-full bg-gold text-primary-foreground hover:bg-gold-bright">
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
