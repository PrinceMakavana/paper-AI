import type { SubjectSummary } from "@/lib/types";

export const SUBJECT_LIST_PAGE_SIZE = 80;
export const SUBJECT_CODE_SEARCH_DEBOUNCE_MS = 300;
export const INVALID_SUBJECT_CODE_SEARCH_PATTERN = /[^A-Z0-9 -]/;
const INVALID_SUBJECT_CODE_SEARCH_PATTERN_GLOBAL = /[^A-Z0-9 -]/g;

export function normalizeSubjectCodeSearch(value: string) {
  return value.trim().toUpperCase();
}

export function getValidatedSubjectCodeSearch(value: string) {
  return normalizeSubjectCodeSearch(value).replace(
    INVALID_SUBJECT_CODE_SEARCH_PATTERN_GLOBAL,
    "",
  );
}

export function filterSubjectsByCode(
  subjects: SubjectSummary[],
  validatedSearchQuery: string,
) {
  if (!validatedSearchQuery) return subjects;

  return subjects.filter((subject) =>
    normalizeSubjectCodeSearch(subject.subjectCode).includes(validatedSearchQuery),
  );
}
