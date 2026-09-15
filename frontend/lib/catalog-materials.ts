import type { CatalogMaterialFile } from "@/lib/types";

export function getMaterialFiles(value?: CatalogMaterialFile[] | string) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return [{ title: "", url: value }];
  }

  return [];
}

export function getMaterialFileUrl(file?: CatalogMaterialFile) {
  return file?.url || file?.s3Uri || file?.storagePath;
}

const SEASON_YEAR_PATTERN =
  /\b(summer|winter)\b[\s\-_/]*(\d{4})\b|\b(\d{4})\b[\s\-_/]*(summer|winter)\b/i;

function formatSeasonYear(season: string, year: string) {
  const normalizedSeason =
    season.charAt(0).toUpperCase() + season.slice(1).toLowerCase();
  return `${year} ${normalizedSeason}`;
}

/** Prefer "2024 Summer" / "2023 Winter" labels for paper-solution CTAs. */
export function getPaperSolutionLabel(
  file: CatalogMaterialFile,
  fallbackIndex?: number,
) {
  const candidates = [file.title, file.originalName].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed || /^paper\s*solution$/i.test(trimmed)) {
      continue;
    }

    const match = trimmed.match(SEASON_YEAR_PATTERN);
    if (match) {
      const season = match[1] || match[4];
      const year = match[2] || match[3];
      if (season && year) {
        return formatSeasonYear(season, year);
      }
    }

    return trimmed;
  }

  if (typeof fallbackIndex === "number") {
    return `Paper solution ${fallbackIndex + 1}`;
  }

  return "Paper solution";
}
