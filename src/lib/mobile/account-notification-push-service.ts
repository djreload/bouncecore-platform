import { prisma } from "@/lib/db/prisma";
import { mobileEventDeliveryStatus } from "@/lib/mobile/event-notification-core";
import { secretEncryptionConfigured } from "@/lib/security/secret-crypto";

export type AccountNotificationPushQueueResult = {
  blockedPushDeliveryCount: number;
  duplicatePushDeliveryCount: number;
  pushDeliveryCount: number;
  queuedPushDeliveryCount: number;
  registeredDeviceCount: number;
};

export async function queueMobilePushForNotification(input: {
  notificationId: string;
  userId: string;
}): Promise<AccountNotificationPushQueueResult> {
  const devices = await prisma.mobileDevice.findMany({
    select: {
      id: true,
      platform: true,
      provider: true,
      tokenCiphertext: true
    },
    where: {
      revokedAt: null,
      userId: input.userId
    }
  });

  if (!devices.length) {
    return {
      blockedPushDeliveryCount: 0,
      duplicatePushDeliveryCount: 0,
      pushDeliveryCount: 0,
      queuedPushDeliveryCount: 0,
      registeredDeviceCount: 0
    };
  }

  const existingDeliveries = await prisma.mobilePushDelivery.findMany({
    select: {
      mobileDeviceId: true
    },
    where: {
      mobileDeviceId: {
        in: devices.map((device) => device.id)
      },
      notificationId: input.notificationId
    }
  });
  const existingDeviceIds = new Set(existingDeliveries.map((delivery) => delivery.mobileDeviceId));
  const encryptionReady = secretEncryptionConfigured();
  const pushDeliveries = devices
    .filter((device) => !existingDeviceIds.has(device.id))
    .map((device) => {
      const delivery = mobileEventDeliveryStatus({
        encryptionReady,
        tokenCiphertext: device.tokenCiphertext
      });

      return {
        errorCode: delivery.errorCode,
        errorMessage: delivery.errorMessage,
        mobileDeviceId: device.id,
        notificationId: input.notificationId,
        platform: device.platform,
        provider: device.provider,
        status: delivery.status
      };
    });

  if (pushDeliveries.length) {
    await prisma.mobilePushDelivery.createMany({
      data: pushDeliveries
    });
  }

  return {
    blockedPushDeliveryCount: pushDeliveries.filter((delivery) => delivery.status === "blocked").length,
    duplicatePushDeliveryCount: existingDeviceIds.size,
    pushDeliveryCount: pushDeliveries.length,
    queuedPushDeliveryCount: pushDeliveries.filter((delivery) => delivery.status === "queued").length,
    registeredDeviceCount: devices.length
  };
}
