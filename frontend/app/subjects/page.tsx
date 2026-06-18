import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SubjectsGrid } from "@/components/subjects/subjects-grid";
import type { SubjectSummary } from "@/lib/types";
import type { Metadata } from "next";

type PublicSubjectsResponse = {
  subjects?: SubjectSummary[];
};

export const metadata: Metadata = {
  title: "GTU Subjects | Syllabus, Papers, Books, Solutions | paperAI",
  description:
    "Browse GTU subjects and find syllabus, old papers, books, and paper solutions by subject code.",
  alternates: {
    canonical: "/subjects",
  },
  openGraph: {
    title: "GTU Subjects | Syllabus, Papers, Books, Solutions | paperAI",
    description:
      "Browse GTU subjects and find syllabus, old papers, books, and paper solutions by subject code.",
    url: "/subjects",
    siteName: "paperAI",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "GTU Subjects | Syllabus, Papers, Books, Solutions | paperAI",
    description:
      "Browse GTU subjects and find syllabus, old papers, books, and paper solutions by subject code.",
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

async function fetchPublicSubjects() {
  const url = buildApiUrl("/public/catalog/subjects");

  if (!url) {
    return [];
  }

  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 },
      headers: getCatalogApiHeaders(),
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as PublicSubjectsResponse;
    return (data.subjects ?? []).filter((subject) => subject.subjectCode);
  } catch {
    return [];
  }
}

export default async function SubjectsPage() {
  const subjects = await fetchPublicSubjects();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-16 pt-24 sm:px-6">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            GTU Materials
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Browse GTU Subjects
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Find syllabus, old exam papers, books, and paper solutions by GTU subject code.
            Select a subject to open its public materials page.
          </p>
        </header>

        <SubjectsGrid subjects={subjects} />
      </main>
      <SiteFooter />
    </div>
  );
}
