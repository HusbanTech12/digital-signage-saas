import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Display · Signage",
  description: "Kiosk display client",
  robots: { index: false, follow: false },
};

/** Minimal chrome-free layout for Chromium kiosk mode. */
export default function DisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
      {children}
    </div>
  );
}
