"use client";

import { Loader2, RefreshCw, X } from "lucide-react";

interface PdfViewerDialogProps {
  open: boolean;
  filename?: string;
  url?: string;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onRetry?: () => void;
}

export function PdfViewerDialog({
  open,
  filename,
  url,
  loading,
  error,
  onClose,
  onRetry,
}: PdfViewerDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-4 sm:px-6"
      style={{ backgroundColor: "rgba(17, 17, 17, 0.46)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-[88vh] w-full max-w-6xl animate-fade-up flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--ed-bg)",
          border: "1px solid var(--ed-rule)",
          borderRadius: 8,
          boxShadow: "0 24px 70px rgba(25, 24, 20, 0.24)",
        }}
      >
        <div
          className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 sm:px-5"
          style={{ borderBottom: "1px solid var(--ed-rule)" }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              className="truncate font-fraunces"
              style={{ fontSize: "1.05rem", fontWeight: 300, fontStyle: "italic", color: "var(--ed-ink)" }}
            >
              {filename || "PDF preview"}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {/* {onRetry && (
              <button
                type="button"
                title="Reload PDF"
                aria-label="Reload PDF"
                onClick={onRetry}
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 disabled:cursor-default disabled:opacity-50"
                style={{ color: "var(--ed-muted)" }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              </button>
            )} */}
            <button
              type="button"
              title="Close"
              aria-label="Close PDF viewer"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
              style={{ color: "var(--ed-muted)" }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1" style={{ backgroundColor: "var(--ed-surface)" }}>
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2" style={{ color: "var(--ed-muted)" }}>
              <Loader2 size={18} className="animate-spin" />
              <span style={{ fontSize: "0.875rem" }}>Loading PDF...</span>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center px-5 text-center">
              <div>
                <p style={{ fontSize: "0.95rem", color: "#b42318", marginBottom: 8 }}>{error}</p>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors hover:bg-gray-100"
                    style={{ borderColor: "var(--ed-rule)", color: "var(--ed-ink)" }}
                  >
                    <RefreshCw size={15} />
                    Try again
                  </button>
                )}
              </div>
            </div>
          ) : url ? (
            <iframe
              key={url}
              title={filename ? `PDF preview for ${filename}` : "PDF preview"}
              src={url}
              allow="autoplay"
              className="h-full w-full"
              style={{ border: "none", backgroundColor: "#ffffff" }}
            />
          ) : (
            <div className="flex h-full items-center justify-center" style={{ color: "var(--ed-muted)" }}>
              <span style={{ fontSize: "0.875rem" }}>PDF preview is not available.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
