"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  sidebar?: ReactNode;
  topBarCenter?: ReactNode;
  topBarRight?: ReactNode;
}

export function AppShell({
  children,
  sidebar,
  topBarCenter,
  topBarRight,
}: AppShellProps) {
  return (
    <div className="flex h-screen flex-col bg-surface-0 text-foreground font-sans overflow-hidden">
      {/* Top App Bar */}
      <motion.header
        className="h-11 flex items-center justify-between px-4 bg-surface-1 border-b border-white/10 shrink-0 z-20"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground hover:text-gold transition-colors"
        >
          Stage Link
        </Link>

        {/* Center */}
        {topBarCenter && (
          <div className="flex items-center gap-3">{topBarCenter}</div>
        )}

        {/* Right */}
        {topBarRight && (
          <div className="flex items-center gap-2">{topBarRight}</div>
        )}
      </motion.header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content — no motion wrapper to avoid GPU layer issues with <video> */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Sidebar — right side */}
        {sidebar && (
          <motion.aside
            className="w-60 shrink-0 bg-surface-1 border-l border-white/10 flex flex-col overflow-y-auto"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
          >
            {sidebar}
          </motion.aside>
        )}
      </div>
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
    <div className={cn("px-3 py-3", className)}>
      {title && (
        <h3 className="px-1 mb-2 text-xs font-semibold text-white uppercase tracking-wider">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
