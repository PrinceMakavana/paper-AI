import { FileCheck2, ListChecks, GraduationCap, MessagesSquare } from "lucide-react";
import { Reveal } from "@/components/layout/Reveal";

const ITEMS = [
  {
    icon: FileCheck2,
    title: "Select Subject",
    text: "Select the subject of the question paper.",
  },
  {
    icon: ListChecks,
    title: "Ask Questions",
    text: "Ask questions related to the subject to AI and it will generate detailed solutions with explanations.",
  },
  {
    icon: GraduationCap,
    title: "Chat with Solutions",
    text: "Chat with the generated solutions to understand concepts better.",
  },
  {
    icon: MessagesSquare,
    title: "Ask Follow-up Questions",
    text: "Ask follow-up questions to the generated solutions to understand concepts better.",
  },
];

export function PaperSolution() {
  return (
    <section id="paper-solutions" className="border-b border-border py-24">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              Paper Solutions
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Solve GTU Question Instantly
            </h2>
            <p className="mt-4 text-muted-foreground">
              select subject and ask question paper related questions to AI and it will generate detailed solutions with
              explanations.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((it, i) => (
            <Reveal key={it.title} delay={i * 80}>
              <div className="card-hover h-full rounded-xl border border-border bg-card p-6">
                <div className="grid size-10 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--brand)_15%,transparent)] text-brand">
                  <it.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{it.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{it.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
