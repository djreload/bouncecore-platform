import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import {
  normalizeStreamPlaybackSettings,
  normalizeStreamPlaybackSettingsInput,
  type StreamPlaybackSettingsInput
} from "@/lib/stream/stream-playback-settings";

const streamPlaybackSettingsKey = "stream.playback_settings";

export async function getStreamPlaybackSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: streamPlaybackSettingsKey
    }
  });

  return normalizeStreamPlaybackSettings(setting?.value);
}

export async function updateStreamPlaybackSettings(input: StreamPlaybackSettingsInput, actorId: string) {
  const settings = normalizeStreamPlaybackSettingsInput(input);

  await prisma.appSetting.upsert({
    where: {
      key: streamPlaybackSettingsKey
    },
    update: {
      description: "Public livestream player and live-page display settings.",
      isSecret: false,
      value: settings
    },
    create: {
      description: "Public livestream player and live-page display settings.",
      isSecret: false,
      key: streamPlaybackSettingsKey,
      value: settings
    }
  });

  await writeAuditLog({
    actorId,
    action: "stream.playback_settings.update",
    target: "stream:playback",
    severity: "info",
    metadata: {
      playbackBufferSeconds: settings.playbackBufferSeconds,
      showUpcomingSets: settings.showUpcomingSets
    }
  });

  return settings;
}
