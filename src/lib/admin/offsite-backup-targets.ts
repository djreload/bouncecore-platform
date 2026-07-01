export const googleDriveDefaultRemoteName = "bouncecore-gdrive";
export const googleDriveDefaultFolder = "Bouncecore Backups";

export type OffsiteBackupDestinationType = "rclone" | "google-drive";

function normalizedText(value: string | null | undefined, maxLength: number, label: string) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  if (/[\r\n]/.test(text)) {
    throw new Error(`${label} cannot contain line breaks.`);
  }

  return text;
}

export function normalizeDestinationType(value: unknown): OffsiteBackupDestinationType {
  return value === "rclone" ? "rclone" : "google-drive";
}

export function normalizeGoogleDriveRemoteName(value: string | null | undefined) {
  const remoteName = normalizedText(value, 80, "Google Drive rclone remote name") ?? googleDriveDefaultRemoteName;

  if (!/^[A-Za-z0-9_.-]+$/.test(remoteName)) {
    throw new Error("Google Drive rclone remote name can contain only letters, numbers, dot, underscore, and dash.");
  }

  return remoteName;
}

export function normalizeGoogleDriveFolder(value: string | null | undefined) {
  const folder = normalizedText(value, 180, "Google Drive folder") ?? googleDriveDefaultFolder;

  if (/[`$;&|<>]/.test(folder) || folder.includes("..")) {
    throw new Error("Google Drive folder cannot contain shell control characters or '..'.");
  }

  return folder.replace(/^\/+/, "").replace(/\/+$/, "") || googleDriveDefaultFolder;
}

export function googleDriveRcloneDestination(remoteName: string, folder: string) {
  const safeRemoteName = normalizeGoogleDriveRemoteName(remoteName);
  const safeFolder = normalizeGoogleDriveFolder(folder);

  return `${safeRemoteName}:${safeFolder}`;
}
