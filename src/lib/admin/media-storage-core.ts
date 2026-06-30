export type MediaStorageStatus = "orphan" | "referenced";

export type MediaStorageFileSummary = {
  category: string;
  modifiedAt: string;
  path: string;
  references: number;
  sizeBytes: number;
  status: MediaStorageStatus;
};

export type MediaStorageCategorySummary = {
  category: string;
  fileCount: number;
  orphanCount: number;
  orphanSizeBytes: number;
  referencedCount: number;
  referencedSizeBytes: number;
  sizeBytes: number;
};

export type MediaStorageReferenceLike = {
  field: string;
  label: string;
  path: string;
  recordId: string;
  source: string;
};

export function formatStorageBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;

  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function uploadCategoryFromPath(uploadPath: string) {
  const segments = uploadPath.split("/").filter(Boolean);

  if (segments[0] !== "uploads") {
    return "unknown";
  }

  return segments.length <= 2 ? "root" : segments[1];
}

export function summarizeMediaStorageCategories(files: MediaStorageFileSummary[]): MediaStorageCategorySummary[] {
  const categories = new Map<string, MediaStorageCategorySummary>();

  for (const file of files) {
    const current =
      categories.get(file.category) ??
      ({
        category: file.category,
        fileCount: 0,
        orphanCount: 0,
        orphanSizeBytes: 0,
        referencedCount: 0,
        referencedSizeBytes: 0,
        sizeBytes: 0
      } satisfies MediaStorageCategorySummary);

    current.fileCount += 1;
    current.sizeBytes += file.sizeBytes;

    if (file.status === "orphan") {
      current.orphanCount += 1;
      current.orphanSizeBytes += file.sizeBytes;
    } else {
      current.referencedCount += 1;
      current.referencedSizeBytes += file.sizeBytes;
    }

    categories.set(file.category, current);
  }

  return [...categories.values()].sort((left, right) => right.sizeBytes - left.sizeBytes || left.category.localeCompare(right.category));
}

export function summarizeMissingMediaReferences<T extends MediaStorageReferenceLike>(references: T[], existingPaths: Iterable<string>) {
  const existingPathSet = new Set(existingPaths);

  return references
    .filter((reference) => !existingPathSet.has(reference.path))
    .sort(
      (left, right) =>
        left.source.localeCompare(right.source) ||
        left.label.localeCompare(right.label) ||
        left.field.localeCompare(right.field) ||
        left.path.localeCompare(right.path)
    );
}
