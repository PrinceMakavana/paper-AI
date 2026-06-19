"use client";

import { ChevronDown, Database, LogOut, Search, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { AdminUser } from "@/lib/auth";
import { logoutAdmin } from "@/lib/auth";
import type { AdminSubject } from "@/lib/catalog";
import { fetchAdminSubjects } from "@/lib/catalog";
import { LOCAL_STORAGE_KEYS } from "@/lib/constants";
import { getLocalStorage } from "@/lib/utils";

const STATUS_FILTERS = ["all", "ready", "partial", "pending", "failed"] as const;

function normalize(value?: string) {
  return String(value || "").trim().toLowerCase();
}

function getStatusLabel(status?: string) {
  return status || "pending";
}

function getStatusClass(status?: string) {
  switch (status) {
    case "ready":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "partial":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "failed":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function getMaterialCount(value?: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }

  return value ? 1 : 0;
}

function StatusBadge({ status }: { status?: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusClass(status)}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function AvailabilityBadge({ label, isAvailable }: { label: string; isAvailable: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
        isAvailable
          ? "bg-blue-50 text-blue-700 ring-blue-200"
          : "bg-slate-50 text-slate-500 ring-slate-200"
      }`}
    >
      {label}: {isAvailable ? "Yes" : "No"}
    </span>
  );
}

export default function AdminHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [expandedSubjectCode, setExpandedSubjectCode] = useState<string | null>(null);

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

  async function loadSubjects() {
    setIsLoadingSubjects(true);
    setError(null);

    try {
      const response = await fetchAdminSubjects();
      setSubjects(response.subjects);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        router.replace("/login");
        return;
      }

      setError(err instanceof Error ? err.message : "Could not load subject data.");
    } finally {
      setIsLoadingSubjects(false);
    }
  }

  useEffect(() => {
    if (isCheckingSession) {
      return;
    }

    loadSubjects();
  }, [isCheckingSession]);

  const summary = useMemo(() => {
    return subjects.reduce(
      (acc, subject) => {
        const status = getStatusLabel(subject.pageindexStatus);
        acc.totalBooks += subject.bookCount ?? subject.books?.length ?? 0;
        acc.indexedBooks += subject.indexedBookCount ?? 0;
        acc.statusCounts[status] = (acc.statusCounts[status] || 0) + 1;
        return acc;
      },
      {
        totalSubjects: subjects.length,
        totalBooks: 0,
        indexedBooks: 0,
        statusCounts: {} as Record<string, number>,
      }
    );
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    const query = normalize(search);

    return subjects.filter((subject) => {
      const status = getStatusLabel(subject.pageindexStatus);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesSearch =
        !query ||
        normalize(subject.subjectCode).includes(query) ||
        normalize(subject.subjectName).includes(query) ||
        normalize(subject.knownAs).includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, subjects]);

  function handleLogout() {
    logoutAdmin();
    router.replace("/login");
    router.refresh();
  }

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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              paperAI
            </p>
            <h1 className="text-xl font-bold">Admin Portal</h1>
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
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold">Subject Data Management</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Review all catalog subjects, material availability, book counts, old papers, and PageIndex status.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Subjects", summary.totalSubjects],
            ["Books", summary.totalBooks],
            ["Indexed Books", summary.indexedBooks],
            ["Ready", summary.statusCounts.ready || 0],
            ["Pending", summary.statusCounts.pending || 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Database className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Upload Catalog Content</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload documents from a separate page so this subject list stays lightweight.
              </p>
            </div>
            <Link
              href="/upload"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Upload className="h-4 w-4" />
              Upload document
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by code, name, or known as"
                className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : status}
                </option>
              ))}
            </select>
          </div>

          {isLoadingSubjects ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading subject data...</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-600">{error}</div>
          ) : filteredSubjects.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No subjects found.</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Known As</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Books</th>
                      <th className="px-4 py-3">Old Papers</th>
                      <th className="px-4 py-3">Materials</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubjects.map((subject) => {
                      const isExpanded = expandedSubjectCode === subject.subjectCode;
                      const books = subject.books ?? [];
                      const oldPapers = subject.oldPaper ?? [];

                      return (
                        <Fragment key={subject.subjectCode}>
                          <tr className="border-t border-border">
                            <td className="px-4 py-4">
                              <p className="font-semibold">{subject.subjectCode}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {subject.subjectName || "Untitled subject"}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-muted-foreground">
                              {subject.knownAs || "-"}
                            </td>
                            <td className="px-4 py-4">
                              <StatusBadge status={subject.pageindexStatus} />
                            </td>
                            <td className="px-4 py-4">
                              <p>{subject.bookCount ?? books.length}</p>
                              <p className="text-xs text-muted-foreground">
                                {subject.indexedBookCount ?? 0} indexed
                              </p>
                            </td>
                            <td className="px-4 py-4">{oldPapers.length}</td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                <AvailabilityBadge label={`Syllabus (${getMaterialCount(subject.syllabus)})`} isAvailable={getMaterialCount(subject.syllabus) > 0} />
                                <AvailabilityBadge label={`Solution (${getMaterialCount(subject.paperSolution)})`} isAvailable={getMaterialCount(subject.paperSolution) > 0} />
                                <AvailabilityBadge label={`Practical (${getMaterialCount(subject.prectical)})`} isAvailable={getMaterialCount(subject.prectical) > 0} />
                                <AvailabilityBadge label={`Viva (${getMaterialCount(subject.vivaQuestions)})`} isAvailable={getMaterialCount(subject.vivaQuestions) > 0} />
                                <AvailabilityBadge label={`Important (${getMaterialCount(subject.impMaterial)})`} isAvailable={getMaterialCount(subject.impMaterial) > 0} />
                                <AvailabilityBadge label={`Assignments (${getMaterialCount(subject.assignments)})`} isAvailable={getMaterialCount(subject.assignments) > 0} />
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSubjectCode(isExpanded ? null : subject.subjectCode)
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                              >
                                View details
                                <ChevronDown
                                  className={`h-3.5 w-3.5 transition ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </button>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="border-t border-border bg-slate-50">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <h3 className="text-sm font-semibold">Books</h3>
                                    <div className="mt-2 space-y-2">
                                      {books.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No books available.</p>
                                      ) : (
                                        books.map((book) => (
                                          <div
                                            key={book.bookId || book.title}
                                            className="rounded-lg border border-border bg-white p-3"
                                          >
                                            <p className="font-medium">{book.title || book.bookId || "Untitled book"}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                              ID: {book.bookId || "-"} | Tokens: {book.tokenCount ?? 0}
                                            </p>
                                            <div className="mt-2">
                                              <StatusBadge status={book.pageindexStatus} />
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-semibold">Old Papers</h3>
                                    <div className="mt-2 space-y-2">
                                      {oldPapers.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No old papers available.</p>
                                      ) : (
                                        oldPapers.map((paper) => (
                                          <div
                                            key={`${paper.year}-${paper.link}`}
                                            className="rounded-lg border border-border bg-white p-3"
                                          >
                                            <p className="font-medium">{paper.year || "Unknown year"}</p>
                                            <p className="mt-1 break-all text-xs text-muted-foreground">
                                              {paper.link || "No link"}
                                            </p>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border lg:hidden">
                {filteredSubjects.map((subject) => {
                  const isExpanded = expandedSubjectCode === subject.subjectCode;
                  const books = subject.books ?? [];
                  const oldPapers = subject.oldPaper ?? [];

                  return (
                    <article key={subject.subjectCode} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{subject.subjectCode}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {subject.subjectName || "Untitled subject"}
                          </p>
                        </div>
                        <StatusBadge status={subject.pageindexStatus} />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Books</p>
                          <p className="font-medium">{subject.bookCount ?? books.length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Old Papers</p>
                          <p className="font-medium">{oldPapers.length}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <AvailabilityBadge label={`Syllabus (${getMaterialCount(subject.syllabus)})`} isAvailable={getMaterialCount(subject.syllabus) > 0} />
                        <AvailabilityBadge label={`Solution (${getMaterialCount(subject.paperSolution)})`} isAvailable={getMaterialCount(subject.paperSolution) > 0} />
                        <AvailabilityBadge label={`Practical (${getMaterialCount(subject.prectical)})`} isAvailable={getMaterialCount(subject.prectical) > 0} />
                        <AvailabilityBadge label={`Viva (${getMaterialCount(subject.vivaQuestions)})`} isAvailable={getMaterialCount(subject.vivaQuestions) > 0} />
                        <AvailabilityBadge label={`Important (${getMaterialCount(subject.impMaterial)})`} isAvailable={getMaterialCount(subject.impMaterial) > 0} />
                        <AvailabilityBadge label={`Assignments (${getMaterialCount(subject.assignments)})`} isAvailable={getMaterialCount(subject.assignments) > 0} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedSubjectCode(isExpanded ? null : subject.subjectCode)}
                        className="mt-4 inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        View details
                        <ChevronDown className={`h-3.5 w-3.5 transition ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isExpanded ? (
                        <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
                          <p>{books.length} books</p>
                          <p>{oldPapers.length} old papers</p>
                          <p className="text-muted-foreground">
                            Indexed books: {subject.indexedBookCount ?? 0}
                          </p>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
