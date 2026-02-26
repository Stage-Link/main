"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth, useOrganization, UserButton } from "@clerk/nextjs";
import { useSubscription } from "@clerk/nextjs/experimental";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { hasStreamAccess, hasFullAccessBySlug } from "@/lib/billing/plans";
import {
  Monitor,
  Radio,
  Building2,
  Gift,
  Mail,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

export default function HomePage() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { organization, isLoaded: orgLoaded, membership } = useOrganization();
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription({
    for: "organization",
  });

  const ready = authLoaded && orgLoaded;
  const orgRole = membership?.role;
  const isAdmin = orgRole === "org:admin";
  const canHost = isAdmin || orgRole === "org:stage_manager";
  const showCreateOrJoinOrg = ready && isSignedIn && !organization;

  const hasFreeAccessBySlug = hasFullAccessBySlug(organization?.slug);
  const hasPlan = hasStreamAccess(subscription, organization?.slug);
  const showStreamActions =
    organization && (hasFreeAccessBySlug || (!subscriptionLoading && hasPlan));

  return (
    <div className="min-h-screen bg-surface-0 text-foreground flex flex-col relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-gold/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/4 w-[400px] h-[300px] rounded-full bg-crimson/[0.03] blur-[100px]" />
      </div>

      {/* Header */}
      {isSignedIn && (
        <header className="relative z-10 border-b border-white/[0.06] bg-surface-0/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-sm font-display font-semibold tracking-tight">
                <span className="h-2 w-2 shrink-0 rounded-full bg-gold animate-live-pulse" aria-hidden />
                Stage<span className="text-gold">Link</span>
              </span>
              <div className="h-4 w-px bg-white/10" />
              <OrganizationSwitcher
                hidePersonal
                afterSelectOrganizationUrl="/"
                afterCreateOrganizationUrl="/"
              />
            </div>
            <nav className="flex items-center gap-3">
              {isAdmin && (
                <Link
                  href="/org-settings"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <Settings className="h-3 w-3" />
                  Settings
                </Link>
              )}
              <UserButton afterSignOutUrl="/" />
            </nav>
          </div>
        </header>
      )}

      {/* Main content */}
      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-16">
        {!ready ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
          </div>
        ) : (
          <motion.div
            key={isSignedIn ? (organization ? "org" : "no-org") : "signed-out"}
            className="max-w-xl w-full text-center space-y-12"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {/* Brand */}
            <motion.div className="space-y-4" variants={fadeUp} transition={{ duration: 0.6 }}>
              <h1 className="text-5xl sm:text-6xl font-display-thin text-foreground">
                Stage<span className="text-gold">Link</span>
              </h1>
              <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">
                Real-time stage monitoring for theater crews.
                Low-latency video, private to your organization.
              </p>
            </motion.div>

            {/* State-dependent content */}
            {!isSignedIn ? (
              <motion.div className="space-y-8" variants={fadeUp} transition={{ duration: 0.5 }}>
                <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                  {[
                    { icon: Radio, label: "Low latency" },
                    { icon: Shield, label: "Private streams" },
                    { icon: Users, label: "Team access" },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card/50 border border-border"
                    >
                      <Icon className="h-4 w-4 text-gold/70" strokeWidth={1.5} />
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild size="lg" className="bg-gold text-primary-foreground hover:bg-gold-bright font-medium px-8">
                    <Link href="/sign-in">Sign in</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="border-white/10 hover:bg-surface-3">
                    <Link href="/sign-up">Create account</Link>
                  </Button>
                </div>
              </motion.div>
            ) : showCreateOrJoinOrg ? (
              <motion.div
                className="max-w-md mx-auto rounded-2xl bg-card border border-border p-8 space-y-6"
                variants={scaleIn}
                transition={{ duration: 0.4 }}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 mx-auto">
                  <Building2 className="h-5 w-5 text-gold" strokeWidth={1.5} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-display font-semibold text-foreground">
                    Create or join an organization
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Streams are private to each organization. Create one
                    for your crew, or check your email if you&apos;ve been invited.
                  </p>
                </div>
                <div className="space-y-3">
                  <Button asChild className="w-full bg-gold text-primary-foreground hover:bg-gold-bright gap-2">
                    <Link href="/org-select">
                      <Building2 className="h-4 w-4" />
                      Create organization
                    </Link>
                  </Button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>Have an invite? Use the link in your email.</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {organization && (
                  <motion.p
                    className="text-xs text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    Streaming as{" "}
                    <span className="text-foreground font-medium">
                      {organization.name}
                    </span>
                  </motion.p>
                )}

                {hasFreeAccessBySlug && (
                  <motion.div
                    className="flex justify-center"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Badge
                      variant="mode-gold"
                      className="text-xs font-semibold px-3 py-1.5 gap-1.5 shadow-[0_0_16px_rgba(201,162,39,0.25)]"
                    >
                      <Gift className="size-3.5" />
                      Free access from Christian Furr
                    </Badge>
                  </motion.div>
                )}

                {subscriptionLoading && !hasFreeAccessBySlug ? (
                  <div className="flex justify-center py-8">
                    <div className="h-5 w-5 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                  </div>
                ) : showStreamActions ? (
                  <motion.div
                    className={`grid gap-4 ${canHost ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 max-w-xs mx-auto"}`}
                    initial="hidden"
                    animate="visible"
                    variants={stagger}
                  >
                    {canHost && (
                      <motion.div variants={scaleIn} transition={{ duration: 0.35 }}>
                        <Link href="/host" className="group block">
                          <div className="relative rounded-2xl border border-border bg-card p-6 text-center space-y-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/30 hover:bg-surface-3 group-hover:shadow-[0_0_50px_rgba(201,162,39,0.1)]">
                            <div className="mx-auto w-12 h-12 rounded-xl bg-gold/15 border border-gold/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                              <Radio className="h-5 w-5 text-gold" strokeWidth={1.5} />
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-base font-semibold text-foreground">
                                Host Control
                              </h3>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                Start streaming, manage cameras, and control show settings
                              </p>
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gold/80 font-medium uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-pulse" />
                              Broadcast
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    )}

                    <motion.div variants={scaleIn} transition={{ duration: 0.35 }}>
                      <Link href="/viewer" className="group block">
                        <div className="relative rounded-2xl border border-border bg-card p-6 text-center space-y-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-crimson/30 hover:bg-surface-3 group-hover:shadow-[0_0_50px_rgba(183,28,46,0.1)]">
                          <div className="mx-auto w-12 h-12 rounded-xl bg-crimson/15 border border-crimson/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                            <Monitor className="h-5 w-5 text-crimson" strokeWidth={1.5} />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-base font-semibold text-foreground">
                              View Feed
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Watch the live stage feed with your crew in real-time
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-1.5 text-[10px] text-crimson/80 font-medium uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-crimson/60" />
                            Watch
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  </motion.div>
                ) : organization ? (
                  <motion.div
                    className="max-w-md mx-auto rounded-2xl bg-card border border-border p-8 space-y-6"
                    initial="hidden"
                    animate="visible"
                    variants={scaleIn}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="space-y-2 text-center">
                      <h2 className="text-lg font-display font-semibold text-foreground">
                        A plan is required to stream
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Subscribe to Crew, Production, or Showtime to host or view streams.
                      </p>
                    </div>
                    <Button asChild className="w-full bg-gold text-primary-foreground hover:bg-gold-bright">
                      <Link href="/pricing">View plans</Link>
                    </Button>
                  </motion.div>
                ) : null}
              </div>
            )}

            {/* Footer */}
            <motion.footer
              className="text-muted-foreground/50 text-[11px] tracking-wide"
              variants={fadeUp}
              transition={{ duration: 0.4 }}
            >
              StageLink &middot; Christian Furr
            </motion.footer>
          </motion.div>
        )}
      </div>
    </div>
  );
}
