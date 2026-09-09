import { AnalysisProvider } from "@/contexts/AnalysisContext";
import Hero from "@/components/Hero";
import WhatWeBuilding from "@/components/WhatWeBuilding";
import WhyNow from "@/components/WhyNow";
import EarlyAccess from "@/components/EarlyAccess";
import Closing from "@/components/Closing";

export default function Home() {
  return (
    <AnalysisProvider>
      <main>
        <Hero />
        <WhatWeBuilding />
        <WhyNow />
        <EarlyAccess />
        <Closing />
      </main>
    </AnalysisProvider>
  );
}
