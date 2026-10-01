import { cache } from "react";

export type Project = {
  slug: string;
  title: string;
  description: string;
  originalPrice: number;
  currentPrice: number;
  images: string[];
};

type PublicProject = {
  slug?: string;
  title?: string;
  description?: string;
  originalPrice?: number;
  currentPrice?: number;
  images?: string[];
};

type PublicProjectsResponse = {
  projects?: PublicProject[];
  project?: PublicProject;
  message?: string;
};

export type ProjectsResult =
  | { status: "ok"; projects: Project[] }
  | { status: "error"; message: string };

export type ProjectLookup =
  | { status: "ok"; project: Project }
  | { status: "not_found" }
  | { status: "error"; message: string };

function getApiBaseUrl() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const apiVersion = process.env.NEXT_PUBLIC_API_VERSION ?? "";

  if (!apiBase) {
    return undefined;
  }

  return `${apiBase.replace(/\/$/, "")}${apiVersion}`;
}

function buildApiUrl(path: string) {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return undefined;
  }

  return `${apiBase}${path}`;
}

export function resolveShopImageUrl(url: string) {
  if (!url || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return url;
  }

  return `${apiBase}${url.startsWith("/") ? url : `/${url}`}`;
}

function mapProject(project: PublicProject): Project | null {
  if (!project.slug || !project.title) {
    return null;
  }

  return {
    slug: project.slug,
    title: project.title,
    description: project.description ?? "",
    originalPrice: Number(project.originalPrice ?? 0),
    currentPrice: Number(project.currentPrice ?? 0),
    images: (project.images ?? []).map(resolveShopImageUrl),
  };
}

export async function fetchPublicProjects(init?: RequestInit): Promise<ProjectsResult> {
  const url = buildApiUrl("/public/shop/projects");

  if (!url) {
    return {
      status: "error",
      message: "Projects API is not configured.",
    };
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "ngrok-skip-browser-warning": "true",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch public shop projects: ${response.status} ${response.statusText}`,
      );

      return {
        status: "error",
        message: "Unable to load projects right now.",
      };
    }

    const data = (await response.json()) as PublicProjectsResponse;
    return {
      status: "ok",
      projects: (data.projects ?? [])
        .map(mapProject)
        .filter((project): project is Project => project !== null),
    };
  } catch (error) {
    console.error("Error fetching public shop projects:", error);

    return {
      status: "error",
      message: "Unable to connect to the projects service.",
    };
  }
}

export async function getAllProjects(): Promise<Project[]> {
  const result = await fetchPublicProjects({ cache: "force-cache" });
  return result.status === "ok" ? result.projects : [];
}

export const getProjectBySlug = cache(async (slug: string): Promise<ProjectLookup> => {
  const url = buildApiUrl(`/public/shop/projects/${encodeURIComponent(slug)}`);

  if (!url) {
    return {
      status: "error",
      message: "Projects API is not configured.",
    };
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (response.status === 404) {
      return { status: "not_found" };
    }

    if (!response.ok) {
      console.error(
        `Failed to fetch shop project ${slug}: ${response.status} ${response.statusText}`,
      );

      return {
        status: "error",
        message: "Unable to load this project right now.",
      };
    }

    const data = (await response.json()) as PublicProjectsResponse;
    const project = data.project ? mapProject(data.project) : null;
    if (!project) {
      return { status: "not_found" };
    }

    return { status: "ok", project };
  } catch (error) {
    console.error(`Error fetching shop project ${slug}:`, error);

    return {
      status: "error",
      message: "Unable to connect to the projects service.",
    };
  }
});

export function discountPercent(originalPrice: number, currentPrice: number): number {
  if (!originalPrice || originalPrice <= 0 || currentPrice >= originalPrice) {
    return 0;
  }
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
