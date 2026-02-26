"use client";

import { useOrganization, UserButton } from "@clerk/nextjs";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function OrgSelectPage() {
  const { organization, isLoaded } = useOrganization();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (organization) {
      router.replace("/");
    }
  }, [organization, isLoaded, router]);

  return (
    <div className="min-h-screen bg-surface-0 text-foreground flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-display font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-gold animate-live-pulse" aria-hidden />
          Stage<span className="text-gold">Link</span>
        </Link>
        <UserButton afterSignOutUrl="/" />
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-3xl font-display-thin text-foreground">
            Select your <span className="text-gold">organization</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Choose an organization to continue, or create one.
          </p>
          <div className="flex justify-center [&_.cl-organizationSwitcherTrigger]:bg-surface-2 [&_.cl-organizationSwitcherTrigger]:border [&_.cl-organizationSwitcherTrigger]:border-border">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/"
              afterCreateOrganizationUrl="/"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
