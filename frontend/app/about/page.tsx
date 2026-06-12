import type { Metadata } from "next";
import { PageShell, Prose } from "@/components/layout/PageShell";
import { Cpu, GraduationCap, Rocket, Target, Users, Wrench } from "lucide-react";

export const metadata: Metadata = {
  title: "About paperAI — Built for GTU Students",
  description:
    "Learn why paperAI was built, our mission to help GTU students learn faster with AI, and the technology behind the platform.",
  openGraph: {
    title: "About paperAI",
    description: "Our mission, vision, and the technology powering paperAI.",
  },
};

const VALUES = [
  { icon: Rocket, title: "Mission", text: "Help GTU students learn faster using AI." },
  { icon: Target, title: "Vision", text: "Create the smartest AI-powered learning ecosystem." },
  {
    icon: GraduationCap,
    title: "GTU Focus",
    text: "Built around the syllabus, papers, and exam style students actually face.",
  },
  { icon: Cpu, title: "Tech Stack", text: "Gemini, Ollama, vector search, and AI retrieval." },
  {
    icon: Wrench,
    title: "Why We Built It",
    text: "Students wasted hours hunting for solutions. We turned that into minutes.",
  },
  {
    icon: Users,
    title: "Team",
    text: "A small team of engineers and ex-GTU students who lived the problem.",
  },
];

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About"
      title="Built by students, for GTU students"
      description="paperAI is an AI-powered paper solution and document assistant platform focused on the GTU curriculum."
    >
      <Prose>
        <h2>What is paperAI</h2>
        <p>
          paperAI helps GTU students upload question papers and study material, generate detailed
          solutions, chat with PDFs, and prepare for exams faster. It combines retrieval, large
          language models, and a focused study workspace.
        </p>
      </Prose>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {VALUES.map((v) => (
          <div key={v.title} className="card-hover rounded-xl border border-border bg-card p-6">
            <div className="grid size-10 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--brand)_15%,transparent)] text-brand">
              <v.icon className="size-5" />
            </div>
            <h3 className="mt-5 text-base font-semibold">{v.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{v.text}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
