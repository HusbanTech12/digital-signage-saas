import type { Metadata } from "next";
import { ScannedMenu } from "@/components/public/scanned-menu";

export const metadata: Metadata = {
  title: "Menu",
  description: "Menu opened from a QR code.",
  robots: { index: false, follow: false },
};

/** Public landing page for menu QR codes — reached by scanning, not browsing. */
export default async function ScannedMenuPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ScannedMenu shortCode={code} />;
}
