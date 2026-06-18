import { ExternalLinkAnchor } from "@/components/external-link-anchor";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { CatalogBook, SubjectDetail } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type SubjectPageProps = {
  params: Promise<{ id: string }>;
};

type SubjectResponse = {
  status?: number;
  subject?: SubjectDetail;
  message?: string;
};

type FetchSubjectResult =
  | { status: "ok"; subject: SubjectDetail }
  | { status: "not-found" }
  | { status: "error"; message: string };

const SUBJECT_CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const SITE_NAME = "paperAI";

function normalizeSubjectCode(id: string) {
  return decodeURIComponent(id).trim().toUpperCase();
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function getSubjectPath(subjectCode: string) {
  return `/subjects/${encodeURIComponent(subjectCode)}`;
}

function getSubjectUrl(subjectCode: string) {
  return `${getSiteUrl()}${getSubjectPath(subjectCode)}`;
}

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

async function fetchSubject(subjectCode: string): Promise<FetchSubjectResult> {
  if (!SUBJECT_CODE_PATTERN.test(subjectCode)) {
    return { status: "not-found" };
  }

  const url = buildApiUrl(`/public/catalog/subjects/${encodeURIComponent(subjectCode)}`);

  if (!url) {
    return {
      status: "error",
      message: "Catalog API is not configured.",
    };
  }

  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 },
      headers: getCatalogApiHeaders(),
    });

    if (response.status === 404) {
      return { status: "not-found" };
    }

    if (!response.ok) {
      return {
        status: "error",
        message: "Unable to load this subject right now.",
      };
    }

    const data = (await response.json()) as SubjectResponse;

    if (!data.subject) {
      return {
        status: "error",
        message: data.message || "Subject data was not available.",
      };
    }

    return { status: "ok", subject: data.subject };
  } catch {
    return {
      status: "error",
      message: "Unable to connect to the catalog service.",
    };
  }
}

function getSubjectTitle(subject: SubjectDetail) {
  const alias = subject.knownAs ? ` | ${subject.knownAs}` : "";
  return `${subject.subjectCode} ${subject.subjectName}${alias} | Syllabus, Papers, Books | GTU`;
}

function getSubjectDescription(subject: SubjectDetail) {
  const alias = subject.knownAs ? ` (${subject.knownAs})` : "";
  return `Download and view GTU ${subject.subjectName}${alias} ${subject.subjectCode} syllabus, old exam papers, books, and paper solutions on paperAI.`;
}

function getSubjectKeywords(subject: SubjectDetail) {
  const parts = [
    subject.subjectCode,
    subject.subjectName,
    subject.knownAs,
    "GTU",
    `${subject.subjectCode} syllabus`,
    `${subject.subjectCode} old papers`,
    `${subject.subjectCode} paper solution`,
    `${subject.subjectCode} books`,
    `${subject.subjectName} GTU`,
    `${subject.subjectName} syllabus`,
    `${subject.subjectName} paper solution`,
  ];

  return Array.from(new Set(parts.filter(Boolean) as string[]));
}

function createMaterialItems(subject: SubjectDetail) {
  const items: { name: string; url: string }[] = [];

  if (subject.syllabus) {
    items.push({
      name: `${subject.subjectCode} ${subject.subjectName} GTU syllabus`,
      url: subject.syllabus,
    });
  }

  (subject.oldPaper ?? []).forEach((paper) => {
    items.push({
      name: `${subject.subjectCode} ${subject.subjectName} ${paper.year} GTU old paper`,
      url: paper.link,
    });
  });

  (subject.books ?? []).forEach((book) => {
    if (!book.downloadLink) return;

    items.push({
      name: `${book.title || book.altData || book.bookId} book for ${subject.subjectCode}`,
      url: book.downloadLink,
    });
  });

  if (subject.paperSolution) {
    items.push({
      name: `${subject.subjectCode} ${subject.subjectName} GTU paper solution`,
      url: subject.paperSolution,
    });
  }

  return items;
}

