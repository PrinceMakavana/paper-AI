import { COOKIE_STORAGE_KEYS } from "@/lib/constants";
import { clearSessionStorage, getCookie } from "@/lib/utils";

export type PageindexStatus = "ready" | "partial" | "pending" | "failed" | string;

export type AdminOldPaper = {
  year?: string;
  link?: string;
};

export type AdminMaterialFile = {
  title?: string;
  originalName?: string;
  storagePath?: string;
  s3Uri?: string;
  url?: string;
  uploadedAt?: string;
};

export type AdminBook = {
  bookId?: string;
  title?: string;
  img?: string;
  altData?: string;
  downloadLink?: string;
  pageindexStatus?: PageindexStatus;
  pageindexSizeBytes?: number;
  pageindexS3Uri?: string;
  pdfStoragePath?: string;
  pdfS3Uri?: string;
  tokenCount?: number;
  indexedAt?: string;
  indexVersion?: number;
};

export type AdminSubject = {
  subjectCode: string;
  subjectName?: string;
  knownAs?: string;
  pageindexStatus?: PageindexStatus;
  indexedBookCount?: number;
  bookCount?: number;
  chatMode?: string;
  primaryBookId?: string;
  syllabus?: AdminMaterialFile[];
  paperSolution?: AdminMaterialFile[];
  prectical?: AdminMaterialFile[];
  vivaQuestions?: AdminMaterialFile[];
  impMaterial?: AdminMaterialFile[];
  assignments?: AdminMaterialFile[];
  oldPaper?: AdminOldPaper[];
  books?: AdminBook[];
};

export type AdminSubjectsResponse = {
  status: number;
  subjects: AdminSubject[];
  total: number;
  message?: string;
};

export class AdminCatalogError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AdminCatalogError";
    this.status = status;
  }
}

export type AdminCatalogContentType =
  | "book"
  | "syllabus"
  | "old_paper"
  | "paper_solution"
  | "prectical"
  | "viva_questions"
  | "imp_material"
  | "assignments";

export type AdminCatalogUploadSource = "file" | "link";

export type UploadAdminCatalogContentInput = {
  subjectCode: string;
  contentType: AdminCatalogContentType;
  uploadSource?: AdminCatalogUploadSource;
  fileLink?: string;
  files: File[];
  bookId?: string;
  title?: string;
  img?: string;
  altData?: string;
  downloadLink?: string;
  year?: string;
};

export type UploadAdminCatalogContentResponse = {
  status: number;
  subject: AdminSubject;
  uploadedFiles: AdminMaterialFile[];
  message?: string;
};

function getApiBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new AdminCatalogError("Admin API is not configured.");
  }

  const apiVersion = process.env.NEXT_PUBLIC_API_VERSION ?? "";
  return `${apiUrl.replace(/\/$/, "")}${apiVersion}`;
}

export async function fetchAdminSubjects() {
  const token = getCookie(COOKIE_STORAGE_KEYS.ACCESS_TOKEN);

  if (!token) {
    clearSessionStorage();
    throw new AdminCatalogError("Admin session is missing.", 401);
  }

  const response = await fetch(`${getApiBaseUrl()}/admin/catalog/subjects`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
    },
  });

  const data = (await response.json().catch(() => ({}))) as Partial<AdminSubjectsResponse>;

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearSessionStorage();
    }

    throw new AdminCatalogError(
      data.message || "Could not load admin subject data.",
      response.status
    );
  }

  return {
    status: data.status ?? response.status,
    subjects: data.subjects ?? [],
    total: data.total ?? data.subjects?.length ?? 0,
  };
}

export async function uploadAdminCatalogContent(input: UploadAdminCatalogContentInput) {
  const token = getCookie(COOKIE_STORAGE_KEYS.ACCESS_TOKEN);

  if (!token) {
    clearSessionStorage();
    throw new AdminCatalogError("Admin session is missing.", 401);
  }

  const formData = new FormData();
  formData.append("contentType", input.contentType);
  formData.append("uploadSource", input.uploadSource ?? "file");

  if (input.bookId) formData.append("bookId", input.bookId);
  if (input.title) formData.append("title", input.title);
  if (input.img) formData.append("img", input.img);
  if (input.altData) formData.append("altData", input.altData);
  if (input.downloadLink) formData.append("downloadLink", input.downloadLink);
  if (input.fileLink) formData.append("fileLink", input.fileLink);
  if (input.year) formData.append("year", input.year);

  input.files.forEach((file) => formData.append("files", file));

  const response = await fetch(
    `${getApiBaseUrl()}/admin/catalog/subjects/${encodeURIComponent(input.subjectCode)}/content/upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
      body: formData,
    }
  );

  const data = (await response.json().catch(() => ({}))) as Partial<UploadAdminCatalogContentResponse>;

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearSessionStorage();
    }

    throw new AdminCatalogError(
      data.message || "Could not upload admin catalog content.",
      response.status
    );
  }

  return {
    status: data.status ?? response.status,
    subject: data.subject,
    uploadedFiles: data.uploadedFiles ?? [],
  } as UploadAdminCatalogContentResponse;
}
