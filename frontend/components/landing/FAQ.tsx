import { Reveal } from "@/components/layout/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LANDING_FAQS } from "@/lib/seo/faq-data";

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
            {LANDING_FAQS.map((f, i) => (
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
