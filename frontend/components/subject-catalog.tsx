"use client";

import { ExternalLinkAnchor } from "@/components/external-link-anchor";
import type { CatalogBook, SubjectDetail, SubjectSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

interface SubjectCatalogProps {
  subjects: SubjectSummary[];
  loading?: boolean;
  currentSubjectCode?: string;
  subjectDetail?: SubjectDetail;
  onSelect: (subjectCode: string) => void;
}

function isCatalogSubjectVisible(subject: SubjectSummary): boolean {
  const status = subject.pageindexStatus;
  return status === "ready" || status === "partial";
}

function isCatalogBookVisible(book: CatalogBook): boolean {
  return book.pageindexStatus === "ready";
}

function matchesSubjectSearch(subject: SubjectSummary, query: string): boolean {
  const haystack = [subject.subjectName, subject.subjectCode, subject.knownAs]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function SubjectCatalog({
  subjects,
  loading,
  currentSubjectCode,
  subjectDetail,
  onSelect,
}: SubjectCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleSubjects = useMemo(
    () => subjects.filter(isCatalogSubjectVisible),
    [subjects],
  );

  const filteredSubjects = useMemo(() => {
    if (!normalizedQuery) {
      return visibleSubjects;
    }
    return visibleSubjects.filter((subject) => matchesSubjectSearch(subject, normalizedQuery));
  }, [visibleSubjects, normalizedQuery]);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] ed-sidebar-panel">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <h2 className="shrink-0 text-sm font-medium text-foreground">Subjects</h2>
        {visibleSubjects.length > 0 && !loading && (
          <div className="relative min-w-0 flex-1">
            <Search
              size={12}
              aria-hidden
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search subjects"
              className="h-7 w-full rounded-lg border border-border bg-background py-0 pl-7 pr-7 text-xs text-foreground outline-none focus:border-brand"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 flex size-[18px] -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
        {visibleSubjects.length > 0 && !loading && (
          <span className="shrink-0 whitespace-nowrap text-[0.6875rem] text-muted-foreground">
            {normalizedQuery
              ? `${filteredSubjects.length} of ${visibleSubjects.length}`
              : `${visibleSubjects.length} ${visibleSubjects.length === 1 ? "subject" : "subjects"}`}
          </span>
        )}
      </div>

      {loading ? (
        <div className="ed-sidebar-panel__body ed-panel-scroll flex items-center gap-2 p-4 text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : visibleSubjects.length === 0 ? (
        <p className="ed-sidebar-panel__body ed-panel-scroll p-4 text-sm leading-relaxed text-muted-foreground">
          No subjects available.
        </p>
      ) : filteredSubjects.length === 0 ? (
        <p className="ed-sidebar-panel__body ed-panel-scroll p-4 text-sm leading-relaxed text-muted-foreground">
          No subjects match &ldquo;{searchQuery.trim()}&rdquo;.
        </p>
      ) : (
        <div className="ed-sidebar-panel__body ed-panel-scroll">
          {filteredSubjects.map((subject) => {
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
                  "cursor-pointer border-b border-border px-4 py-3 transition-colors last:border-b-0",
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
                            href={book.downloadLink}
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
        </div>
      )}
    </div>
  );
}
