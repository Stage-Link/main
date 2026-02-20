import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Cormorant_Garamond } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

export const metadata: Metadata = {
  title: "Stage Link - Real-Time Stage Monitoring",
  description:
    "Real-time stage monitoring system for theater crews. Stream your stage camera to crew members with near-zero latency.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorBackground: "#000000",
          colorInputBackground: "#111111",
          colorInputText: "#E8E8E8",
          colorText: "#E8E8E8",
          colorTextSecondary: "#888888",
          colorPrimary: "#C9A227",
          colorDanger: "#B71C2E",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "shadow-none border border-white/10 bg-[#080808]",
          headerTitle: "text-[#E8E8E8]",
          headerSubtitle: "text-[#888888]",
          formFieldLabel: "text-[#E8E8E8]",
          formFieldInput: "bg-[#111111] border-white/10 text-[#E8E8E8]",
          footerActionLink: "text-[#C9A227]",
          identityPreviewEditButton: "text-[#C9A227]",
          buttonPrimary: "bg-[#C9A227] text-black",
          navbarButton: "text-[#E8E8E8]",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${cormorant.variable} antialiased`}
        >
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
