import type { Metadata } from "next";
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
import { HomeJsonLd } from "@/components/seo/HomeJsonLd";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/paper_ai_logo.png",
        width: 280,
        height: 72,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/paper_ai_logo.png"],
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <HomeJsonLd />
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
