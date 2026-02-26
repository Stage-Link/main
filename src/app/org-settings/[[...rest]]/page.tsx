"use client";

import { OrganizationProfile } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard } from "lucide-react";

export default function OrgSettingsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="border-white/10 gap-2">
          <Link href="/pricing">
            <CreditCard className="h-4 w-4" />
            Billing & plans
          </Link>
        </Button>
      </header>
      <div className="flex justify-center py-8 [&_.cl-rootBox]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border [&_.cl-card]:border-white/10 [&_.cl-card]:bg-[#161412]">
        <OrganizationProfile
          afterLeaveOrganizationUrl="/"
          appearance={{
            baseTheme: dark,
            variables: {
              colorBackground: "#0C0A09",
              colorInputBackground: "#1A1614",
              colorInputText: "#F5F0E8",
              colorText: "#F5F0E8",
              colorTextSecondary: "#A89B8C",
              colorPrimary: "#C9A227",
              borderRadius: "0.75rem",
            },
            elements: {
              rootBox: "w-full max-w-4xl mx-auto",
              card: "bg-[#161412] border border-white/10 shadow-none",
              navbarButton: "text-[#F5F0E8]",
              headerTitle: "text-[#F5F0E8]",
              headerSubtitle: "text-[#A89B8C]",
              formFieldLabel: "text-[#F5F0E8]",
              formFieldInput: "bg-[#1A1614] border-white/10 text-[#F5F0E8]",
              tableHead: "text-[#A89B8C]",
              tableCell: "text-[#F5F0E8]",
              badge: "bg-[#221E1A] text-[#F5F0E8] border-white/10",
              button: "bg-[#C9A227] text-[#0C0A09]",
              footerActionLink: "text-[#C9A227]",
            },
          }}
        />
      </div>
    </div>
  );
}
