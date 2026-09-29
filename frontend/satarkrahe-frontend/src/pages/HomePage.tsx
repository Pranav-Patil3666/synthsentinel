import Hero from "../components/landing/Hero";
import SystemOverview from "../components/landing/SystemOverview";
import ModelStack from "../components/landing/ModelStack";
import HowItWorks from "../components/landing/HowItWorks";
import AnalyzeCTA from "../components/landing/AnalyzeCTA";
import MonitorCTA from "../components/landing/MonitorCTA";

export default function HomePage() {
  return (
    <div className="landing-page">
      <Hero />
      <SystemOverview />
      <ModelStack />
      <HowItWorks />
      <AnalyzeCTA />
      <MonitorCTA />
    </div>
  );
}
