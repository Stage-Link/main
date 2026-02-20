"use client";

import { useOrganization, UserButton } from "@clerk/nextjs";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
      <header className="border-b border-white/6 px-4 py-3 flex items-center justify-end">
        <UserButton afterSignOutUrl="/" />
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-2xl font-display font-semibold text-gold">
            Select organization
          </h1>
          <p className="text-muted-foreground text-sm">
            Choose an organization to continue, or create one.
          </p>
          <div className="flex justify-center [&_.cl-organizationSwitcherTrigger]:bg-surface-2 [&_.cl-organizationSwitcherTrigger]:border [&_.cl-organizationSwitcherTrigger]:border-white/10">
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
