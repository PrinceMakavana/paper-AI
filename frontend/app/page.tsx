import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { PaperSolution } from "@/components/landing/PaperSolution";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { Benefits } from "@/components/landing/Benefits";
import { DocumentAI } from "@/components/landing/DocumentAI";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { ContactSection } from "@/components/landing/ContactSection";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <PaperSolution />
      <HowItWorks />
      <Features />
      <Benefits />
      <DocumentAI />
      <Testimonials />
      <FAQ />
      <ContactSection />
      <FinalCTA />
      <SiteFooter />
    </div>
  );
}
