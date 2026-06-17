import { DocumentMetaData } from "@/lib/types";
import { cn } from "@/lib/utils";
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
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] ed-sidebar-panel">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">My uploads</h2>
        <div className="flex items-center gap-2">
          {documents.length > 0 && !loading && (
            <span className="text-[0.6875rem] text-muted-foreground">
              {documents.length} {documents.length === 1 ? "document" : "documents"}
            </span>
          )}
          {uploadComingSoon ? (
            <span
              title="PDF upload coming soon"
              className="inline-flex min-h-5 items-center rounded-lg border border-[#c9d8ff] bg-[#eef3ff] px-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[#1a56db] whitespace-nowrap"
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
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-brand",
                  uploadDisabled && "cursor-default opacity-50",
                )}
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              </button>
            )
          )}
        </div>
      </div>

      {loading ? (
        <div className="ed-sidebar-panel__body ed-panel-scroll flex items-center gap-2 p-4 text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : documents.length === 0 ? (
        <p className="ed-sidebar-panel__body ed-panel-scroll p-4 text-sm leading-relaxed text-muted-foreground">
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

            return (
              <div
                key={doc.id}
                onClick={() => onSelect(doc.id)}
                className={cn(
                  "cursor-pointer border-b border-border px-4 py-3 transition-colors last:border-b-0",
                  isActive
                    ? "border-l-2 border-l-brand bg-[color-mix(in_oklab,var(--brand)_8%,transparent)]"
                    : "border-l-2 border-l-transparent hover:bg-muted/40",
                  isDeleting && "opacity-55",
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "mb-0.5 truncate text-sm transition-colors",
                        isActive ? "font-medium text-brand" : "text-foreground",
                      )}
                    >
                      {doc.filename}
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="text-[0.6875rem] text-muted-foreground">
                        {new Date(doc.uploadedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span
                        title={`Index status: ${statusView.label}`}
                        className="inline-flex min-h-[18px] items-center gap-0.5 rounded border px-1.5 text-[0.625rem] font-medium uppercase"
                        style={{
                          borderColor: statusView.borderColor,
                          backgroundColor: statusView.backgroundColor,
                          color: statusView.color,
                        }}
                      >
                        <StatusIcon size={10} className={status === "running" ? "animate-spin" : undefined} />
                        {statusView.label}
                      </span>
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
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-brand disabled:cursor-default"
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
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive disabled:cursor-default"
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
