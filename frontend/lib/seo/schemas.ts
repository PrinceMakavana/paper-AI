import type { FaqItem } from "@/lib/seo/faq-data";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/site";

export type ItemListEntry = {
  name: string;
  url: string;
};

export function createFaqPageJsonLd(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}

export function createHomeJsonLd() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: siteUrl,
        logo: `${siteUrl}/paper_ai_logo.png`,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: siteUrl,
        description: SITE_DESCRIPTION,
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          url: siteUrl,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/subjects`,
        },
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: siteUrl,
        description: SITE_DESCRIPTION,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
        },
      },
    ],
  };
}

export function createItemListJsonLd({
  name,
  url,
  items,
}: {
  name: string;
  url: string;
  items: ItemListEntry[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}
