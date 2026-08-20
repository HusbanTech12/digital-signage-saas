import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import {
  AiSection,
  ContactFooterSection,
  DesignerShowcaseSection,
  DeviceCompatibilitySection,
  IndustriesSection,
  IntegrationsSection,
  MultiAdminSection,
  RemoteControlSection,
  ScaleSection,
  TemplateShowcaseSection,
  TestimonialsSection,
  ThemeAutomationSection,
  WhatYouGetSection,
  WhyDeviceSection,
  WhyDigitalSection,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Signage — Turn any TV into a live menu board",
  description:
    "Design, schedule, and publish digital menu boards to every location from one dashboard. Browser-based kiosk player — no native TV app required.",
};

export default function MarketingLandingPage() {
  return (
    <main>
      <Hero />
      <IntegrationsSection />
      <TemplateShowcaseSection />
      <IndustriesSection />
      <WhatYouGetSection />
      <DeviceCompatibilitySection />
      <WhyDeviceSection />
      <DesignerShowcaseSection />
      <RemoteControlSection />
      <MultiAdminSection />
      <ScaleSection />
      <AiSection />
      <ThemeAutomationSection />
      <WhyDigitalSection />
      <TestimonialsSection />
      <ContactFooterSection />
    </main>
  );
}
