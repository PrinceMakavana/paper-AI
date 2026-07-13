import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";

type PublicSubjectSummary = {
  subjectCode: string;
  subjectName?: string;
  knownAs?: string;
  pageindexStatus?: string;
};

type PublicSubjectsResponse = {
  subjects?: PublicSubjectSummary[];
};

const STATIC_ROUTES = [
  "",
  "/about",
  "/contact",
  "/contribute",
  "/subjects",
  "/privacy",
  "/terms",
  "/disclaimer",
];

export const dynamic = "force-static";

function buildApiUrl(path: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const apiVersion = process.env.NEXT_PUBLIC_API_VERSION ?? "";

  if (!apiBase) {
    return undefined;
  }

  return `${apiBase.replace(/\/$/, "")}${apiVersion}${path}`;
}

function getCatalogApiHeaders() {
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };
  const secret = process.env.PUBLIC_CATALOG_API_SECRET;

  if (secret) {
    headers["x-paperai-catalog-secret"] = secret;
  }

  return headers;
}

async function fetchPublicSubjects() {
  const url = buildApiUrl("/public/catalog/subjects");

  if (!url) {
    return [];
  }

  try {
    const response = await fetch(url, {
      cache: "force-cache",
      headers: getCatalogApiHeaders(),
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch public catalog subjects for sitemap: ${response.status} ${response.statusText}`,
      );

      return [];
    }

    const data = (await response.json()) as PublicSubjectsResponse;
    return data.subjects ?? [];
  } catch (error) {
    console.error("Error fetching public catalog subjects for sitemap:", error);

    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const subjects = await fetchPublicSubjects();

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.7,
  }));

  const subjectEntries = subjects
    .filter((subject) => subject.subjectCode)
    .map((subject) => ({
      url: `${siteUrl}/subjects/${encodeURIComponent(subject.subjectCode)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: subject.pageindexStatus === "ready" ? 0.9 : 0.8,
    }));

  return [...staticEntries, ...subjectEntries];
}
