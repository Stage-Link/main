"use client";

import { type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface AppShellProps {
  children: ReactNode;
  sidebar?: ReactNode;
  topBarCenter?: ReactNode;
  topBarRight?: ReactNode;
  /** Condensed center content for mobile top bar (e.g. connection status + mode badge). Shown only below md when sidebar exists. */
  mobileTopBarCenter?: ReactNode;
}

export function AppShell({
  children,
  sidebar,
  topBarCenter,
  topBarRight,
  mobileTopBarCenter,
}: AppShellProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] flex-col bg-surface-0 text-foreground font-sans overflow-hidden">
      {/* Top App Bar */}
      <motion.header
        className="h-11 flex items-center justify-between px-3 md:px-4 bg-surface-1 border-b border-white/10 shrink-0 z-20"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-display font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity shrink-0"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-gold animate-live-pulse" aria-hidden />
          Stage<span className="text-gold">Link</span>
        </Link>

        {/* Center — desktop only, or mobile condensed when provided */}
        {mobileTopBarCenter != null && (
          <div className="flex md:hidden flex-1 justify-center items-center gap-2 min-w-0 px-2">
            {mobileTopBarCenter}
          </div>
        )}
        {topBarCenter && (
          <div className="hidden md:flex items-center gap-3 flex-1 justify-center">{topBarCenter}</div>
        )}

        {/* Right — desktop: full; mobile: drawer toggle when sidebar exists */}
        <div className="flex items-center gap-2 shrink-0">
          {sidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open menu"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          )}
          {topBarRight && (
            <div className="hidden md:flex items-center gap-2">
              {topBarRight}
            </div>
          )}
        </div>
      </motion.header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content — no motion wrapper to avoid GPU layer issues with <video> */}
        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>

        {/* Sidebar — inline on desktop only */}
        {sidebar && (
          <motion.aside
            className="hidden md:flex w-60 lg:w-72 shrink-0 min-h-0 bg-surface-1 border-l border-white/10 flex-col"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
          >
            <div className="flex flex-col flex-1 min-h-0 py-4 gap-3 overflow-y-auto [scrollbar-gutter:stable]">
              {sidebar}
            </div>
          </motion.aside>
        )}
      </div>

      {/* Mobile drawer — same sidebar content */}
      {sidebar && (
        <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <SheetContent
            side="right"
            className="w-[280px] max-w-[85vw] sm:max-w-[280px] bg-surface-1 border-white/10 p-0 gap-0 flex flex-col"
            showCloseButton={true}
          >
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
              {sidebar}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

/* Reusable sidebar section */
export function SidebarSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-3 py-3 md:py-4 md:px-4", className)}>
      {title && (
        <h3 className="px-1 mb-2 text-xs font-semibold text-foreground uppercase tracking-wider">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
