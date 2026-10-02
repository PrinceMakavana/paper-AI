import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { TurnstileGate } from "@/components/auth/TurnstileGate";
import { PaperSolutionsGrid } from "@/components/paper-solution/paper-solutions-grid";
import { CareerKitsStrip } from "@/components/projects/CareerKitsStrip";
import { getMaterialFiles } from "@/lib/catalog-materials";
import { JsonLd } from "@/lib/seo/json-ld";
import { createItemListJsonLd } from "@/lib/seo/schemas";
import { getSiteUrl, getSubjectUrl } from "@/lib/seo/site";
import type { SubjectDetail } from "@/lib/types";
import type { Metadata } from "next";

type PublicSubjectsResponse = {
  subjects?: SubjectDetail[];
  message?: string;
};

type PublicSubjectsResult =
  | { status: "ok"; subjects: SubjectDetail[] }
  | { status: "error"; message: string };

export const metadata: Metadata = {
  title: "GTU Paper Solutions | Browse by Subject | paperAI",
  description:
    "Browse GTU paper solutions by subject code. Download solved question papers and open the full subject materials page.",
  alternates: {
    canonical: "/paper-solution",
  },
  openGraph: {
    title: "GTU Paper Solutions | Browse by Subject | paperAI",
    description:
      "Browse GTU paper solutions by subject code. Download solved question papers and open the full subject materials page.",
    url: "/paper-solution",
    siteName: "paperAI",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "GTU Paper Solutions | Browse by Subject | paperAI",
    description:
      "Browse GTU paper solutions by subject code. Download solved question papers and open the full subject materials page.",
  },
};

function buildApiUrl(path: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const apiVersion = process.env.NEXT_PUBLIC_API_VERSION ?? "";

  if (!apiBase) {
    return undefined;
  }

  return `${apiBase.replace(/\/$/, "")}${apiVersion}${path}`;
}

function getCatalogApiHeaders() {
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };
  const secret = process.env.PUBLIC_CATALOG_API_SECRET;

  if (secret) {
    headers["x-paperai-catalog-secret"] = secret;
  }

  return headers;
}

async function fetchSubjectsWithPaperSolutions(): Promise<PublicSubjectsResult> {
  const url = buildApiUrl("/public/catalog/subjects?include=details");

  if (!url) {
    return {
      status: "error",
      message: "Catalog API is not configured.",
    };
  }

  try {
    const response = await fetch(url, {
      headers: getCatalogApiHeaders(),
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch public catalog subjects for paper solutions: ${response.status} ${response.statusText}`,
      );

      return {
        status: "error",
        message: "Unable to load GTU paper solutions right now.",
      };
    }

    const data = (await response.json()) as PublicSubjectsResponse;
    const subjects = (data.subjects ?? []).filter(
      (subject) =>
        subject.subjectCode && getMaterialFiles(subject.paperSolution).length > 0,
    );

    return {
      status: "ok",
      subjects,
    };
  } catch (error) {
    console.error("Error fetching paper solutions catalog:", error);

    return {
      status: "error",
      message: "Unable to connect to the catalog service.",
    };
  }
}

export default async function PaperSolutionPage() {
  const result = await fetchSubjectsWithPaperSolutions();
  const subjects = result.status === "ok" ? result.subjects : [];
  const errorMessage = result.status === "error" ? result.message : undefined;
  const siteUrl = getSiteUrl();
  const solutionsJsonLd = createItemListJsonLd({
    name: "GTU Paper Solutions on paperAI",
    url: `${siteUrl}/paper-solution`,
    items: subjects.map((subject) => ({
      name: `${subject.subjectCode} ${subject.subjectName} Paper Solution`,
      url: getSubjectUrl(subject.subjectCode),
    })),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <JsonLd data={solutionsJsonLd} />
      <SiteHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-16 pt-24 sm:px-6">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            GTU Materials
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Browse Paper Solutions
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Find GTU paper solutions by subject code. Download solved papers or open the
            subject page for syllabus, books, and old exam papers.
          </p>
        </header>

        <CareerKitsStrip />
        <TurnstileGate
          title="Verify to browse paper solutions"
          description="Complete this quick check to view available GTU paper solutions."
        >
          <div className="flex flex-col gap-8">
            <PaperSolutionsGrid subjects={subjects} errorMessage={errorMessage} />
          </div>
        </TurnstileGate>
      </main>
      <SiteFooter />
    </div>
  );
}
