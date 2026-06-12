import { Clock, Lightbulb, Target } from "lucide-react";
import { Reveal } from "@/components/layout/Reveal";

const BENEFITS = [
  { icon: Clock, title: "Save Hours of Manual Searching", text: "Find answers instantly across years of GTU papers." },
  { icon: Lightbulb, title: "Understand Concepts Faster", text: "Learn through explanations, not memorization." },
  { icon: Target, title: "Prepare Smarter for Exams", text: "Focus on topics that actually matter." },
];

const STATS = [
  { value: "10,000+", label: "Questions Solved" },
  { value: "1,000+", label: "Active Students" },
  { value: "95%", label: "Faster Research" },
];

export function Benefits() {
  return (
    <section className="border-b border-border bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              For Students
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Why Students Use paperAI
            </h2>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 80}>
              <div className="card-hover h-full rounded-xl border border-border bg-card p-6">
                <div className="grid size-10 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--brand)_15%,transparent)] text-brand">
                  <b.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mt-12 grid divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map((s) => (
              <div key={s.label} className="p-8 text-center">
                <div className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">{s.value}</div>
                <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
