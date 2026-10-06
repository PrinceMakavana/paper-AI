import type { SubjectSummary } from "@/lib/types";

type PublicSubjectsResponse = {
  subjects?: SubjectSummary[];
};

export type PublicSubjectsResult =
  | { status: "ok"; subjects: SubjectSummary[] }
  | { status: "error"; message: string };

function buildApiUrl(path: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const apiVersion = process.env.NEXT_PUBLIC_API_VERSION ?? "";

  if (!apiBase) {
    return undefined;
  }

  return `${apiBase.replace(/\/$/, "")}${apiVersion}${path}`;
}

export function getCatalogApiHeaders() {
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };
  const secret = process.env.PUBLIC_CATALOG_API_SECRET;

  if (secret) {
    headers["x-paperai-catalog-secret"] = secret;
  }

  return headers;
}

export async function fetchPublicSubjects(
  init?: RequestInit,
): Promise<PublicSubjectsResult> {
  const url = buildApiUrl("/public/catalog/subjects");

  if (!url) {
    return {
      status: "error",
      message: "Catalog API is not configured.",
    };
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...getCatalogApiHeaders(),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch public catalog subjects: ${response.status} ${response.statusText}`,
      );

      return {
        status: "error",
        message: "Unable to load GTU subjects right now.",
      };
    }

    const data = (await response.json()) as PublicSubjectsResponse;
    return {
      status: "ok",
      subjects: (data.subjects ?? []).filter((subject) => subject.subjectCode),
    };
  } catch (error) {
    console.error("Error fetching public catalog subjects:", error);

    return {
      status: "error",
      message: "Unable to connect to the catalog service.",
    };
  }
}

export async function getAllPublicSubjects(): Promise<SubjectSummary[]> {
  const result = await fetchPublicSubjects({ cache: "force-cache" });
  return result.status === "ok" ? result.subjects : [];
}
