import { Reveal } from "@/components/layout/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "What is paperAI?",
    a: "paperAI is an AI-powered platform that generates GTU paper solutions and lets you chat with your study documents — built specifically for GTU students.",
  },
  {
    q: "Can it solve GTU papers?",
    a: "Yes. Select the subject and Ask questions to AI and it will generate detailed, exam-focused answers question by question.",
  },
  {
    q: "Which AI models are used?",
    a: "paperAI supports Google Gemini model.",
  },
  {
    q: "Can I upload PDFs?",
    a: "Absolutely. Upload notes, textbooks, research papers, and reference material to summarize and ask questions against.",
  },
  {
    q: "Is my data secure?",
    a: "Documents are stored in a protected workspace tied to your account. With Ollama you can run models entirely on your machine.",
  },
  {
    q: "Can I revisit previous documents?",
    a: "Yes. Document history keeps every workspace ready so you can return to past papers and notes anytime.",
  },
  {
    q: "Does it support previous year papers?",
    a: "paperAI is optimized for previous year GTU papers — analyzing patterns and highlighting frequently asked topics.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="border-b border-border py-24">
      <div className="mx-auto max-w-3xl px-5">
        <Reveal>
          <div className="text-center">
            <div className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              FAQ
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <Accordion type="single" collapsible className="mt-10">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border">
                <AccordionTrigger className="text-left text-base font-medium">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
