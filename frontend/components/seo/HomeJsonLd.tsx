import { JsonLd } from "@/lib/seo/json-ld";
import { LANDING_FAQS } from "@/lib/seo/faq-data";
import { createFaqPageJsonLd, createHomeJsonLd } from "@/lib/seo/schemas";

export function HomeJsonLd() {
  return (
    <>
      <JsonLd data={createHomeJsonLd()} />
      <JsonLd data={createFaqPageJsonLd(LANDING_FAQS)} />
    </>
  );
}
