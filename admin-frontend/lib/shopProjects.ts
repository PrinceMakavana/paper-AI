import { COOKIE_STORAGE_KEYS } from "@/lib/constants";
import { clearSessionStorage, getCookie } from "@/lib/utils";

export type AdminShopImage = {
  id: string;
  url: string;
  originalName?: string;
  sortOrder: number;
};

export type AdminShopProject = {
  slug: string;
  title: string;
  description: string;
  originalPrice: number;
  currentPrice: number;
  active: boolean;
  images: AdminShopImage[];
};

export type AdminShopProjectInput = {
  slug: string;
  title: string;
  description: string;
  originalPrice: number;
  currentPrice: number;
  active: boolean;
};

type ShopProjectsResponse = {
  status?: number;
  projects?: AdminShopProject[];
  project?: AdminShopProject;
  total?: number;
  message?: string;
  deleted?: boolean;
  deactivated?: boolean;
};

export class AdminShopError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AdminShopError";
    this.status = status;
  }
}

function getApiBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new AdminShopError("Admin API is not configured.");
  }

  const apiVersion = process.env.NEXT_PUBLIC_API_VERSION ?? "";
  return `${apiUrl.replace(/\/$/, "")}${apiVersion}`;
}

function resolveImageUrl(url: string) {
  if (!url || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${getApiBaseUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

function mapProject(project: AdminShopProject): AdminShopProject {
  return {
    ...project,
    images: (project.images ?? [])
      .map((image) => ({
        ...image,
        url: resolveImageUrl(image.url),
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

function authHeaders() {
  const token = getCookie(COOKIE_STORAGE_KEYS.ACCESS_TOKEN);
  if (!token) {
    clearSessionStorage();
    throw new AdminShopError("Admin session is missing.", 401);
  }

  return {
    Authorization: `Bearer ${token}`,
    "ngrok-skip-browser-warning": "true",
  };
}

async function readResponse(response: Response) {
  const data = (await response.json().catch(() => ({}))) as ShopProjectsResponse;
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearSessionStorage();
    }

    throw new AdminShopError(data.message || "Shop project request failed.", response.status);
  }

  return data;
}

export async function fetchAdminShopProjects() {
  const response = await fetch(`${getApiBaseUrl()}/admin/shop/projects`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });
  const data = await readResponse(response);

  return {
    projects: (data.projects ?? []).map(mapProject),
    total: data.total ?? data.projects?.length ?? 0,
  };
}

export async function createAdminShopProject(input: AdminShopProjectInput) {
  const response = await fetch(`${getApiBaseUrl()}/admin/shop/projects`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const data = await readResponse(response);
  if (!data.project) {
    throw new AdminShopError("Project was created without a response body.");
  }

  return mapProject(data.project);
}

export async function updateAdminShopProject(
  slug: string,
  input: Partial<AdminShopProjectInput> & { imageOrder?: string[] }
) {
  const response = await fetch(`${getApiBaseUrl()}/admin/shop/projects/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const data = await readResponse(response);
  if (!data.project) {
    throw new AdminShopError("Project was updated without a response body.");
  }

  return mapProject(data.project);
}

export async function uploadAdminShopProjectImages(slug: string, files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  const response = await fetch(
    `${getApiBaseUrl()}/admin/shop/projects/${encodeURIComponent(slug)}/images`,
    {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    }
  );
  const data = await readResponse(response);
  if (!data.project) {
    throw new AdminShopError("Images were uploaded without a response body.");
  }

  return mapProject(data.project);
}

export async function deleteAdminShopProjectImage(slug: string, imageId: string) {
  const response = await fetch(
    `${getApiBaseUrl()}/admin/shop/projects/${encodeURIComponent(slug)}/images/${encodeURIComponent(imageId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );
  const data = await readResponse(response);
  if (!data.project) {
    throw new AdminShopError("Image was removed without a response body.");
  }

  return mapProject(data.project);
}

export async function deleteAdminShopProject(slug: string) {
  const response = await fetch(`${getApiBaseUrl()}/admin/shop/projects/${encodeURIComponent(slug)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await readResponse(response);

  return {
    deleted: data.deleted === true,
    deactivated: data.deactivated === true,
    message: data.message,
    project: data.project ? mapProject(data.project) : undefined,
  };
}
