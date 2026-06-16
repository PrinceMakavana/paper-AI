import type { SubjectDetail, SubjectSummary } from "@/lib/types";

export function isSubjectChatReady(subject?: SubjectSummary | SubjectDetail | null) {
  if (!subject) return false;
  const status = subject.pageindexStatus;
  const indexed = subject.indexedBookCount ?? 0;
  return (status === "ready" || status === "partial") && indexed > 0;
}
