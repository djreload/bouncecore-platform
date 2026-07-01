import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import {
  googleDriveDefaultFolder,
  googleDriveDefaultRemoteName,
  googleDriveRcloneConfigVolumePath,
  googleDriveRcloneDestination,
  normalizeDestinationType,
  normalizeGoogleDriveFolder,
  normalizeGoogleDriveRemoteName,
  type OffsiteBackupDestinationType
} from "@/lib/admin/offsite-backup-targets";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

const offsiteBackupSettingsKey = "backup.offsite";
export const offsiteBackupConfigVolumePath = ".ops/offsite-backup-config.env";

export type OffsiteBackupSettings = {
  ageRecipient: string | null;
  destinationType: OffsiteBackupDestinationType;
  enabled: boolean;
  googleDriveFolder: string | null;
  googleDriveRemoteName: string | null;
  outputDir: string | null;
  rcloneRemote: string | null;
  removeLocalAfterUpload: boolean;
};

export type OffsiteBackupSettingsInput = OffsiteBackupSettings;

export type AdminOffsiteBackupSettingsData = {
  checks: Array<{
    detail: string;
    label: string;
    status: "ready" | "warning";
    value: string;
  }>;
  configFilePath: string;
  configFilePresent: boolean;
  configVolumePath: string;
  settings: OffsiteBackupSettings;
  source: "default" | "database";
  updatedAt: string | null;
};

