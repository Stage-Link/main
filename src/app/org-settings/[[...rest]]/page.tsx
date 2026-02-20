"use client";

import { OrganizationProfile } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard } from "lucide-react";

export default function OrgSettingsPage() {
  return (
    <div className="min-h-screen bg-[#000000] text-[#E8E8E8]">
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
      <div className="flex justify-center py-8 [&_.cl-rootBox]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border [&_.cl-card]:border-white/10 [&_.cl-card]:bg-[#080808]">
        <OrganizationProfile
          afterLeaveOrganizationUrl="/"
          appearance={{
            baseTheme: dark,
            variables: {
              colorBackground: "#000000",
              colorInputBackground: "#111111",
              colorInputText: "#E8E8E8",
              colorText: "#E8E8E8",
              colorTextSecondary: "#888888",
              colorPrimary: "#C9A227",
              borderRadius: "0.75rem",
            },
            elements: {
              rootBox: "w-full max-w-4xl mx-auto",
              card: "bg-[#080808] border border-white/10 shadow-none",
              navbarButton: "text-[#E8E8E8]",
              headerTitle: "text-[#E8E8E8]",
              headerSubtitle: "text-[#888888]",
              formFieldLabel: "text-[#E8E8E8]",
              formFieldInput: "bg-[#111111] border-white/10 text-[#E8E8E8]",
              tableHead: "text-[#888888]",
              tableCell: "text-[#E8E8E8]",
              badge: "bg-[#1A1A1A] text-[#E8E8E8] border-white/10",
              button: "bg-[#C9A227] text-black",
              footerActionLink: "text-[#C9A227]",
            },
          }}
        />
      </div>
    </div>
  );
}
