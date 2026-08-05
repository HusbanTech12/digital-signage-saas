import { Fraunces, Manrope } from "next/font/google";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import "./marketing.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-marketing-display",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-marketing-body",
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${display.variable} ${body.variable} marketing-root min-h-screen`}
    >
      <MarketingNav />
      {children}
    </div>
  );
}
