import { getToken } from "@/lib/utils";
import type { SubjectDetail, SubjectSummary } from "@/lib/types";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  "Access-Control-Allow-Origin": "*",
  "ngrok-skip-browser-warning": "true",
});

export async function fetchSubjects(): Promise<SubjectSummary[]> {
  const response = await fetch(`${BACKEND_API_URL}/catalog/subjects`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to load subjects");
  }
  return data.subjects ?? [];
}

export async function fetchSubject(subjectCode: string): Promise<SubjectDetail> {
  const response = await fetch(
    `${BACKEND_API_URL}/catalog/subjects/${encodeURIComponent(subjectCode)}`,
    { headers: getAuthHeaders() },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to load subject");
  }
  return data.subject;
}

export async function fetchCatalogBookPdfUrl(
  subjectCode: string,
  bookId: string,
): Promise<string> {
  const response = await fetch(
    `${BACKEND_API_URL}/catalog/subjects/${encodeURIComponent(subjectCode)}/books/${encodeURIComponent(bookId)}/pdf-url`,
    { headers: getAuthHeaders() },
  );
  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data.message || "Failed to open PDF");
  }
  return data.url;
}

export function isSubjectChatReady(subject?: SubjectSummary | SubjectDetail | null) {
  if (!subject) return false;
  const status = subject.pageindexStatus;
  const indexed = subject.indexedBookCount ?? 0;
  return (status === "ready" || status === "partial") && indexed > 0;
}
