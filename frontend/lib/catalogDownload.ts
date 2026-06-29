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
