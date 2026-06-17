import { Fragment } from "react";
import { Upload, Brain, Sparkles, MessageSquare } from "lucide-react";
import { Reveal } from "@/components/layout/Reveal";

const STEPS = [
  { icon: Upload, title: "Find Materials", text: "Find the materials related to the subject. using AI." },
  { icon: Brain, title: "Subject Level Assistant", text: "from Subjects Section you can ask questions related to the subject." },
  { icon: Sparkles, title: "Document Level Assistant", text: "In Documents Section Upload your study material and ask questions related to the document." },
  { icon: MessageSquare, title: "Chat & Learn", text: "You can also ask follow-ups on any answer." },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-border py-24">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              How it works
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              From Subject to Complete Solution in Minutes
            </h2>
          </div>
        </Reveal>

        <div className="mx-auto mt-16 flex  flex-col items-center lg:flex-row lg:items-start lg:justify-center">
          {STEPS.map((s, i) => (
            <Fragment key={s.title}>
              <Reveal delay={i * 100} className="flex flex-1 flex-col items-center">
                <div className="flex flex-col items-center text-center">
                  <div className="grid size-14 place-items-center rounded-xl border border-border bg-card text-brand shadow-[var(--shadow-card)]">
                    <s.icon className="size-6" />
                  </div>
                  {/* <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Step {i + 1}
                  </div> */}
                  <h3 className="mt-1.5 max-w-[220px] text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 max-w-[220px] text-sm text-muted-foreground">{s.text}</p>
                </div>
              </Reveal>
              {i < STEPS.length - 1 && (
                <>
                  <div
                    className="h-8 w-px shrink-0 bg-border lg:hidden"
                    aria-hidden
                  />
                  <div
                    className="hidden h-14 w-12 shrink-0 items-center lg:flex xl:w-20"
                    aria-hidden
                  >
                    <div className="h-px w-full bg-border" />
                  </div>
                </>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
