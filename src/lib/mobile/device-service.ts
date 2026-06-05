import { writeAuditLog } from "@/lib/auth/audit";
import type { CurrentUser } from "@/lib/auth/rbac";
import { hashSecretToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";

export const mobileDeviceProviders = ["expo", "fcm", "apns", "web"] as const;
export const mobileDevicePlatforms = ["ios", "android", "web"] as const;

export type MobileDeviceProvider = (typeof mobileDeviceProviders)[number];
export type MobileDevicePlatform = (typeof mobileDevicePlatforms)[number];

export type MobileDeviceInput = {
  appVersion?: string;
  deviceName?: string;
  osVersion?: string;
  platform?: string;
  provider?: string;
  pushToken?: string;
};

export type MobileDeviceRow = {
  appVersion: string | null;
  createdAt: string;
  deviceName: string | null;
  id: string;
  lastSeenAt: string;
  osVersion: string | null;
  platform: string;
  provider: string;
  revokedAt: string | null;
  tokenPreview: string;
  updatedAt: string;
};

function normalizedText(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function normalizedProvider(value: string | undefined): MobileDeviceProvider {
  const provider = value?.trim().toLowerCase() ?? "";

  if (mobileDeviceProviders.includes(provider as MobileDeviceProvider)) {
    return provider as MobileDeviceProvider;
  }

  throw new Error("Provider must be expo, fcm, apns, or web.");
}

function normalizedPlatform(value: string | undefined): MobileDevicePlatform {
  const platform = value?.trim().toLowerCase() ?? "";

  if (mobileDevicePlatforms.includes(platform as MobileDevicePlatform)) {
    return platform as MobileDevicePlatform;
  }

  throw new Error("Platform must be ios, android, or web.");
}

function normalizedPushToken(value: string | undefined) {
  const token = value?.trim() ?? "";

  if (token.length < 12 || token.length > 4096) {
    throw new Error("Push token must be between 12 and 4096 characters.");
  }

  return token;
}

function tokenPreview(token: string) {
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function toMobileDeviceRow(device: {
  appVersion: string | null;
  createdAt: Date;
  deviceName: string | null;
  id: string;
  lastSeenAt: Date;
  osVersion: string | null;
  platform: string;
  provider: string;
  revokedAt: Date | null;
  tokenPreview: string;
  updatedAt: Date;
}): MobileDeviceRow {
  return {
    appVersion: device.appVersion,
    createdAt: device.createdAt.toISOString(),
    deviceName: device.deviceName,
    id: device.id,
    lastSeenAt: device.lastSeenAt.toISOString(),
    osVersion: device.osVersion,
    platform: device.platform,
    provider: device.provider,
    revokedAt: device.revokedAt?.toISOString() ?? null,
    tokenPreview: device.tokenPreview,
    updatedAt: device.updatedAt.toISOString()
  };
}

export async function getMobileDevices(user: CurrentUser) {
  const devices = await prisma.mobileDevice.findMany({
    where: {
      userId: user.id
    },
    orderBy: [
      {
        revokedAt: "asc"
      },
      {
        lastSeenAt: "desc"
      }
    ]
  });

  return {
    devices: devices.map(toMobileDeviceRow),
    stats: {
      active: devices.filter((device) => !device.revokedAt).length,
      revoked: devices.filter((device) => device.revokedAt).length,
      total: devices.length
    }
  };
}

export async function registerMobileDevice(user: CurrentUser, input: MobileDeviceInput) {
  const provider = normalizedProvider(input.provider);
  const platform = normalizedPlatform(input.platform);
  const pushToken = normalizedPushToken(input.pushToken);
  const now = new Date();
  const device = await prisma.mobileDevice.upsert({
    where: {
      tokenHash: hashSecretToken(`${provider}:${pushToken}`)
    },
    update: {
      appVersion: normalizedText(input.appVersion, 40),
      deviceName: normalizedText(input.deviceName, 120),
      lastSeenAt: now,
      osVersion: normalizedText(input.osVersion, 80),
      platform,
      provider,
      revokedAt: null,
      tokenPreview: tokenPreview(pushToken),
      userId: user.id
    },
    create: {
      appVersion: normalizedText(input.appVersion, 40),
      deviceName: normalizedText(input.deviceName, 120),
      lastSeenAt: now,
      osVersion: normalizedText(input.osVersion, 80),
      platform,
      provider,
      tokenHash: hashSecretToken(`${provider}:${pushToken}`),
      tokenPreview: tokenPreview(pushToken),
      userId: user.id
    }
  });

  await writeAuditLog({
    actorId: user.id,
    action: "mobile.device.register",
    target: `mobile-device:${device.id}`,
    severity: "info",
    metadata: {
      platform,
      provider
    }
  });

  return toMobileDeviceRow(device);
}

export async function revokeMobileDevice(user: CurrentUser, deviceId: string) {
  const id = deviceId.trim();

  if (!id) {
    throw new Error("Device ID is required.");
  }

  const result = await prisma.mobileDevice.updateMany({
    where: {
      id,
      userId: user.id,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  if (result.count !== 1) {
    throw new Error("Active device was not found.");
  }

  await writeAuditLog({
    actorId: user.id,
    action: "mobile.device.revoke",
    target: `mobile-device:${id}`,
    severity: "info"
  });

  return {
    id,
    revoked: true
  };
}
