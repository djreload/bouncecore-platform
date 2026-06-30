import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  type MediaStorageFileSummary,
  formatStorageBytes,
  summarizeMediaStorageCategories,
  uploadCategoryFromPath
} from "@/lib/admin/media-storage-core";
import { getManagedUploadReferenceMap } from "@/lib/media/upload-cleanup-service";
import { normalizeManagedUploadPath } from "@/lib/media/upload-cleanup-core";

export type AdminMediaStorageData = {
  categories: ReturnType<typeof summarizeMediaStorageCategories>;
  files: {
    largest: MediaStorageFileSummary[];
    orphanCandidates: MediaStorageFileSummary[];
    recent: MediaStorageFileSummary[];
  };
  rootPath: string;
  stats: {
    fileCount: number;
    largestFileBytes: number;
    orphanCount: number;
    orphanSizeBytes: number;
    referencedCount: number;
    referencedSizeBytes: number;
    totalSizeBytes: number;
  };
};

type ScannedUploadFile = {
  modifiedAt: string;
  path: string;
  sizeBytes: number;
};

function uploadRootPath() {
  return path.resolve(process.cwd(), "public", "uploads");
}

function toUploadPath(rootPath: string, filePath: string) {
  const relativePath = path.relative(rootPath, filePath).split(path.sep).join("/");

  return normalizeManagedUploadPath(`/uploads/${relativePath}`);
}

async function scanUploadDirectory(rootPath: string, currentPath = rootPath): Promise<ScannedUploadFile[]> {
  let entries;

  try {
    entries = await readdir(currentPath, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files: ScannedUploadFile[] = [];

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await scanUploadDirectory(rootPath, entryPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const uploadPath = toUploadPath(rootPath, entryPath);

    if (!uploadPath) {
      continue;
    }

    const fileStat = await stat(entryPath);

    files.push({
      modifiedAt: fileStat.mtime.toISOString(),
      path: uploadPath,
      sizeBytes: fileStat.size
    });
  }

  return files;
}

function sortBySizeDesc(files: MediaStorageFileSummary[]) {
  return [...files].sort((left, right) => right.sizeBytes - left.sizeBytes || left.path.localeCompare(right.path));
}

function sortByModifiedDesc(files: MediaStorageFileSummary[]) {
  return [...files].sort((left, right) => new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime() || left.path.localeCompare(right.path));
}

export { formatStorageBytes };

export async function getAdminMediaStorageData(): Promise<AdminMediaStorageData> {
  const rootPath = uploadRootPath();
  const scannedFiles = await scanUploadDirectory(rootPath);
  const referenceMap = await getManagedUploadReferenceMap(scannedFiles.map((file) => file.path));
  const files = scannedFiles.map<MediaStorageFileSummary>((file) => {
    const references = referenceMap.get(file.path) ?? 0;

    return {
      category: uploadCategoryFromPath(file.path),
      modifiedAt: file.modifiedAt,
      path: file.path,
      references,
      sizeBytes: file.sizeBytes,
      status: references > 0 ? "referenced" : "orphan"
    };
  });
  const categories = summarizeMediaStorageCategories(files);
  const orphanCandidates = sortBySizeDesc(files.filter((file) => file.status === "orphan"));
  const largest = sortBySizeDesc(files);
  const recent = sortByModifiedDesc(files);
  const stats = files.reduce(
    (current, file) => {
      current.fileCount += 1;
      current.totalSizeBytes += file.sizeBytes;
      current.largestFileBytes = Math.max(current.largestFileBytes, file.sizeBytes);

      if (file.status === "orphan") {
        current.orphanCount += 1;
        current.orphanSizeBytes += file.sizeBytes;
      } else {
        current.referencedCount += 1;
        current.referencedSizeBytes += file.sizeBytes;
      }

      return current;
    },
    {
      fileCount: 0,
      largestFileBytes: 0,
      orphanCount: 0,
      orphanSizeBytes: 0,
      referencedCount: 0,
      referencedSizeBytes: 0,
      totalSizeBytes: 0
    }
  );

  return {
    categories,
    files: {
      largest: largest.slice(0, 50),
      orphanCandidates: orphanCandidates.slice(0, 50),
      recent: recent.slice(0, 50)
    },
    rootPath,
    stats
  };
}
