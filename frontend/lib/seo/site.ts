export const SITE_NAME = "paperAI";

export const SITE_TITLE = "paperAI — AI-Powered GTU Paper Solutions & PDF Chat";

export const SITE_DESCRIPTION =
  "Find GTU syllabus, old exam papers, books, and paper solutions, then upload PDFs to generate AI answers, summaries, and document-grounded chat.";

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getSubjectPath(subjectCode: string) {
  return `/subjects/${encodeURIComponent(subjectCode)}`;
}

export function getSubjectUrl(subjectCode: string) {
  return `${getSiteUrl()}${getSubjectPath(subjectCode)}`;
}
