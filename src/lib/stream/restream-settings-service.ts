import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import {
  buildRestreamTargetUrl,
  mergeRestreamSettingsInput,
  normalizeRestreamSettings,
  restreamProviderForSlot,
  restreamTargetSlots,
  toAdminRestreamSettings,
  type RestreamSettingsInput,
  type RestreamTargetSlot
} from "@/lib/stream/restream-settings";
import { getAdminYouTubeRestreamConnection } from "@/lib/stream/youtube-restream-oauth";
import {
  getActiveFacebookRestreamTargetUrl,
  getAdminFacebookRestreamConnection,
  getFacebookRestreamConnectionRecord
} from "@/lib/stream/facebook-restream-oauth";

const restreamSettingsKeys: Record<RestreamTargetSlot, string> = {
  primary: "stream.restream_settings",
  secondary: "stream.restream_settings.secondary"
};

export async function getRestreamSettings(slot: RestreamTargetSlot = "primary") {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: restreamSettingsKeys[slot]
    }
  });

  return {
    ...normalizeRestreamSettings(setting?.value),
    provider: restreamProviderForSlot(slot)
  };
}

export async function getAdminRestreamSettings(slot: RestreamTargetSlot = "primary") {
  return toAdminRestreamSettings(await getRestreamSettings(slot));
}

export async function getAdminRestreamTargets() {
  return Promise.all(
    restreamTargetSlots.map(async (slot) => {
      const [settings, facebookConnection, youtubeConnection] = await Promise.all([
        getRestreamSettings(slot),
        getAdminFacebookRestreamConnection(slot),
        getAdminYouTubeRestreamConnection(slot)
      ]);

      return {
        ...toAdminRestreamSettings(settings),
        facebookConnection,
        slot,
        youtubeConnection
      };
    })
  );
}

export async function getRestreamTargetUrl(slot: RestreamTargetSlot = "primary") {
  const settings = await getRestreamSettings(slot);

  if (settings.provider === "facebook") {
    const connection = await getFacebookRestreamConnectionRecord(slot);

    if (connection) {
      return getActiveFacebookRestreamTargetUrl(slot);
    }
  }

  return buildRestreamTargetUrl(settings);
}

export async function updateRestreamSettings(
  input: RestreamSettingsInput,
  actorId: string,
  slot: RestreamTargetSlot = "primary"
) {
  const existing = await getRestreamSettings(slot);
  const settings = mergeRestreamSettingsInput(
    {
      ...input,
      provider: restreamProviderForSlot(slot)
    },
    existing
  );

  if (settings.enabled) {
    const connectedFacebookPage = settings.provider === "facebook"
      ? await getFacebookRestreamConnectionRecord(slot)
      : null;

    if (!connectedFacebookPage) {
      try {
        buildRestreamTargetUrl(settings);
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : "Restream target is invalid.");
      }
    }
  }

  await prisma.appSetting.upsert({
    where: {
      key: restreamSettingsKeys[slot]
    },
    update: {
      description: `Secret external stream restream ${slot} target settings.`,
      isSecret: true,
      value: settings
    },
    create: {
      description: `Secret external stream restream ${slot} target settings.`,
      isSecret: true,
      key: restreamSettingsKeys[slot],
      value: settings
    }
  });

  const adminSettings = toAdminRestreamSettings(settings);

  await writeAuditLog({
    actorId,
    action: "stream.restream_settings.update",
    target: `stream:restream:${slot}`,
    severity: settings.enabled ? "warning" : "info",
    metadata: {
      enabled: settings.enabled,
      slot,
      provider: settings.provider,
      targetHost: adminSettings.targetHost,
      streamKeyConfigured: adminSettings.streamKeyConfigured
    }
  });

  return settings;
}
