"use client";

import {
  CatalogPdfViewerDialog,
  useCatalogPdfViewer,
} from "@/components/catalog-pdf-viewer";
import {
  getMaterialFileUrl,
  getPaperSolutionLabel,
} from "@/lib/catalog-materials";
import type { CatalogMaterialFile } from "@/lib/types";

type PaperSolutionsFilesGridProps = {
  files: CatalogMaterialFile[];
  initials: string;
  fallbackTitle: string;
  subtitle: string;
  actionPrefix: string;
};

export function PaperSolutionsFilesGrid({
  files,
  initials,
  fallbackTitle,
  subtitle,
  actionPrefix,
}: PaperSolutionsFilesGridProps) {
  const { open, filename, url, openPdf, closePdf } = useCatalogPdfViewer();

  if (files.length === 0) {
    return null;
  }

  return (
    <>
      <CatalogPdfViewerDialog
        open={open}
        filename={filename}
        url={url}
        onClose={closePdf}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {files.map((file, index) => {
          const fileUrl = getMaterialFileUrl(file);
          const label = getPaperSolutionLabel(file, index);
          const actionLabel = `${actionPrefix}${files.length > 1 ? ` ${index + 1}` : ""}`;

          return (
            <div
              key={`${fileUrl || file.title || index}`}
              className="w-full max-w-xs rounded-sm border border-border bg-background p-3 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-brand">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.title || fallbackTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {file.originalName || subtitle}
                  </p>
                </div>
              </div>
              {fileUrl?.trim() ? (
                <button
                  type="button"
                  onClick={() => openPdf({ filename: label, url: fileUrl })}
                  className="mt-3 flex h-8 w-full items-center justify-center rounded-full border border-primary px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  {actionLabel}
                </button>
              ) : (
                <span className="mt-3 flex h-8 w-full items-center justify-center rounded-full border border-primary px-3 text-xs font-medium text-foreground opacity-60">
                  {actionLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
