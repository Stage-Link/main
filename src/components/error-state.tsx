"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  showGoHome?: boolean;
}

export function ErrorState({
  title,
  description,
  onRetry,
  showGoHome = true,
}: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4 max-w-md mx-auto">
      <h2 className="text-lg font-display font-semibold text-foreground">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button
            variant="outline"
            className="border-white/10 hover:bg-surface-3"
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
        {showGoHome && (
          <Button asChild className="bg-gold text-primary-foreground hover:bg-gold-bright">
            <Link href="/">Go home</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
