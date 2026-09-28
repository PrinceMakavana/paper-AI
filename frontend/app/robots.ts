import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";

const DISALLOWED_ROUTES = [
  "/chat",
  "/profile",
];

const PUBLIC_ALLOW_ROUTES = [
  "/",
  "/subjects/",
  "/subjects",
  "/paper-solution",
  "/about",
  "/contact",
  "/contribute",
  "/privacy",
  "/terms",
  "/disclaimer",
];

const AI_USER_AGENTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  let host: string | undefined;
  try {
    host = new URL(siteUrl).host;
  } catch {
    host = undefined;
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_ROUTES,
      },
      ...AI_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: PUBLIC_ALLOW_ROUTES,
        disallow: DISALLOWED_ROUTES,
      })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    ...(host ? { host } : {}),
  };
}
