"use client";

import { ExternalLinkAnchor } from "@/components/external-link-anchor";
import { useSubjectListBrowse } from "@/hooks/useSubjectListBrowse";
import { getCatalogDownloadHref } from "@/lib/catalogDownload";
import type { CatalogBook, SubjectDetail, SubjectSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2, Search, X } from "lucide-react";
import { useEffect } from "react";

interface SubjectCatalogProps {
  subjects: SubjectSummary[];
  loading?: boolean;
  currentSubjectCode?: string;
  subjectDetail?: SubjectDetail;
  onSelect: (subjectCode: string) => void;
}

function isCatalogBookVisible(book: CatalogBook): boolean {
  return book.pageindexStatus === "ready";
}

export function SubjectCatalog({
  subjects,
  loading,
  currentSubjectCode,
  subjectDetail,
  onSelect,
}: SubjectCatalogProps) {
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
    ensureSubjectVisible,
  } = useSubjectListBrowse(subjects);

  useEffect(() => {
    ensureSubjectVisible(currentSubjectCode);
  }, [currentSubjectCode, ensureSubjectVisible]);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] ed-sidebar-panel">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="shrink-0 text-sm font-medium text-foreground">Subjects</h2>
          {subjects.length > 0 && !loading && (
            <span className="ml-auto shrink-0 whitespace-nowrap text-[0.6875rem] text-muted-foreground">
              {hasActiveSearch
                ? `${visibleSubjects.length} of ${filteredSubjects.length} matching`
                : `${visibleSubjects.length} of ${filteredSubjects.length}`}
            </span>
          )}
        </div>

        {subjects.length > 0 && !loading ? (
          <div>
            <div className="relative min-w-0">
              <Search
                size={12}
                aria-hidden
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                placeholder="Search by subject code"
                aria-label="Search subjects by code"
                aria-invalid={hasInvalidSearchCharacters}
                aria-describedby={
                  hasInvalidSearchCharacters ? "subject-catalog-search-error" : undefined
                }
                className="h-7 w-full rounded-lg border border-border bg-background py-0 pl-7 pr-7 text-xs text-foreground outline-none focus:border-brand"
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 flex size-[18px] -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
            {hasInvalidSearchCharacters ? (
              <p
                id="subject-catalog-search-error"
                className="mt-1.5 text-[0.6875rem] leading-snug text-destructive"
              >
                Use only letters, numbers, spaces, and hyphens.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="ed-sidebar-panel__body ed-panel-scroll flex items-center gap-2 p-4 text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : subjects.length === 0 ? (
        <p className="ed-sidebar-panel__body ed-panel-scroll p-4 text-sm leading-relaxed text-muted-foreground">
          No subjects available.
        </p>
      ) : filteredSubjects.length === 0 ? (
        <p className="ed-sidebar-panel__body ed-panel-scroll p-4 text-sm leading-relaxed text-muted-foreground">
          No matching subjects. Try another GTU subject code.
        </p>
      ) : (
        <div className="ed-sidebar-panel__body ed-panel-scroll">
          {visibleSubjects.map((subject) => {
            const isActive = currentSubjectCode === subject.subjectCode;
            const visibleBooks =
              isActive && subjectDetail?.books
                ? subjectDetail.books.filter(isCatalogBookVisible)
                : [];

            return (
              <div
                key={subject.subjectCode}
                onClick={() => onSelect(subject.subjectCode)}
                className={cn(
                  "cursor-pointer border-b border-border px-4 py-3 transition-colors",
                  isActive
                    ? "border-l-2 border-l-brand bg-[color-mix(in_oklab,var(--brand)_8%,transparent)]"
                    : "border-l-2 border-l-transparent hover:bg-muted/40",
                )}
              >
                <div
                  className={cn(
                    "mb-0.5 text-sm leading-snug",
                    isActive ? "font-medium text-brand" : "text-foreground",
                  )}
                >
                  {subject.subjectName}
                </div>
                <div className="text-[0.6875rem] leading-snug text-muted-foreground">
                  {subject.subjectCode}
                  {subject.knownAs ? ` · ${subject.knownAs}` : ""}
                </div>

                {isActive && visibleBooks.length > 0 ? (
                  <div className="mt-2.5 border-t border-border pt-2.5">
                    {visibleBooks.map((book) => (
                      <div
                        key={book.bookId}
                        className="flex items-start gap-2 py-1.5 text-xs text-muted-foreground"
                      >
                        {book.img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={book.img}
                            alt={book.title || book.bookId}
                            className="size-9 shrink-0 rounded border border-border object-cover"
                          />
                        ) : null}
                        <span className="min-w-0 flex-1 leading-snug">
                          {book.title || book.altData || book.bookId}
                        </span>
                        {book.downloadLink ? (
                          <ExternalLinkAnchor
                            href={getCatalogDownloadHref(book.downloadLink)}
                            className="ml-auto shrink-0 text-xs text-brand"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Download
                          </ExternalLinkAnchor>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {hasMore ? (
            <div className="border-t border-border bg-muted/20 px-4 py-2.5">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isPending}
                className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
              >
                {isPending ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
