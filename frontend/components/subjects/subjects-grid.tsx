"use client";

import { useDebounce } from "@/hooks/use-debounce";
import type { SubjectSummary } from "@/lib/types";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

const PAGE_SIZE = 80;
const SEARCH_DEBOUNCE_MS = 300;
const INVALID_SUBJECT_CODE_SEARCH_PATTERN = /[^A-Z0-9 -]/;
const INVALID_SUBJECT_CODE_SEARCH_PATTERN_GLOBAL = /[^A-Z0-9 -]/g;

function normalizeSubjectCodeSearch(value: string) {
  return value.trim().toUpperCase();
}

function getValidatedSearchQuery(value: string) {
  return normalizeSubjectCodeSearch(value).replace(
    INVALID_SUBJECT_CODE_SEARCH_PATTERN_GLOBAL,
    "",
  );
}

function SubjectCard({ subject }: { subject: SubjectSummary }) {
  return (
    <Link
      href={`/subjects/${encodeURIComponent(subject.subjectCode)}`}
      className="group rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition hover:border-brand/60 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-foreground group-hover:text-brand">
            {subject.subjectCode}
          </p>
          <h2 className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-foreground">
            {subject.subjectName}
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-2 text-[0.65rem] font-semibold uppercase tracking-wide `}
        >
          <ExternalLink className="size-4 text-muted-foreground" />
        </span>
      </div>

      {subject.knownAs ? (
        <p className="mt-2 text-xs text-muted-foreground">{subject.knownAs}</p>
      ) : null}
    </Link>
  );
}

export function SubjectsGrid({ subjects }: { subjects: SubjectSummary[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const normalizedSearchQuery = normalizeSubjectCodeSearch(searchQuery);
  const hasInvalidSearchCharacters = INVALID_SUBJECT_CODE_SEARCH_PATTERN.test(
    normalizedSearchQuery,
  );
  const validatedSearchQuery = useMemo(
    () => getValidatedSearchQuery(debouncedSearchQuery),
    [debouncedSearchQuery],
  );
  const filteredSubjects = useMemo(() => {
    if (!validatedSearchQuery) return subjects;

    return subjects.filter((subject) =>
      normalizeSubjectCodeSearch(subject.subjectCode).includes(validatedSearchQuery),
    );
  }, [subjects, validatedSearchQuery]);
  const visibleSubjects = useMemo(
    () => filteredSubjects.slice(0, visibleCount),
    [filteredSubjects, visibleCount],
  );
  const hasMore = visibleCount < filteredSubjects.length;
  const hasActiveSearch = validatedSearchQuery.length > 0;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [validatedSearchQuery]);

  const handleLoadMore = () => {
    startTransition(() => {
      setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredSubjects.length));
    });
  };

  if (subjects.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-foreground">No subjects available</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          GTU subject materials will appear here when the catalog is ready.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 max-w-md">
        <label
          htmlFor="subject-code-search"
          className="text-sm font-medium text-foreground"
        >
          Search by subject code
        </label>
        <input
          id="subject-code-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value.toUpperCase())}
          placeholder="Search by subject code"
          aria-invalid={hasInvalidSearchCharacters}
          aria-describedby={
            hasInvalidSearchCharacters ? "subject-code-search-error" : undefined
          }
          className="mt-2 w-full rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-[var(--shadow-card)] outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        {hasInvalidSearchCharacters ? (
          <p
            id="subject-code-search-error"
            className="mt-2 text-xs text-destructive"
          >
            Use only letters, numbers, spaces, and hyphens for subject codes.
          </p>
        ) : null}
      </div>

      {filteredSubjects.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-foreground">No matching subjects</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another GTU subject code.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleSubjects.map((subject) => (
            <SubjectCard key={subject.subjectCode} subject={subject} />
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {visibleSubjects.length} of {filteredSubjects.length}
          {hasActiveSearch ? ` matching` : ""} subjects
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
