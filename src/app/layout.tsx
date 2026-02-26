import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Cormorant_Garamond } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Analytics } from "@vercel/analytics/next";
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

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-main-app-domain.com";

const title = "Stage Link - Real-Time Stage Monitoring";
const description =
  "Real-time stage monitoring system for theater crews. Stream your stage camera to crew members with near-zero latency.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0C0A09",
};

export const metadata: Metadata = {
  title,
  description,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Stage Link",
  },
  icons: {
    icon: [
      { url: "/icon", sizes: "128x128", type: "image/png" },
      { url: "/icon-64", sizes: "64x64", type: "image/png" },
    ],
    apple: "/apple-icon",
  },
  openGraph: {
    title,
    description,
    url: baseUrl,
    siteName: "Stage Link",
    images: [
      {
        url: `${baseUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Stage Link",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
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
          colorBackground: "#0C0A09",
          colorInputBackground: "#1A1614",
          colorInputText: "#F5F0E8",
          colorText: "#F5F0E8",
          colorTextSecondary: "#A89B8C",
          colorPrimary: "#C9A227",
          colorDanger: "#B71C2E",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "shadow-none border border-white/10 bg-[#161412]",
          headerTitle: "text-[#F5F0E8]",
          headerSubtitle: "text-[#A89B8C]",
          formFieldLabel: "text-[#F5F0E8]",
          formFieldInput: "bg-[#1A1614] border-white/10 text-[#F5F0E8]",
          footerActionLink: "text-[#C9A227]",
          identityPreviewEditButton: "text-[#C9A227]",
          buttonPrimary: "bg-[#C9A227] text-[#0C0A09]",
          navbarButton: "text-[#F5F0E8]",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning className="bg-[#0C0A09]">
        <body
          className={`${geistSans.variable} ${cormorant.variable} antialiased`}
        >
          <TooltipProvider>
            {children}
            <Toaster />
            <Analytics />
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