function defaultOffsiteBackupSettings(): OffsiteBackupSettings {
  return {
    ageRecipient: null,
    destinationType: "google-drive",
    enabled: false,
    googleDriveFolder: googleDriveDefaultFolder,
    googleDriveRemoteName: googleDriveDefaultRemoteName,
    outputDir: null,
    rcloneRemote: null,
    removeLocalAfterUpload: false
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

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

function normalizeAgeRecipient(value: string | null | undefined) {
  const recipient = normalizedText(value, 240, "age public recipient");

  if (!recipient) {
    return null;
  }

  if (!/^age1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/i.test(recipient)) {
    throw new Error("Age public recipient must start with age1 and contain only age recipient characters.");
  }

  return recipient;
}

function normalizeRcloneRemote(value: string | null | undefined) {
  const remote = normalizedText(value, 240, "rclone remote");

  if (!remote) {
    return null;
  }

  if (!/^[A-Za-z0-9_.-]+:.+/.test(remote) || /['"`$;&|<>]/.test(remote)) {
    throw new Error("rclone remote must look like remote:bucket/path and cannot contain shell control characters.");
  }

  return remote;
}

function normalizeOutputDir(value: string | null | undefined) {
  const outputDir = normalizedText(value, 240, "local encrypted export directory");

  if (!outputDir) {
    return null;
  }

  if (/[`$;&|<>]/.test(outputDir) || outputDir.includes("..")) {
    throw new Error("Local encrypted export directory cannot contain shell control characters or '..'.");
  }

  return outputDir;
}

export function normalizeOffsiteBackupSettingsInput(input: OffsiteBackupSettingsInput): OffsiteBackupSettings {
  const destinationType = normalizeDestinationType(input.destinationType);
  const googleDriveRemoteName = normalizeGoogleDriveRemoteName(input.googleDriveRemoteName);
  const googleDriveFolder = normalizeGoogleDriveFolder(input.googleDriveFolder);
  const settings: OffsiteBackupSettings = {
    ageRecipient: normalizeAgeRecipient(input.ageRecipient),
    destinationType,
    enabled: Boolean(input.enabled),
    googleDriveFolder,
    googleDriveRemoteName,
    outputDir: normalizeOutputDir(input.outputDir),
    rcloneRemote:
      destinationType === "google-drive"
        ? googleDriveRcloneDestination(googleDriveRemoteName, googleDriveFolder)
        : normalizeRcloneRemote(input.rcloneRemote),
    removeLocalAfterUpload: Boolean(input.removeLocalAfterUpload)
  };

  if (settings.enabled && !settings.ageRecipient) {
    throw new Error("Enable off-server backups only after adding the age public recipient.");
  }

  if (settings.enabled && !settings.rcloneRemote) {
    throw new Error("Enable off-server backups only after adding the rclone destination.");
  }

  if (settings.removeLocalAfterUpload && !settings.rcloneRemote) {
    throw new Error("Removing local encrypted exports requires an rclone destination.");
  }

  return settings;
}

function mergeOffsiteBackupSettings(value: unknown): OffsiteBackupSettings {
  const settings = defaultOffsiteBackupSettings();

  if (!isObject(value)) {
    return settings;
  }

  try {
    const legacyHasCustomRemote = typeof value.rcloneRemote === "string" && Boolean(value.rcloneRemote.trim());

    return normalizeOffsiteBackupSettingsInput({
      ageRecipient: typeof value.ageRecipient === "string" ? value.ageRecipient : null,
      destinationType:
        typeof value.destinationType === "string"
          ? normalizeDestinationType(value.destinationType)
          : legacyHasCustomRemote
            ? "rclone"
            : "google-drive",
      enabled: typeof value.enabled === "boolean" ? value.enabled : false,
      googleDriveFolder: typeof value.googleDriveFolder === "string" ? value.googleDriveFolder : null,
      googleDriveRemoteName: typeof value.googleDriveRemoteName === "string" ? value.googleDriveRemoteName : null,
      outputDir: typeof value.outputDir === "string" ? value.outputDir : null,
      rcloneRemote: typeof value.rcloneRemote === "string" ? value.rcloneRemote : null,
      removeLocalAfterUpload: typeof value.removeLocalAfterUpload === "boolean" ? value.removeLocalAfterUpload : false
    });
  } catch {
    return settings;
  }
}

export function offsiteBackupConfigFilePath() {
  return path.resolve(process.cwd(), "public", "uploads", offsiteBackupConfigVolumePath);
}

function envLine(key: string, value: string | boolean | null) {
  return `${key}=${value === null ? "" : String(value)}\n`;
}

export function offsiteBackupSettingsToEnv(settings: OffsiteBackupSettings, updatedAt = new Date()) {
  return [
    "# Generated by Bouncecore admin. Do not add private age identity keys here.\n",
    envLine("OFFSITE_ENABLED", settings.enabled),
    envLine("OFFSITE_DESTINATION_TYPE", settings.destinationType),
    envLine("OFFSITE_GOOGLE_DRIVE_REMOTE_NAME", settings.googleDriveRemoteName),
    envLine("OFFSITE_GOOGLE_DRIVE_FOLDER", settings.googleDriveFolder),
    envLine("OFFSITE_AGE_RECIPIENT", settings.ageRecipient),
    envLine("OFFSITE_RCLONE_REMOTE", settings.rcloneRemote),
    envLine("OFFSITE_RCLONE_CONFIG_VOLUME_PATH", googleDriveRcloneConfigVolumePath),
    envLine("OFFSITE_OUTPUT_DIR", settings.outputDir),
    envLine("OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD", settings.removeLocalAfterUpload),
    envLine("UPDATED_AT", updatedAt.toISOString())
  ].join("");
}

async function offsiteBackupConfigFileExists() {
  try {
    const fileStat = await stat(/* turbopackIgnore: true */ offsiteBackupConfigFilePath());

    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function writeOffsiteBackupConfig(settings: OffsiteBackupSettings) {
  const configFile = offsiteBackupConfigFilePath();

  await mkdir(path.dirname(configFile), { recursive: true });
  await writeFile(configFile, offsiteBackupSettingsToEnv(settings), { mode: 0o600 });

  return configFile;
}

async function readOffsiteBackupSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: offsiteBackupSettingsKey
    }
  });

  return {
    settings: mergeOffsiteBackupSettings(setting?.value),
    source: setting ? ("database" as const) : ("default" as const),
    updatedAt: setting?.updatedAt ?? null
  };
}

export async function getOffsiteBackupSettings() {
  return readOffsiteBackupSettings();
}

export async function getAdminOffsiteBackupSettingsData(): Promise<AdminOffsiteBackupSettingsData> {
  const { settings, source, updatedAt } = await readOffsiteBackupSettings();
  const configFilePresent = await offsiteBackupConfigFileExists();

  return {
    checks: [
      {
        detail: settings.enabled
          ? "Scheduled backups will try to export encrypted packages through the saved rclone destination."
          : "Off-server export is disabled until an owner saves and enables this setting.",
        label: "Off-server export",
        status: settings.enabled ? "ready" : "warning",
        value: settings.enabled ? "enabled" : "disabled"
      },
      {
        detail: settings.rcloneRemote
          ? settings.destinationType === "google-drive"
            ? `Encrypted backup packages upload to Google Drive through ${settings.rcloneRemote}.`
            : `Encrypted backup packages upload to ${settings.rcloneRemote}.`
          : "Configure an rclone remote on the server, then save its destination here.",
        label: "External destination",
        status: settings.rcloneRemote ? "ready" : "warning",
        value: settings.rcloneRemote ? (settings.destinationType === "google-drive" ? "Google Drive" : "set") : "missing"
      },
      {
        detail: configFilePresent
          ? `The generated config file exists at ${offsiteBackupConfigVolumePath}.`
          : "The generated config file is missing. Rewrite it from the saved settings before relying on the backup timer.",
        label: "Generated config",
        status: configFilePresent ? "ready" : "warning",
        value: configFilePresent ? "present" : "missing"
      },
      {
        detail: settings.ageRecipient
          ? "A public age recipient is saved. Keep the private age identity key somewhere else."
          : "Generate an age key pair and paste only the public age1 recipient here.",
        label: "Encryption recipient",
        status: settings.ageRecipient ? "ready" : "warning",
        value: settings.ageRecipient ? "set" : "missing"
      }
    ],
    configFilePath: offsiteBackupConfigFilePath(),
    configFilePresent,
    configVolumePath: offsiteBackupConfigVolumePath,
    settings,
    source,
    updatedAt: updatedAt?.toISOString() ?? null
  };
}

export async function syncOffsiteBackupConfig(actorId: string) {
  const { settings, source } = await readOffsiteBackupSettings();
  const configFile = await writeOffsiteBackupConfig(settings);

  await writeAuditLog({
    actorId,
    action: "backup.offsite_settings.sync_config",
    target: `app-setting:${offsiteBackupSettingsKey}`,
    severity: settings.enabled ? "warning" : "info",
    metadata: {
      configVolumePath: offsiteBackupConfigVolumePath,
      enabled: settings.enabled,
      localConfigFileWritten: configFile,
      destinationType: settings.destinationType,
      rcloneRemoteSet: Boolean(settings.rcloneRemote),
      source
    }
  });

  return {
    configFile,
    settings,
    source
  };
}

export async function updateOffsiteBackupSettings(input: OffsiteBackupSettingsInput, actorId: string) {
  const settings = normalizeOffsiteBackupSettingsInput(input);

  await prisma.appSetting.upsert({
    where: {
      key: offsiteBackupSettingsKey
    },
    update: {
      description: "Encrypted off-server backup export configuration.",
      isSecret: false,
      value: settings as Prisma.InputJsonValue
    },
    create: {
      description: "Encrypted off-server backup export configuration.",
      isSecret: false,
      key: offsiteBackupSettingsKey,
      value: settings as Prisma.InputJsonValue
    }
  });

  const configFile = await writeOffsiteBackupConfig(settings);

  await writeAuditLog({
    actorId,
    action: "backup.offsite_settings.update",
    target: `app-setting:${offsiteBackupSettingsKey}`,
    severity: settings.enabled ? "warning" : "info",
    metadata: {
      configVolumePath: offsiteBackupConfigVolumePath,
      destinationType: settings.destinationType,
      enabled: settings.enabled,
      localConfigFileWritten: configFile,
      outputDirSet: Boolean(settings.outputDir),
      rcloneRemoteSet: Boolean(settings.rcloneRemote),
      removeLocalAfterUpload: settings.removeLocalAfterUpload
    }
  });

  return settings;
}
