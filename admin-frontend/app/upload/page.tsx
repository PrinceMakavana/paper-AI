"use client";

import { ArrowLeft, LogOut, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AdminUser } from "@/lib/auth";
import { logoutAdmin } from "@/lib/auth";
import type { AdminCatalogContentType } from "@/lib/catalog";
import { uploadAdminCatalogContent } from "@/lib/catalog";
import { LOCAL_STORAGE_KEYS } from "@/lib/constants";
import { getLocalStorage } from "@/lib/utils";

const CONTENT_TYPE_OPTIONS: { value: AdminCatalogContentType; label: string }[] = [
  { value: "book", label: "Book" },
  { value: "syllabus", label: "Syllabus" },
  { value: "old_paper", label: "Old paper" },
  { value: "paper_solution", label: "Paper solution" },
  { value: "prectical", label: "Practical" },
  { value: "viva_questions", label: "Viva questions" },
  { value: "imp_material", label: "Important material" },
  { value: "assignments", label: "Assignments" },
];

type UploadSource = "file" | "link";

export default function AdminUploadPage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [uploadForm, setUploadForm] = useState({
    subjectCode: "",
    contentType: "syllabus" as AdminCatalogContentType,
    uploadSource: "file" as UploadSource,
    fileLink: "",
    bookId: "",
    title: "",
    img: "",
    altData: "",
    downloadLink: "",
    year: "",
  });
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = getLocalStorage<AdminUser>(LOCAL_STORAGE_KEYS.USER);

    if (storedUser?.isAdmin !== true) {
      logoutAdmin();
      router.replace("/login");
      return;
    }

    setUser(storedUser);
    setIsCheckingSession(false);
  }, [router]);

  function handleLogout() {
    logoutAdmin();
    router.replace("/login");
    router.refresh();
  }

  async function handleUploadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadMessage(null);

    if (!uploadForm.subjectCode.trim()) {
      setUploadMessage("Subject code is required.");
      return;
    }
    if (uploadForm.uploadSource === "file" && uploadFiles.length === 0) {
      setUploadMessage("Select at least one PDF file.");
      return;
    }
    if (uploadForm.uploadSource === "link" && !uploadForm.fileLink.trim()) {
      setUploadMessage("File link is required.");
      return;
    }

    setIsUploading(true);
    try {
      await uploadAdminCatalogContent({
        ...uploadForm,
        subjectCode: uploadForm.subjectCode.trim(),
        fileLink: uploadForm.fileLink.trim(),
        files: uploadForm.uploadSource === "file" ? uploadFiles : [],
      });
      setUploadMessage("Content uploaded successfully.");
      setUploadFiles([]);
      setUploadForm((current) => ({ ...current, fileLink: "" }));
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        router.replace("/login");
        return;
      }

      setUploadMessage(err instanceof Error ? err.message : "Could not upload content.");
    } finally {
      setIsUploading(false);
    }
  }

  const isBookUpload = uploadForm.contentType === "book";
  const isOldPaperUpload = uploadForm.contentType === "old_paper";
  const isFileUpload = uploadForm.uploadSource === "file";
  const allowMultipleFiles = isFileUpload && !isBookUpload && !isOldPaperUpload;

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking admin session...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              paperAI
            </p>
            <h1 className="text-xl font-bold">Upload Catalog Content</h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to subject management
        </Link>

        <form
          onSubmit={handleUploadSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
              <h2 className="mt-2 text-2xl font-bold">Upload Document</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload PDFs for books, syllabus, old papers, solutions, practicals, viva questions, important material, or assignments.
              </p>
            </div>
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Subject code
              <input
                value={uploadForm.subjectCode}
                onChange={(event) => setUploadForm((current) => ({ ...current, subjectCode: event.target.value }))}
                placeholder="e.g. 3110005"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="text-sm font-medium">
              Content type
              <select
                value={uploadForm.contentType}
                onChange={(event) => {
                  setUploadForm((current) => ({
                    ...current,
                    contentType: event.target.value as AdminCatalogContentType,
                  }));
                  setUploadFiles([]);
                }}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
              >
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Upload file type
              <select
                value={uploadForm.uploadSource}
                onChange={(event) => {
                  const uploadSource = event.target.value as UploadSource;
                  setUploadForm((current) => ({
                    ...current,
                    uploadSource,
                    fileLink: uploadSource === "file" ? "" : current.fileLink,
                  }));
                  setUploadFiles([]);
                }}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
              >
                <option value="file">PDF file</option>
                <option value="link">File link</option>
              </select>
            </label>

            {isBookUpload ? (
              <>
                <label className="text-sm font-medium">
                  Book ID
                  <input
                    value={uploadForm.bookId}
                    onChange={(event) => setUploadForm((current) => ({ ...current, bookId: event.target.value }))}
                    placeholder="Unique book ID"
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="text-sm font-medium">
                  Book title
                  <input
                    value={uploadForm.title}
                    onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Book title"
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="text-sm font-medium">
                  Image URL
                  <input
                    value={uploadForm.img}
                    onChange={(event) => setUploadForm((current) => ({ ...current, img: event.target.value }))}
                    placeholder="Optional image URL"
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="text-sm font-medium">
                  Download link
                  <input
                    value={uploadForm.downloadLink}
                    onChange={(event) => setUploadForm((current) => ({ ...current, downloadLink: event.target.value }))}
                    placeholder="Optional public link"
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="text-sm font-medium md:col-span-2">
                  Alt data
                  <input
                    value={uploadForm.altData}
                    onChange={(event) => setUploadForm((current) => ({ ...current, altData: event.target.value }))}
                    placeholder="Optional alternate description"
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
              </>
            ) : null}

            {isOldPaperUpload ? (
              <label className="text-sm font-medium">
                Paper year
                <input
                  value={uploadForm.year}
                  onChange={(event) => setUploadForm((current) => ({ ...current, year: event.target.value }))}
                  placeholder="e.g. Summer 2024"
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
            ) : null}

            {!isBookUpload && !isOldPaperUpload ? (
              <label className="text-sm font-medium">
                Title
                <input
                  value={uploadForm.title}
                  onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Optional title for uploaded files"
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
            ) : null}

            {isFileUpload ? (
              <label key="pdf-file-upload" className="text-sm font-medium md:col-span-2">
                PDF files
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple={allowMultipleFiles}
                  onChange={(event) => setUploadFiles(Array.from(event.target.files ?? []))}
                  className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
                />
              </label>
            ) : (
              <label key="file-link-upload" className="text-sm font-medium md:col-span-2">
                File link
                <input
                  value={uploadForm.fileLink}
                  onChange={(event) => setUploadForm((current) => ({ ...current, fileLink: event.target.value }))}
                  placeholder="https://example.com/file.pdf or s3://bucket/path/file.pdf"
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isFileUpload
                ? uploadFiles.length > 0
                  ? `${uploadFiles.length} file${uploadFiles.length === 1 ? "" : "s"} selected`
                  : allowMultipleFiles
                    ? "Subject-level materials support multiple PDFs."
                    : "This content type accepts one PDF."
                : "Paste a direct PDF link instead of uploading a local file."}
            </p>
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Uploading..." : "Upload content"}
            </button>
          </div>

          {uploadMessage ? (
            <p className="mt-3 text-sm text-muted-foreground">{uploadMessage}</p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
