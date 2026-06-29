"use client";

import { useDebounce } from "@/hooks/use-debounce";
import {
  SUBJECT_CODE_SEARCH_DEBOUNCE_MS,
  SUBJECT_LIST_PAGE_SIZE,
  INVALID_SUBJECT_CODE_SEARCH_PATTERN,
  filterSubjectsByCode,
  getValidatedSubjectCodeSearch,
  normalizeSubjectCodeSearch,
} from "@/lib/subjectCodeSearch";
import type { SubjectSummary } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

export function useSubjectListBrowse(subjects: SubjectSummary[]) {
  const [visibleCount, setVisibleCount] = useState(SUBJECT_LIST_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const debouncedSearchQuery = useDebounce(searchQuery, SUBJECT_CODE_SEARCH_DEBOUNCE_MS);
  const normalizedSearchQuery = normalizeSubjectCodeSearch(searchQuery);
  const hasInvalidSearchCharacters = INVALID_SUBJECT_CODE_SEARCH_PATTERN.test(
    normalizedSearchQuery,
  );
  const validatedSearchQuery = useMemo(
    () => getValidatedSubjectCodeSearch(debouncedSearchQuery),
    [debouncedSearchQuery],
  );
  const filteredSubjects = useMemo(
    () => filterSubjectsByCode(subjects, validatedSearchQuery),
    [subjects, validatedSearchQuery],
  );
  const visibleSubjects = useMemo(
    () => filteredSubjects.slice(0, visibleCount),
    [filteredSubjects, visibleCount],
  );
  const hasMore = visibleCount < filteredSubjects.length;
  const hasActiveSearch = validatedSearchQuery.length > 0;

  useEffect(() => {
    setVisibleCount(SUBJECT_LIST_PAGE_SIZE);
  }, [validatedSearchQuery]);

  const handleLoadMore = () => {
    startTransition(() => {
      setVisibleCount((current) =>
        Math.min(current + SUBJECT_LIST_PAGE_SIZE, filteredSubjects.length),
      );
    });
  };

  const ensureSubjectVisible = useCallback((subjectCode?: string) => {
    if (!subjectCode) return;
    setVisibleCount((current) => {
      const index = filteredSubjects.findIndex((subject) => subject.subjectCode === subjectCode);
      if (index >= 0 && index >= current) {
        return index + 1;
      }
      return current;
    });
  }, [filteredSubjects]);

  return {
    searchQuery,
    setSearchQuery,
    hasInvalidSearchCharacters,
    validatedSearchQuery,
    filteredSubjects,
    visibleSubjects,
    hasMore,
    hasActiveSearch,
    isPending,
    handleLoadMore,
    ensureSubjectVisible,
  };
}
