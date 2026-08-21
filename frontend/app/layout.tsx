import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { VercelToolbar } from "@vercel/toolbar/next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Signage — Digital Menu Boards",
  description:
    "Multi-tenant digital signage dashboard for restaurants, cafes, and retail.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Preview deployments inject the toolbar automatically; this is for localhost.
  const shouldInjectToolbar = process.env.NODE_ENV === "development";

  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject body attrs */}
        <body
          className="min-h-full flex flex-col font-sans"
          suppressHydrationWarning
        >
          {children}
          {shouldInjectToolbar ? <VercelToolbar /> : null}
        </body>
      </html>
    </ClerkProvider>
  );
}