function createSubjectJsonLd(subject: SubjectDetail) {
  const subjectUrl = getSubjectUrl(subject.subjectCode);
  const materialItems = createMaterialItems(subject);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: getSiteUrl(),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Subjects",
            item: `${getSiteUrl()}/subjects`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${subject.subjectCode} ${subject.subjectName}`,
            item: subjectUrl,
          },
        ],
      },
      {
        "@type": "Course",
        name: `${subject.subjectCode} ${subject.subjectName}`,
        alternateName: subject.knownAs,
        description: getSubjectDescription(subject),
        url: subjectUrl,
        provider: {
          "@type": "Organization",
          name: SITE_NAME,
          url: getSiteUrl(),
        },
      },
      {
        "@type": "ItemList",
        name: `${subject.subjectCode} ${subject.subjectName} GTU study materials`,
        url: subjectUrl,
        numberOfItems: materialItems.length,
        itemListElement: materialItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          url: item.url,
        })),
      },
    ],
  };
}

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export async function generateMetadata({ params }: SubjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const subjectCode = normalizeSubjectCode(id);
  const result = await fetchSubject(subjectCode);

  if (result.status !== "ok") {
    return {
      title: `${subjectCode} | paperAI`,
      description: "Browse GTU syllabus, old papers, books, and paper solutions on paperAI.",
      alternates: {
        canonical: getSubjectUrl(subjectCode),
      },
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { subject } = result;
  const title = getSubjectTitle(subject);
  const description = getSubjectDescription(subject);
  const url = getSubjectUrl(subject.subjectCode);

  return {
    title,
    description,
    keywords: getSubjectKeywords(subject),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

function getInitials(subject: SubjectDetail) {
  const source = subject.knownAs || subject.subjectName || subject.subjectCode;
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function MaterialSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SubjectMaterialCard({
  initials,
  title,
  subtitle,
  href,
  actionLabel,
}: {
  initials: string;
  title: string;
  subtitle: string;
  href?: string;
  actionLabel: string;
}) {
  return (
    <div className="w-full max-w-xs rounded-sm border border-border bg-background p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-brand">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <ExternalLinkAnchor
        href={href}
        className="mt-3 flex h-8 w-full items-center justify-center rounded-full border border-primary px-3 text-xs font-medium text-foreground no-underline opacity-100 hover:bg-muted"
        iconClassName="hidden"
      >
        {actionLabel}
      </ExternalLinkAnchor>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

function OldPaperGrid({ papers }: { papers: NonNullable<SubjectDetail["oldPaper"]> }) {
  if (papers.length === 0) {
    return <EmptySection message="No old papers are available yet." />;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {papers.map((paper) => (
        <ExternalLinkAnchor
          key={`${paper.year}-${paper.link}`}
          href={paper.link}
          className="flex min-h-9 items-center justify-center rounded-sm border border-primary px-2 text-center text-xs font-medium text-foreground no-underline opacity-100 hover:bg-muted"
          iconClassName="hidden"
        >
          {paper.year} Paper
        </ExternalLinkAnchor>
      ))}
    </div>
  );
}

function BookCard({ book, subjectCode }: { book: CatalogBook; subjectCode: string }) {
  const title = book.title || book.altData || book.bookId;

  return (
    <div className="flex w-full max-w-xs flex-col gap-3 rounded-sm border border-border bg-background p-3 shadow-[var(--shadow-card)]">
      <div className="flex min-h-40 items-center justify-center rounded-sm bg-muted p-2">
        {book.img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.img}
            alt={title}
            className="max-h-40 max-w-full rounded-sm border border-border object-contain"
          />
        ) : (
          <div className="grid h-40 w-28 place-items-center rounded-sm border border-border bg-card px-3 text-center text-xs font-medium text-muted-foreground">
            {title}
          </div>
        )}
      </div>
      <div>
        <p className="line-clamp-2 text-sm font-medium text-foreground">{title}</p>
        {!book.downloadLink ? (
          <p className="mt-1 text-xs text-muted-foreground">Public download is not available yet.</p>
        ) : null}
      </div>
      {book.downloadLink ? (
        <ExternalLinkAnchor
          href={book.downloadLink}
          className="mt-auto flex h-8 items-center justify-center rounded-sm border border-primary px-3 text-xs font-medium text-foreground no-underline opacity-100 hover:bg-muted"
          iconClassName="hidden"
        >
          Download {subjectCode} book
        </ExternalLinkAnchor>
      ) : null}
    </div>
  );
}

function BooksGrid({ books, subjectCode }: { books: CatalogBook[]; subjectCode: string }) {
  if (books.length === 0) {
    return <EmptySection message="No books are available yet." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {books.map((book) => (
        <BookCard key={book.bookId} book={book} subjectCode={subjectCode} />
      ))}
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
      <h1 className="text-xl font-semibold text-foreground">Subject unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { id } = await params;
  const subjectCode = normalizeSubjectCode(id);
  const result = await fetchSubject(subjectCode);

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6">
          <ErrorMessage message={result.message} />
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { subject } = result;
  const initials = getInitials(subject);
  const papers = subject.oldPaper ?? [];
  const books = subject.books ?? [];
  const subjectAlias = subject.knownAs ? `, also known as ${subject.knownAs},` : "";
  const jsonLd = createSubjectJsonLd(subject);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <JsonLd data={jsonLd} />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-16 pt-24 sm:px-6">
        <header className="border-b border-border pb-3">
          <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span>/</span>
            <Link href="/subjects" className="hover:text-foreground">
              Subjects
            </Link>
            <span>/</span>
            <span className="text-foreground">{subject.subjectCode}</span>
          </nav>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">GTU Subject</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {subject.subjectName}
            {subject.knownAs ? ` | ${subject.knownAs}` : ""} | {subject.subjectCode} | GTU
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Find GTU {subject.subjectName}{subjectAlias} subject code {subject.subjectCode}
            {" "}study materials, including syllabus, old exam papers, books, and paper solutions.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="inline-block border-b border-foreground pb-1 text-xl font-medium text-foreground">
                Syllabus
              </h2>
              <div className="mt-4">
                {subject.syllabus ? (
                  <SubjectMaterialCard
                    initials={initials}
                    title={subject.subjectName}
                    subtitle={subject.subjectCode}
                    href={subject.syllabus}
                    actionLabel={`Download ${subject.subjectCode} syllabus`}
                  />
                ) : (
                  <EmptySection message="No syllabus is available yet." />
                )}
              </div>
            </div>

            <MaterialSection title="Old Papers">
              <OldPaperGrid papers={papers} />
            </MaterialSection>

            <MaterialSection title="Books">
              <BooksGrid books={books} subjectCode={subject.subjectCode} />
            </MaterialSection>

            <div>
              <h2 className="inline-block border-b border-foreground pb-1 text-xl font-medium text-foreground">
                Paper Solutions
              </h2>
              <div className="mt-4">
                {subject.paperSolution ? (
                  <SubjectMaterialCard
                    initials={initials}
                    title={subject.subjectName}
                    subtitle={subject.subjectCode}
                    href={subject.paperSolution}
                    actionLabel={`View ${subject.subjectCode} paper solution`}
                  />
                ) : (
                  <EmptySection message="No paper solution is available yet." />
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-sm border border-border bg-card p-4 text-sm shadow-[var(--shadow-card)] lg:sticky lg:top-24 lg:self-start">
            <h2 className="font-semibold text-foreground">Subject Details</h2>
            <dl className="mt-3 space-y-2 text-muted-foreground">
              <div>
                <dt className="text-xs uppercase tracking-wide">Code</dt>
                <dd className="text-foreground">{subject.subjectCode}</dd>
              </div>
              {subject.knownAs ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide">Known As</dt>
                  <dd className="text-foreground">{subject.knownAs}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs uppercase tracking-wide">Books</dt>
                <dd className="text-foreground">{books.length}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide">Old Papers</dt>
                <dd className="text-foreground">{papers.length}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
