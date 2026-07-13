import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Bug, FileUp, Lightbulb, NotebookPen, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Contribute to paperAI — Help GTU Students Learn Smarter",
  description:
    "Ways you can help improve paperAI — share papers, notes, ideas, and report issues.",
  alternates: {
    canonical: "/contribute",
  },
  openGraph: {
    title: "Contribute to paperAI",
    description: "Become a contributor and help us improve the platform.",
  },
};

const WAYS = [
  {
    icon: FileUp,
    title: "Upload study materials",
    text: "Share notes, summaries, and reference material with the community.",
  },
  {
    icon: NotebookPen,
    title: "Share previous papers",
    text: "Add older GTU papers we don't yet cover.",
  },
  { icon: Bug, title: "Report issues", text: "Spotted a bug or a wrong answer? Tell us." },
  {
    icon: Lightbulb,
    title: "Suggest features",
    text: "Have an idea that would make studying easier? We want to hear it.",
  },
  {
    icon: Sparkles,
    title: "Improve content quality",
    text: "Help review and refine generated solutions.",
  },
];

export default function ContributePage() {
  return (
    <PageShell
      eyebrow="Contribute"
      title="Help improve paperAI"
      description="paperAI gets better the more students contribute. Here's how you can help."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {WAYS.map((w) => (
          <div key={w.title} className="card-hover rounded-xl border border-border bg-card p-6">
            <div className="grid size-10 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--brand)_15%,transparent)] text-brand">
              <w.icon className="size-5" />
            </div>
            <h3 className="mt-5 text-base font-semibold">{w.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{w.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-12 rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <h2 className="text-2xl font-bold tracking-tight">Become a Contributor</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Join a small group of students helping us shape paperAI into the most useful study tool for
          GTU.
        </p>
        <Button className="mt-6 h-11 px-6" asChild>
          {/* // Comming Soon */}
          <p className="mt-6 text-sm text-muted-foreground">Coming Soon</p>
          
          {/* <Link href={ROUTES.register}>
            Become a Contributor
            <ArrowRight className="size-4" />
          </Link> */}


        </Button>
      </div>
    </PageShell>
  );
}
