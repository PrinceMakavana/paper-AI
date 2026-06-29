import type { SubjectDetail, SubjectSummary } from "@/lib/types";

export function isSubjectChatReady(subject?: SubjectSummary | SubjectDetail | null) {
  return !!subject?.subjectCode;
}
