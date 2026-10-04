"use client";

import {
  CatalogPdfViewerDialog,
  useCatalogPdfViewer,
  type OpenCatalogPdfArgs,
} from "@/components/catalog-pdf-viewer";
import { useSubjectListBrowse } from "@/hooks/useSubjectListBrowse";
import {
  getMaterialFiles,
  getMaterialFileUrl,
  getPaperSolutionLabel,
} from "@/lib/catalog-materials";
import type { SubjectDetail } from "@/lib/types";
import { ArrowUpRight, BookOpen } from "lucide-react";
import Link from "next/link";

type PaperSolutionsGridProps = {
  subjects: SubjectDetail[];
  errorMessage?: string;
};

function SolutionCard({
  subject,
  onOpenPdf,
}: {
  subject: SubjectDetail;
  onOpenPdf: (args: OpenCatalogPdfArgs) => void;
}) {
  const files = getMaterialFiles(subject.paperSolution);
  const subjectHref = `/subjects/${encodeURIComponent(subject.subjectCode)}`;

  return (
    <article className="mb-4 break-inside-avoid rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-2">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <Link
            href={subjectHref}
            className="block text-base font-semibold leading-tight text-brand transition hover:opacity-80"
          >
            {subject.subjectCode}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {subject.subjectName}
          </p>
          {subject.knownAs ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subject.knownAs}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 border-t border-border" />

      <ul className="mt-2">
        {files.map((file, index) => {
          const fileUrl = getMaterialFileUrl(file);
          const label = getPaperSolutionLabel(file, index);
          const rowClassName =
            "flex w-full items-center justify-between gap-2 py-2 text-left text-sm font-medium text-foreground transition hover:text-brand";

          if (!fileUrl?.trim()) {
            return (
              <li key={`${fileUrl || file.title || index}`}>
                <span className={rowClassName}>
                  <span className="min-w-0 truncate">{label}</span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-brand" aria-hidden />
                </span>
              </li>
            );
          }

          return (
            <li key={`${fileUrl || file.title || index}`}>
              <button
                type="button"
                onClick={() => onOpenPdf({ filename: label, url: fileUrl })}
                className={rowClassName}
              >
                <span className="min-w-0 truncate">{label}</span>
                <ArrowUpRight className="size-3.5 shrink-0 text-brand" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <Link
        href={subjectHref}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-brand"
      >
        View all materials
        <ArrowUpRight className="size-3" aria-hidden />
      </Link>
    </article>
  );
}

export function PaperSolutionsGrid({ subjects, errorMessage }: PaperSolutionsGridProps) {
  const {
    searchQuery,
    setSearchQuery,
    hasInvalidSearchCharacters,
    filteredSubjects,
    visibleSubjects,
    hasMore,
    hasActiveSearch,
    isPending,
    handleLoadMore,
  } = useSubjectListBrowse(subjects);
  const { open, filename, url, openPdf, closePdf } = useCatalogPdfViewer();

  if (subjects.length === 0) {
    if (errorMessage) {
      return (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-foreground">
            Paper solutions temporarily unavailable
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-foreground">No paper solutions available</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          GTU paper solutions will appear here when they are added to the catalog.
        </p>
      </div>
    );
  }

  return (
    <div>
      <CatalogPdfViewerDialog
        open={open}
        filename={filename}
        url={url}
        onClose={closePdf}
      />

      <div className="mb-6 max-w-md">
        <label
          htmlFor="paper-solution-search"
          className="text-sm font-medium text-foreground"
        >
          Search by subject code
        </label>
        <input
          id="paper-solution-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value.toUpperCase())}
          placeholder="Search by subject code"
          aria-invalid={hasInvalidSearchCharacters}
          aria-describedby={
            hasInvalidSearchCharacters ? "paper-solution-search-error" : undefined
          }
          className="mt-2 w-full rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-[var(--shadow-card)] outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        {hasInvalidSearchCharacters ? (
          <p
            id="paper-solution-search-error"
            className="mt-2 text-xs text-destructive"
          >
            Use only letters, numbers, spaces, and hyphens for subject codes.
          </p>
        ) : null}
      </div>

      {filteredSubjects.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-foreground">No matching solutions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another GTU subject code.
          </p>
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {visibleSubjects.map((subject) => (
            <SolutionCard
              key={subject.subjectCode}
              subject={subject as SubjectDetail}
              onOpenPdf={openPdf}
            />
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {visibleSubjects.length} of {filteredSubjects.length}
          {hasActiveSearch ? ` matching` : ""} solutions
        </p>
        {hasMore ? (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isPending}
            className="min-w-40 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? "Loading..." : "Load more"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
