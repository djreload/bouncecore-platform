import path from "node:path";

const uploadPrefix = "/uploads/";

export function normalizeManagedUploadPath(value: string | null | undefined) {
  const text = value?.trim() ?? "";

  if (!text || !text.startsWith(uploadPrefix) || text.includes("\0") || text.includes("\\") || text.includes("?") || text.includes("#")) {
    return null;
  }

  let decodedPath = "";

  try {
    decodedPath = decodeURIComponent(text);
  } catch {
    return null;
  }

  const segments = decodedPath.split("/").slice(1);

  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }

  const pathname = new URL(text, "http://bouncecore.local").pathname;
  const normalized = path.posix.normalize(pathname);

  if (!normalized.startsWith(uploadPrefix) || normalized !== pathname) {
    return null;
  }

  return normalized;
}

export function managedUploadDiskPath(uploadPath: string, cwd = process.cwd()) {
  const normalized = normalizeManagedUploadPath(uploadPath);

  if (!normalized) {
    return null;
  }

  const uploadsRoot = path.resolve(cwd, "public", "uploads");
  const absolutePath = path.resolve(cwd, "public", normalized.slice(1));
  const relative = path.relative(uploadsRoot, absolutePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return absolutePath;
}

export function jsonValueReferencesUpload(value: unknown, uploadPath: string) {
  return (JSON.stringify(value) ?? "").includes(JSON.stringify(uploadPath));
}

export function uniqueManagedUploadPaths(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => normalizeManagedUploadPath(value)).filter((value): value is string => Boolean(value)))];
}

export function collectManagedUploadPathsFromJson(value: unknown): string[] {
  const paths: string[] = [];

  function visit(current: unknown) {
    if (typeof current === "string") {
      const uploadPath = normalizeManagedUploadPath(current);

      if (uploadPath) {
        paths.push(uploadPath);
      }

      return;
    }

    if (!current || typeof current !== "object") {
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    Object.values(current).forEach(visit);
  }

  visit(value);

  return paths;
}
