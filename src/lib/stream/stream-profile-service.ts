import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/auth/audit";

export type StreamProfileSummary = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  videoWidth: number;
  videoHeight: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  fps: number;
  keyframeSeconds: number;
  isEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
};

export type StreamProfileInput = {
  id: string;
  label: string;
  description?: string;
  videoWidth: number;
  videoHeight: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  fps: number;
  keyframeSeconds: number;
  isEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
};

const defaultStreamProfiles = [
  {
    key: "low",
    label: "Low bitrate",
    description: "Stable mobile-friendly profile for weak upload connections.",
    videoWidth: 854,
    videoHeight: 480,
    videoBitrateKbps: 1200,
    audioBitrateKbps: 128,
    fps: 30,
    keyframeSeconds: 2,
    isEnabled: true,
    isDefault: false,
    sortOrder: 10
  },
  {
    key: "standard",
    label: "Standard HD",
    description: "Balanced 720p profile for regular live shows.",
    videoWidth: 1280,
    videoHeight: 720,
    videoBitrateKbps: 3000,
    audioBitrateKbps: 160,
    fps: 30,
    keyframeSeconds: 2,
    isEnabled: true,
    isDefault: true,
    sortOrder: 20
  },
  {
    key: "hd",
    label: "High HD",
    description: "1080p profile for strong upload connections.",
    videoWidth: 1920,
    videoHeight: 1080,
    videoBitrateKbps: 6000,
    audioBitrateKbps: 192,
    fps: 30,
    keyframeSeconds: 2,
    isEnabled: true,
    isDefault: false,
    sortOrder: 30
  },
  {
    key: "high-hd",
    label: "High HD 60",
    description: "1080p60 profile for high-motion streams and strong connections.",
    videoWidth: 1920,
    videoHeight: 1080,
    videoBitrateKbps: 8000,
    audioBitrateKbps: 320,
    fps: 60,
    keyframeSeconds: 2,
    isEnabled: true,
    isDefault: false,
    sortOrder: 40
  }
] as const;

function clampInteger(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function normalizeInput(input: StreamProfileInput) {
  return {
    audioBitrateKbps: clampInteger(input.audioBitrateKbps, 64, 320),
    description: input.description?.trim() || null,
    fps: clampInteger(input.fps, 15, 120),
    isDefault: input.isDefault,
    isEnabled: input.isEnabled,
    keyframeSeconds: clampInteger(input.keyframeSeconds, 1, 10),
    label: input.label.trim() || "Stream profile",
    sortOrder: clampInteger(input.sortOrder, 0, 999),
    videoBitrateKbps: clampInteger(input.videoBitrateKbps, 250, 20000),
    videoHeight: clampInteger(input.videoHeight, 180, 2160),
    videoWidth: clampInteger(input.videoWidth, 320, 3840)
  };
}

export function streamProfileToSummary(profile: StreamProfileSummary | null | undefined): StreamProfileSummary | null {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    key: profile.key,
    label: profile.label,
    description: profile.description,
    videoWidth: profile.videoWidth,
    videoHeight: profile.videoHeight,
    videoBitrateKbps: profile.videoBitrateKbps,
    audioBitrateKbps: profile.audioBitrateKbps,
    fps: profile.fps,
    keyframeSeconds: profile.keyframeSeconds,
    isEnabled: profile.isEnabled,
    isDefault: profile.isDefault,
    sortOrder: profile.sortOrder
  };
}

function toSummary(profile: StreamProfileSummary): StreamProfileSummary {
  return streamProfileToSummary(profile) as StreamProfileSummary;
}

export function profileLabel(profile: StreamProfileSummary | null | undefined) {
  if (!profile) {
    return "Not configured";
  }

  return `${profile.label} (${profile.videoHeight}p${profile.fps}, ${profile.videoBitrateKbps} Kbps)`;
}

export async function ensureDefaultStreamProfiles(actorId?: string) {
  await prisma.$transaction(async (tx) => {
    for (const profile of defaultStreamProfiles) {
      await tx.streamProfile.upsert({
        where: {
          key: profile.key
        },
        create: profile,
        update: {}
      });
    }

    const defaultProfile = await tx.streamProfile.findFirst({
      where: {
        isDefault: true,
        isEnabled: true
      }
    });

    if (!defaultProfile) {
      await tx.streamProfile.update({
        where: {
          key: "standard"
        },
        data: {
          isDefault: true,
          isEnabled: true
        }
      });
    }
  });

  if (actorId) {
    await writeAuditLog({
      actorId,
      action: "stream.profiles.ensure_defaults",
      target: "stream-profiles",
      severity: "info",
      metadata: {
        count: String(defaultStreamProfiles.length)
      }
    });
  }
}

export async function getStreamProfiles(options: { includeDisabled?: boolean } = {}) {
  await ensureDefaultStreamProfiles();

  const profiles = await prisma.streamProfile.findMany({
    where: options.includeDisabled
      ? undefined
      : {
          isEnabled: true
        },
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        label: "asc"
      }
    ]
  });

  return profiles.map(toSummary);
}

export async function getDefaultStreamProfile() {
  await ensureDefaultStreamProfiles();

  const profile =
    (await prisma.streamProfile.findFirst({
      where: {
        isDefault: true,
        isEnabled: true
      },
      orderBy: {
        sortOrder: "asc"
      }
    })) ??
    (await prisma.streamProfile.findFirst({
      where: {
        isEnabled: true
      },
      orderBy: {
        sortOrder: "asc"
      }
    }));

  return profile ? toSummary(profile) : null;
}

export async function updateStreamProfile(input: StreamProfileInput, actorId: string) {
  const data = normalizeInput(input);

  const profile = await prisma.$transaction(async (tx) => {
    const existing = await tx.streamProfile.findUniqueOrThrow({
      where: {
        id: input.id
      }
    });

    if (data.isDefault) {
      await tx.streamProfile.updateMany({
        where: {
          id: {
            not: input.id
          }
        },
        data: {
          isDefault: false
        }
      });
    }

    const updated = await tx.streamProfile.update({
      where: {
        id: input.id
      },
      data: {
        ...data,
        isEnabled: data.isEnabled || data.isDefault
      }
    });

    const enabledDefault = await tx.streamProfile.findFirst({
      where: {
        isDefault: true,
        isEnabled: true
      }
    });

    if (!enabledDefault) {
      await tx.streamProfile.update({
        where: {
          id: updated.id
        },
        data: {
          isDefault: true,
          isEnabled: true
        }
      });
    }

    return {
      previousLabel: existing.label,
      profile: await tx.streamProfile.findUniqueOrThrow({
        where: {
          id: updated.id
        }
      })
    };
  });

  await writeAuditLog({
    actorId,
    action: "stream.profile.update",
    target: `stream-profile:${profile.profile.id}`,
    severity: "info",
    metadata: {
      key: profile.profile.key,
      label: profile.profile.label,
      previousLabel: profile.previousLabel
    }
  });

  return toSummary(profile.profile);
}
