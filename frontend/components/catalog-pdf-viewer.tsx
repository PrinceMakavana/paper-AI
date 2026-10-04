"use client";

import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { getCatalogPdfViewerHref } from "@/lib/catalogDownload";
import { useCallback, useState } from "react";

type CatalogPdfViewerState = {
  open: boolean;
  filename?: string;
  url?: string;
};

export type OpenCatalogPdfArgs = {
  filename: string;
  /** Raw catalog file URL (Drive, HTTPS, or s3://). */
  url: string;
};

export function useCatalogPdfViewer() {
  const [viewer, setViewer] = useState<CatalogPdfViewerState>({ open: false });

  const openPdf = useCallback(({ filename, url }: OpenCatalogPdfArgs) => {
    const viewerUrl = getCatalogPdfViewerHref(url);
    if (!viewerUrl) {
      return;
    }
    setViewer({ open: true, filename, url: viewerUrl });
  }, []);

  const closePdf = useCallback(() => {
    setViewer({ open: false });
  }, []);

  return {
    open: viewer.open,
    filename: viewer.filename,
    url: viewer.url,
    openPdf,
    closePdf,
  };
}

export function CatalogPdfViewerDialog({
  open,
  filename,
  url,
  onClose,
}: {
  open: boolean;
  filename?: string;
  url?: string;
  onClose: () => void;
}) {
  return (
    <PdfViewerDialog
      open={open}
      filename={filename}
      url={url}
      onClose={onClose}
    />
  );
}
