import { AnalysisProvider } from "@/contexts/AnalysisContext";
import CursorGlow from "@/components/CursorGlow";
import Hero from "@/components/Hero";
import WhatWeBuilding from "@/components/WhatWeBuilding";
import WhyNow from "@/components/WhyNow";
import ProductFlow from "@/components/product/ProductFlow";
import CapabilityGrid from "@/components/product/CapabilityGrid";
import EarlyAccess from "@/components/EarlyAccess";
import Closing from "@/components/Closing";
import Footer from "@/components/Footer";
import type { LandingCopy } from "@/lib/i18n/landing/types";

// The landing page, shared by every language. Copy comes from the locale's
// dictionary; layout, animations and behaviour are identical.
export default function LandingPage({ copy }: { copy: LandingCopy }) {
  return (
    <AnalysisProvider>
      <CursorGlow />
      <main>
        <Hero copy={copy.hero} a11y={copy.a11y} />
        <WhatWeBuilding copy={copy.whatWeBuilding} a11y={copy.a11y} />
        <WhyNow copy={copy.whyNow} />
        <ProductFlow copy={copy.productFlow} />
        <CapabilityGrid copy={copy.capabilityGrid} />
        <EarlyAccess copy={copy.earlyAccess} />
        <Closing copy={copy.closing} />
      </main>
      <Footer copy={copy.footer} a11y={copy.a11y} />
    </AnalysisProvider>
  );
}
