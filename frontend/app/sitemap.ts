import type { MetadataRoute } from "next";
import { getAllProjects } from "@/lib/projects";
import { getAllPublicSubjects } from "@/lib/seo/public-catalog";
import { getSiteUrl } from "@/lib/seo/site";

const STATIC_ROUTES = [
  "",
  "/about",
  "/contact",
  "/contribute",
  "/subjects",
  "/paper-solution",
  "/projects",
  "/privacy",
  "/terms",
  "/disclaimer",
];

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const subjects = await getAllPublicSubjects();

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.7,
  }));

  const subjectEntries = subjects.map((subject) => ({
    url: `${siteUrl}/subjects/${encodeURIComponent(subject.subjectCode)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: subject.pageindexStatus === "ready" ? 0.9 : 0.8,
  }));

  const projects = await getAllProjects();
  const projectEntries = projects.map((project) => ({
    url: `${siteUrl}/projects/${encodeURIComponent(project.slug)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...subjectEntries, ...projectEntries];
}
