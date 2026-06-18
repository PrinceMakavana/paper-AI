import {
  Sparkles,
  MessageSquareText,
  FileText,
  TrendingUp,
  History,
} from "lucide-react";
import { Reveal } from "@/components/layout/Reveal";

const FEATURES = [
  { icon: Sparkles, title: "AI Paper Solutions", text: "Generate complete answers instantly." },
  { icon: MessageSquareText, title: "PDF Chat", text: "Ask questions directly from uploaded documents." },
  { icon: FileText, title: "Smart Summaries", text: "Create concise summaries from notes and books." },
  { icon: TrendingUp, title: "Previous Paper Analysis", text: "Identify important topics and patterns." },
  // { icon: Cpu, title: "Multi Model Support", text: "Gemini + Ollama support out of the box." },
  { icon: History, title: "Document History", text: "Access previous workspaces anytime." },
];

export function Features() {
  return (
    <section id="features" className="border-b border-border py-24">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              Features
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to study smarter
            </h2>
            <p className="mt-4 text-muted-foreground">
              A focused workspace built around solving papers and learning from documents.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="card-hover group relative h-full overflow-hidden rounded-xl border border-border bg-card p-6">
                <div
                  className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: "var(--gradient-spark)" }}
                />
                <div className="grid size-11 place-items-center rounded-lg border border-border bg-background text-brand">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
