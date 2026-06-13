import { DocumentMetaData } from "@/lib/types";
import { CheckCircle2, CircleHelp, Clock3, Eye, Loader2, OctagonAlert, Trash2, Upload } from "lucide-react";

interface DocumentHistoryProps {
  documents: DocumentMetaData[];
  loading?: boolean;
  onSelect: (documentId: string) => void;
  onDelete?: (documentId: string) => void;
  onViewPdf?: (document: DocumentMetaData) => void;
  onUpload?: () => void;
  uploading?: boolean;
  uploadDisabled?: boolean;
  uploadComingSoon?: boolean;
  currentId?: string;
  deletingId?: string;
}

type IndexStatus = "queued" | "running" | "complete" | "failed" | "unknown";

const statusConfig: Record<IndexStatus, {
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  icon: typeof CheckCircle2;
}> = {
  queued: {
    label: "Queued",
    color: "#7c5a12",
    backgroundColor: "#fff8e5",
    borderColor: "#f1dfad",
    icon: Clock3,
  },
  running: {
    label: "Running",
    color: "#1a56db",
    backgroundColor: "#eef3ff",
    borderColor: "#c9d8ff",
    icon: Loader2,
  },
  complete: {
    label: "Ready",
    color: "#166534",
    backgroundColor: "#eef8f1",
    borderColor: "#c8e6d0",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "#b42318",
    backgroundColor: "#fff1f0",
    borderColor: "#ffd0cc",
    icon: OctagonAlert,
  },
  unknown: {
    label: "Unknown",
    color: "#6b6861",
    backgroundColor: "var(--ed-surface)",
    borderColor: "var(--ed-rule)",
    icon: CircleHelp,
  },
};

function getIndexStatus(status?: string | null): IndexStatus {
  if (status === "queued" || status === "running" || status === "complete" || status === "failed") {
    return status;
  }

  return "unknown";
}

// function formatPageCount(pageCount?: number): string {
//   const value = Number(pageCount ?? 0);
//   if (!Number.isFinite(value) || value <= 0) {
//     return "0 pages";
//   }
//
//   return `${new Intl.NumberFormat(undefined, {
//     notation: value >= 1000 ? "compact" : "standard",
//     maximumFractionDigits: value >= 1000 ? 1 : 0,
//   }).format(value)} pages`;
// }

export function DocumentHistory({
  documents,
  loading,
  onSelect,
  onDelete,
  onViewPdf,
  onUpload,
  uploading,
  uploadDisabled,
  uploadComingSoon = false,
  currentId,
  deletingId,
}: DocumentHistoryProps) {
  return (
    <div className="ed-panel ed-sidebar-panel">
      {/* Section heading */}
      <div
        className="ed-sidebar-panel__header"
        style={{
          borderBottom: "1px solid var(--ed-rule)",
          padding: "0.75rem 1rem 0.625rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "var(--ed-surface)",
        }}
      >
        <h2
          className="font-fraunces"
          style={{ fontWeight: 300, fontStyle: "italic", fontSize: "1.125rem", color: "var(--ed-ink)" }}
        >
          My uploads
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {documents.length > 0 && !loading && (
            <span style={{ fontSize: "0.6875rem", color: "var(--ed-faint)" }}>
              {documents.length} {documents.length === 1 ? "document" : "documents"}
            </span>
          )}
          {uploadComingSoon ? (
            <span
              title="PDF upload coming soon"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 20,
                padding: "0 0.4rem",
                border: "1px solid #c9d8ff",
                borderRadius: 2,
                backgroundColor: "#eef3ff",
                color: "#1a56db",
                fontSize: "0.625rem",
                lineHeight: 1.4,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
              }}
            >
              Coming soon
            </span>
          ) : (
            onUpload && (
              <button
                type="button"
                title={uploadDisabled ? "Add tokens to upload PDFs" : "Upload PDF"}
                aria-label="Upload PDF"
                disabled={uploadDisabled}
                onClick={onUpload}
                style={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: uploadDisabled ? "var(--ed-faint)" : "var(--ed-muted)",
                  cursor: uploadDisabled ? "default" : "pointer",
                  opacity: uploadDisabled ? 0.5 : 1,
                  transition: "color 0.15s, background-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!uploadDisabled) e.currentTarget.style.color = "var(--ed-accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = uploadDisabled ? "var(--ed-faint)" : "var(--ed-muted)";
                }}
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              </button>
            )
          )}
        </div>
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
      ) : documents.length === 0 ? (
        <p
          className="ed-sidebar-panel__body ed-panel-scroll"
          style={{ fontSize: "0.8125rem", color: "var(--ed-faint)", padding: "1rem", lineHeight: 1.6 }}
        >
          {uploadComingSoon
            ? "PDF upload is coming soon. Use Find materials to browse GTU papers and books."
            : "No documents yet. Upload a PDF to get started."}
        </p>
      ) : (
        <div className="ed-sidebar-panel__body ed-panel-scroll">
          {documents.map((doc) => {
            const isActive = currentId === doc.id;
            const isDeleting = deletingId === doc.id;
            const status = getIndexStatus(doc.indexStatus);
            const statusView = statusConfig[status];
            const StatusIcon = statusView.icon;
            // const pageLabel = formatPageCount(doc.pageCount);
            return (
              <div
                key={doc.id}
                onClick={() => onSelect(doc.id)}
                className={`ed-list-item${isActive ? " ed-list-item--active" : ""}`}
                style={{ opacity: isDeleting ? 0.55 : 1 }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "var(--ed-surface)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? "var(--ed-accent)" : "var(--ed-ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginBottom: "0.2rem",
                        transition: "color 0.15s",
                      }}
                    >
                      {doc.filename}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.6875rem", color: "var(--ed-faint)" }}>
                        {new Date(doc.uploadedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span
                        title={`Index status: ${statusView.label}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.22rem",
                          minHeight: 18,
                          padding: "0 0.35rem",
                          border: `1px solid ${statusView.borderColor}`,
                          borderRadius: 2,
                          backgroundColor: statusView.backgroundColor,
                          color: statusView.color,
                          fontSize: "0.625rem",
                          lineHeight: 1.4,
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: 0,
                        }}
                      >
                        <StatusIcon size={10} className={status === "running" ? "animate-spin" : undefined} />
                        {statusView.label}
                      </span>
                      {/* Page count hidden — not shown to users
                      <span
                        title={`Pages used: ${doc.pageCount ?? 0}`}
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--ed-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {pageLabel}
                      </span>
                      */}
                    </div>
                  </div>
                  {onViewPdf && (
                    <button
                      type="button"
                      title="View PDF"
                      aria-label={`View ${doc.filename}`}
                      disabled={isDeleting}
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPdf(doc);
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--ed-faint)",
                        cursor: isDeleting ? "default" : "pointer",
                        transition: "color 0.15s, background-color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isDeleting) e.currentTarget.style.color = "var(--ed-accent)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--ed-faint)";
                      }}
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      title="Delete document"
                      aria-label={`Delete ${doc.filename}`}
                      disabled={isDeleting}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(doc.id);
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--ed-faint)",
                        cursor: isDeleting ? "default" : "pointer",
                        transition: "color 0.15s, background-color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isDeleting) e.currentTarget.style.color = "#dc2626";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--ed-faint)";
                      }}
                    >
                      {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
