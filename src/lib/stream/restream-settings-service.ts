import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import {
  buildRestreamTargetUrl,
  mergeRestreamSettingsInput,
  normalizeRestreamSettings,
  toAdminRestreamSettings,
  type RestreamSettingsInput
} from "@/lib/stream/restream-settings";

const restreamSettingsKey = "stream.restream_settings";

export async function getRestreamSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: restreamSettingsKey
    }
  });

  return normalizeRestreamSettings(setting?.value);
}

export async function getAdminRestreamSettings() {
  return toAdminRestreamSettings(await getRestreamSettings());
}

export async function getRestreamTargetUrl() {
  return buildRestreamTargetUrl(await getRestreamSettings());
}

export async function updateRestreamSettings(input: RestreamSettingsInput, actorId: string) {
  const existing = await getRestreamSettings();
  const settings = mergeRestreamSettingsInput(input, existing);

  if (settings.enabled) {
    try {
      buildRestreamTargetUrl(settings);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Restream target is invalid.");
    }
  }

  await prisma.appSetting.upsert({
    where: {
      key: restreamSettingsKey
    },
    update: {
      description: "Secret external stream restream target settings.",
      isSecret: true,
      value: settings
    },
    create: {
      description: "Secret external stream restream target settings.",
      isSecret: true,
      key: restreamSettingsKey,
      value: settings
    }
  });

  const adminSettings = toAdminRestreamSettings(settings);

  await writeAuditLog({
    actorId,
    action: "stream.restream_settings.update",
    target: "stream:restream",
    severity: settings.enabled ? "warning" : "info",
    metadata: {
      enabled: settings.enabled,
      provider: settings.provider,
      targetHost: adminSettings.targetHost,
      streamKeyConfigured: adminSettings.streamKeyConfigured
    }
  });

  return settings;
}
