"use client";

import type { CatalogBook, SubjectDetail, SubjectSummary } from "@/lib/types";
import { Download, Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

interface SubjectCatalogProps {
  subjects: SubjectSummary[];
  loading?: boolean;
  currentSubjectCode?: string;
  subjectDetail?: SubjectDetail;
  onSelect: (subjectCode: string) => void;
}

function isCatalogSubjectVisible(subject: SubjectSummary): boolean {
  const status = subject.pageindexStatus;
  return status === "ready" || status === "partial";
}

function isCatalogBookVisible(book: CatalogBook): boolean {
  return book.pageindexStatus === "ready";
}

function matchesSubjectSearch(subject: SubjectSummary, query: string): boolean {
  const haystack = [subject.subjectName, subject.subjectCode, subject.knownAs]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function SubjectCatalog({
  subjects,
  loading,
  currentSubjectCode,
  subjectDetail,
  onSelect,
}: SubjectCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleSubjects = useMemo(
    () => subjects.filter(isCatalogSubjectVisible),
    [subjects],
  );

  const filteredSubjects = useMemo(() => {
    if (!normalizedQuery) {
      return visibleSubjects;
    }
    return visibleSubjects.filter((subject) => matchesSubjectSearch(subject, normalizedQuery));
  }, [visibleSubjects, normalizedQuery]);

  return (
    <div className="ed-panel ed-sidebar-panel">
      <div
        className="ed-sidebar-panel__header"
        style={{
          borderBottom: "1px solid var(--ed-rule)",
          padding: "0.75rem 1rem 0.625rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          backgroundColor: "var(--ed-surface)",
        }}
      >
        <h2
          className="font-fraunces"
          style={{
            fontWeight: 300,
            fontStyle: "italic",
            fontSize: "1.125rem",
            color: "var(--ed-ink)",
            flexShrink: 0,
          }}
        >
          Subjects
        </h2>
        {visibleSubjects.length > 0 && !loading && (
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <Search
              size={12}
              aria-hidden
              style={{
                position: "absolute",
                left: "0.45rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ed-faint)",
                pointerEvents: "none",
              }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search subjects"
              style={{
                width: "100%",
                height: 26,
                padding: "0 1.5rem 0 1.5rem",
                fontSize: "0.75rem",
                color: "var(--ed-ink)",
                backgroundColor: "var(--ed-bg)",
                border: "1px solid var(--ed-rule)",
                borderRadius: 2,
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--ed-accent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--ed-rule)";
              }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "0.25rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  color: "var(--ed-faint)",
                  cursor: "pointer",
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
        {visibleSubjects.length > 0 && !loading && (
          <span style={{ fontSize: "0.6875rem", color: "var(--ed-faint)", flexShrink: 0, whiteSpace: "nowrap" }}>
            {normalizedQuery
              ? `${filteredSubjects.length} of ${visibleSubjects.length}`
              : `${visibleSubjects.length} ${visibleSubjects.length === 1 ? "subject" : "subjects"}`}
          </span>
        )}
      </div>

      {loading ? (
        <div
          className="ed-sidebar-panel__body ed-panel-scroll"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--ed-muted)",
            padding: "1rem",
          }}
        >
          <Loader2 size={14} className="animate-spin" />
          <span style={{ fontSize: "0.8125rem" }}>Loading…</span>
        </div>
      ) : visibleSubjects.length === 0 ? (
        <p
          className="ed-sidebar-panel__body ed-panel-scroll"
          style={{ fontSize: "0.8125rem", color: "var(--ed-faint)", padding: "1rem", lineHeight: 1.6 }}
        >
          No subjects available.
        </p>
      ) : filteredSubjects.length === 0 ? (
        <p
          className="ed-sidebar-panel__body ed-panel-scroll"
          style={{ fontSize: "0.8125rem", color: "var(--ed-faint)", padding: "1rem", lineHeight: 1.6 }}
        >
          No subjects match &ldquo;{searchQuery.trim()}&rdquo;.
        </p>
      ) : (
        <div className="ed-sidebar-panel__body ed-panel-scroll">
          {filteredSubjects.map((subject) => {
            const isActive = currentSubjectCode === subject.subjectCode;
            const indexed = subject.indexedBookCount ?? 0;
            const total = subject.bookCount ?? 0;
            const visibleBooks =
              isActive && subjectDetail?.books
                ? subjectDetail.books.filter(isCatalogBookVisible)
                : [];

            

            return (
              <div
                key={subject.subjectCode}
                onClick={() => onSelect(subject.subjectCode)}
                className={`ed-list-item${isActive ? " ed-list-item--active" : ""}`}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "var(--ed-surface)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? "var(--ed-accent)" : "var(--ed-ink)",
                    marginBottom: "0.2rem",
                    lineHeight: 1.4,
                  }}
                >
                  {subject.subjectName}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--ed-faint)", marginBottom: "0.4rem", lineHeight: 1.4 }}>
                  {subject.subjectCode}
                  {subject.knownAs ? ` · ${subject.knownAs}` : ""}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--ed-faint)" }}>
                  {/* {indexed}/{total} books */}
                </div>

                {isActive && visibleBooks.length > 0 ? (
                  <div
                    style={{
                      marginTop: "0.625rem",
                      paddingTop: "0.625rem",
                      borderTop: "1px solid var(--ed-rule)",
                    }}
                  >
                    {visibleBooks.map((book) => (
                      <div
                        key={book.bookId}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                          padding: "0.35rem 0",
                          fontSize: "0.75rem",
                          color: "var(--ed-muted)",
                        }}
                      >
                        {book.img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={book.img}
                            alt={book.title || book.bookId}
                            style={{
                              width: 28,
                              height: 36,
                              objectFit: "cover",
                              borderRadius: 2,
                              border: "1px solid var(--ed-rule)",
                              flexShrink: 0,
                            }}
                          />
                        ) : null}
                        <span style={{ minWidth: 0, lineHeight: 1.4 }}>
                          {book.title || book.altData || book.bookId}
                        </span>
                        {book.downloadLink ? (
                          <a href={book.downloadLink} target="_blank" rel="noopener noreferrer">
                            <Download size={12} className="ml-auto" />
                            </a>
                          ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
