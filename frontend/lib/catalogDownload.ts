function buildCatalogApiUrl(path: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const apiVersion = process.env.NEXT_PUBLIC_API_VERSION ?? "";

  if (!apiBase) {
    return undefined;
  }

  return `${apiBase.replace(/\/$/, "")}${apiVersion}${path}`;
}

function isS3DownloadUrl(url?: string) {
  return Boolean(url?.trim().startsWith("s3://"));
}

const GOOGLE_DRIVE_FILE_ID_PATTERNS = [
  /\/file\/d\/([A-Za-z0-9_-]+)/i,
  /\/document\/d\/([A-Za-z0-9_-]+)/i,
  /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/i,
  /\/presentation\/d\/([A-Za-z0-9_-]+)/i,
  /(?:^|[?&])id=([A-Za-z0-9_-]+)/i,
  /\/open\?id=([A-Za-z0-9_-]+)/i,
];

/** Extract a Google Drive / Docs file id from common share and uc download URLs. */
export function getGoogleDriveFileId(url?: string) {
  const trimmedUrl = url?.trim();
  if (!trimmedUrl) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmedUrl);
    const host = parsed.hostname.replace(/^www\./, "");
    if (
      host !== "drive.google.com" &&
      host !== "docs.google.com" &&
      host !== "drive.usercontent.google.com"
    ) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  for (const pattern of GOOGLE_DRIVE_FILE_ID_PATTERNS) {
    const match = trimmedUrl.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

export function getCatalogDownloadHref(url?: string) {
  const trimmedUrl = url?.trim();
  if (!trimmedUrl) {
    return undefined;
  }

  if (!isS3DownloadUrl(trimmedUrl)) {
    return trimmedUrl;
  }

  return buildCatalogApiUrl(
    `/public/catalog/download-url?url=${encodeURIComponent(trimmedUrl)}`,
  );
}

/**
 * Resolve a URL suitable for in-app iframe preview.
 * Google Drive download/view links must use /preview to avoid the access interstitial.
 */
export function getCatalogPdfViewerHref(url?: string) {
  const trimmedUrl = url?.trim();
  if (!trimmedUrl) {
    return undefined;
  }

  const driveFileId = getGoogleDriveFileId(trimmedUrl);
  if (driveFileId) {
    return `https://drive.google.com/file/d/${driveFileId}/preview`;
  }

  return getCatalogDownloadHref(trimmedUrl);
}
