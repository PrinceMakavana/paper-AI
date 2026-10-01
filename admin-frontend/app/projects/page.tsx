"use client";

import { ArrowDown, ArrowLeft, ArrowUp, LogOut, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AdminUser } from "@/lib/auth";
import { logoutAdmin } from "@/lib/auth";
import type { AdminShopProject, AdminShopProjectInput } from "@/lib/shopProjects";
import {
  createAdminShopProject,
  deleteAdminShopProject,
  deleteAdminShopProjectImage,
  fetchAdminShopProjects,
  updateAdminShopProject,
  uploadAdminShopProjectImages,
} from "@/lib/shopProjects";
import { LOCAL_STORAGE_KEYS } from "@/lib/constants";
import { getLocalStorage } from "@/lib/utils";

const EMPTY_FORM: AdminShopProjectInput = {
  slug: "",
  title: "",
  description: "",
  originalPrice: 0,
  currentPrice: 1,
  active: true,
};

function projectToForm(project: AdminShopProject): AdminShopProjectInput {
  return {
    slug: project.slug,
    title: project.title,
    description: project.description,
    originalPrice: project.originalPrice,
    currentPrice: project.currentPrice,
    active: project.active,
  };
}

export default function AdminProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [projects, setProjects] = useState<AdminShopProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<AdminShopProjectInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const editingProject = projects.find((project) => project.slug === editingSlug) ?? null;

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

  async function loadProjects() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchAdminShopProjects();
      setProjects(response.projects);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        router.replace("/login");
        return;
      }

      setError(err instanceof Error ? err.message : "Could not load projects.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isCheckingSession) {
      return;
    }

    loadProjects();
  }, [isCheckingSession]);

  function handleLogout() {
    logoutAdmin();
    router.replace("/login");
    router.refresh();
  }

  function startCreate() {
    setIsCreating(true);
    setEditingSlug(null);
    setForm(EMPTY_FORM);
    setUploadFiles([]);
    setMessage(null);
  }

  function startEdit(project: AdminShopProject) {
    setIsCreating(false);
    setEditingSlug(project.slug);
    setForm(projectToForm(project));
    setUploadFiles([]);
    setMessage(null);
  }

  function replaceProject(project: AdminShopProject) {
    setProjects((current) => {
      const exists = current.some((item) => item.slug === project.slug);
      if (!exists) {
        return [...current.filter((item) => item.slug !== editingSlug), project];
      }

      return current.map((item) => (item.slug === editingSlug || item.slug === project.slug ? project : item));
    });
    setEditingSlug(project.slug);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);

    try {
      if (isCreating) {
        const created = await createAdminShopProject(form);
        setProjects((current) => [...current, created]);
        setIsCreating(false);
        setEditingSlug(created.slug);
        setForm(projectToForm(created));
        setMessage("Project created. You can upload images below.");
        return;
      }

      if (!editingSlug) {
        return;
      }

      const updated = await updateAdminShopProject(editingSlug, form);
      replaceProject(updated);
      setForm(projectToForm(updated));
      setMessage("Project saved.");
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        router.replace("/login");
        return;
      }

      setMessage(err instanceof Error ? err.message : "Could not save the project.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUploadImages() {
    if (!editingSlug || uploadFiles.length === 0) {
      setMessage("Choose at least one image to upload.");
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const updated = await uploadAdminShopProjectImages(editingSlug, uploadFiles);
      replaceProject(updated);
      setUploadFiles([]);
      setMessage("Images uploaded.");
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        router.replace("/login");
        return;
      }

      setMessage(err instanceof Error ? err.message : "Could not upload images.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!editingSlug) {
      return;
    }

    setMessage(null);
    try {
      const updated = await deleteAdminShopProjectImage(editingSlug, imageId);
      replaceProject(updated);
      setMessage("Image removed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not remove the image.");
    }
  }

  async function handleMoveImage(index: number, direction: -1 | 1) {
    if (!editingProject) {
      return;
    }

    const images = [...editingProject.images];
    const target = index + direction;
    if (target < 0 || target >= images.length) {
      return;
    }

    const [moved] = images.splice(index, 1);
    images.splice(target, 0, moved);
    setMessage(null);

    try {
      const updated = await updateAdminShopProject(editingProject.slug, {
        imageOrder: images.map((image) => image.id),
      });
      replaceProject(updated);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not reorder images.");
    }
  }

  async function handleDeleteProject(project: AdminShopProject) {
    const confirmed = window.confirm(
      `Remove ${project.title}? If it has orders, it will be deactivated instead of deleted.`
    );
    if (!confirmed) {
      return;
    }

    setMessage(null);
    try {
      const result = await deleteAdminShopProject(project.slug);
      if (result.deactivated && result.project) {
        setProjects((current) =>
          current.map((item) => (item.slug === project.slug ? result.project! : item))
        );
        if (editingSlug === project.slug) {
          setForm(projectToForm(result.project));
        }
        setMessage(result.message || "Project deactivated.");
        return;
      }

      setProjects((current) => current.filter((item) => item.slug !== project.slug));
      if (editingSlug === project.slug) {
        setEditingSlug(null);
        setForm(EMPTY_FORM);
      }
      setMessage("Project deleted.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not remove the project.");
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking admin session...</p>
      </main>
    );
  }

  const showForm = isCreating || editingProject;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              paperAI
            </p>
            <h1 className="text-xl font-bold">Shop Projects</h1>
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

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to subject management
          </Link>
          <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold">Project catalog</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Create and edit shop projects stored in MongoDB. Prices used at checkout come from these records. Gallery images upload to S3.
              </p>
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              New project
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-border bg-card shadow-sm h-fit">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No projects yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {projects.map((project) => (
                  <li key={project.slug} className="flex items-start justify-between gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => startEdit(project)}
                      className="min-w-0 text-left"
                    >
                      <p className="font-semibold">{project.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{project.slug}</p>
                      <p className="mt-2 text-sm">
                        ₹{project.currentPrice}
                        {project.originalPrice > project.currentPrice ? (
                          <span className="ml-2 text-muted-foreground line-through">
                            ₹{project.originalPrice}
                          </span>
                        ) : null}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                          project.active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {project.active ? "Active" : "Inactive"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(project)}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Remove ${project.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {showForm ? (
            <form
              onSubmit={handleSave}
              className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <h3 className="text-lg font-bold">{isCreating ? "New project" : "Edit project"}</h3>
              <label className="block text-sm font-medium">
                Slug
                <input
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="document-ai"
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block text-sm font-medium">
                Title
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block text-sm font-medium">
                Description
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Original price (INR)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.originalPrice}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, originalPrice: Number(event.target.value) }))
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="text-sm font-medium">
                  Current price (INR)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.currentPrice}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, currentPrice: Number(event.target.value) }))
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                />
                Active on the store
              </label>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : isCreating ? "Create project" : "Save changes"}
              </button>

              {editingProject ? (
                <div className="space-y-3 border-t border-border pt-4">
                  <h4 className="text-sm font-semibold">Gallery images</h4>
                  {editingProject.images.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No images uploaded yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {editingProject.images.map((image, index) => (
                        <li
                          key={image.id}
                          className="flex items-center gap-3 rounded-lg border border-border p-2"
                        >
                          {/* Remote S3-backed URLs are served by the API host. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.url}
                            alt={image.originalName || editingProject.title}
                            className="h-14 w-20 rounded-md object-cover"
                          />
                          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {image.originalName || image.id}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleMoveImage(index, -1)}
                            disabled={index === 0}
                            className="rounded-md border border-border p-1.5 disabled:opacity-40"
                            aria-label="Move image earlier"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveImage(index, 1)}
                            disabled={index === editingProject.images.length - 1}
                            className="rounded-md border border-border p-1.5 disabled:opacity-40"
                            aria-label="Move image later"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(image.id)}
                            className="rounded-md border border-border p-1.5"
                            aria-label="Remove image"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className="block text-sm font-medium">
                    Upload PNG, JPEG, or WebP
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      onChange={(event) => setUploadFiles(Array.from(event.target.files ?? []))}
                      className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleUploadImages}
                    disabled={isUploading || uploadFiles.length === 0}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUploading ? "Uploading..." : "Upload images"}
                  </button>
                </div>
              ) : null}
            </form>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
              Select a project to edit it, or create a new one.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
