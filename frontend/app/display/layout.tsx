import type { Metadata } from "next";
import "./display-animations.css";
import "./kiosk-shell.css";

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
    <div className="h-dvh w-screen overflow-hidden bg-zinc-950 text-zinc-50 antialiased">
      {children}
    </div>
  );
}
