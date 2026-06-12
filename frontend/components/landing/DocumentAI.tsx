import { UploadCloud, FileText, MessageSquareText, LockKeyhole } from "lucide-react";
import { Reveal } from "@/components/layout/Reveal";

const CARDS = [
  { icon: UploadCloud, title: "Upload PDFs", text: "Research papers, notes, books, manuals." },
  { icon: FileText, title: "Generate Summaries", text: "Understand documents quickly." },
  { icon: MessageSquareText, title: "Ask Questions", text: "Get contextual AI answers." },
  { icon: LockKeyhole, title: "Secure Workspace", text: "Private and protected document storage." },
];

export function DocumentAI() {
  return (
    <section className="border-b border-border py-24">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              Document AI
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              More Than Just Paper Solutions
            </h2>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((c, i) => (
            <Reveal key={c.title} delay={i * 70}>
              <div className="card-hover h-full rounded-xl border border-border bg-card p-6">
                <div className="grid size-10 place-items-center rounded-lg border border-border bg-background text-brand">
                  <c.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
