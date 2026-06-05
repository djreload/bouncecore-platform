import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret, secretEncryptionConfigured } from "@/lib/security/secret-crypto";

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";
const expoPushReceiptsEndpoint = "https://exp.host/--/api/v2/push/getReceipts";
const defaultDispatchLimit = 50;
const maxDispatchLimit = 100;

type ExpoPushTicket = {
  details?: {
    error?: string;
  };
  id?: string;
  message?: string;
  status?: string;
};

type ExpoPushResponse = {
  data?: ExpoPushTicket | ExpoPushTicket[];
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
};

type ExpoPushReceipt = {
  details?: {
    error?: string;
  } & Record<string, unknown>;
  message?: string;
  status?: string;
};

type ExpoPushReceiptsResponse = {
  data?: Record<string, ExpoPushReceipt>;
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
};

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function normalizedLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) {
    return defaultDispatchLimit;
  }

  return Math.max(1, Math.min(Math.trunc(limit), maxDispatchLimit));
}

function compactMessage(value: string | null | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function expoHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json"
  };
  const accessToken = envValue("EXPO_PUSH_ACCESS_TOKEN");

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function ticketFromResponse(payload: ExpoPushResponse) {
  const data = Array.isArray(payload.data) ? payload.data[0] : payload.data;

  if (data) {
    return data;
  }

  return {
    details: {
      error: payload.errors?.[0]?.code
    },
    message: payload.errors?.[0]?.message,
    status: "error"
  } satisfies ExpoPushTicket;
}

async function sendExpoPush(input: {
  body: string | null;
  deliveryId: string;
  notificationId: string;
  title: string;
  token: string;
  type: string;
}) {
  const response = await fetch(expoPushEndpoint, {
    body: JSON.stringify({
      body: compactMessage(input.body, 1024),
      data: {
        deliveryId: input.deliveryId,
        notificationId: input.notificationId,
        type: input.type
      },
      sound: "default",
      title: compactMessage(input.title, 120),
      to: input.token
    }),
    headers: expoHeaders(),
    method: "POST",
    signal: AbortSignal.timeout(10000)
  });
  const payload = (await response.json().catch(() => ({}))) as ExpoPushResponse;

  if (!response.ok) {
    return {
      errorCode: payload.errors?.[0]?.code ?? `http_${response.status}`,
      errorMessage: payload.errors?.[0]?.message ?? `Expo push request failed with HTTP ${response.status}.`,
      ok: false as const
    };
  }

  const ticket = ticketFromResponse(payload);

  if (ticket.status === "ok" && ticket.id) {
    return {
      ok: true as const,
      providerMessageId: ticket.id
    };
  }

  return {
    errorCode: ticket.details?.error ?? "expo_ticket_error",
    errorMessage: ticket.message ?? "Expo rejected this push notification.",
    ok: false as const
  };
}

async function getExpoPushReceipts(ids: string[]) {
  const response = await fetch(expoPushReceiptsEndpoint, {
    body: JSON.stringify({
      ids
    }),
    headers: expoHeaders(),
    method: "POST",
    signal: AbortSignal.timeout(10000)
  });
  const payload = (await response.json().catch(() => ({}))) as ExpoPushReceiptsResponse;

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message ?? `Expo push receipt request failed with HTTP ${response.status}.`);
  }

  return payload.data ?? {};
}

function receiptErrorCode(receipt: ExpoPushReceipt) {
  return receipt.details?.error ?? "expo_receipt_error";
}

function receiptErrorMessage(receipt: ExpoPushReceipt) {
  return receipt.message ?? "Expo reported a push receipt error.";
}

export async function processQueuedMobilePushDeliveries(actorId: string, limit?: number) {
  const take = normalizedLimit(limit);
  const deliveries = await prisma.mobilePushDelivery.findMany({
    include: {
      mobileDevice: {
        select: {
          id: true,
          provider: true,
          revokedAt: true,
          tokenCiphertext: true
        }
      },
      notification: {
        select: {
          body: true,
          id: true,
          title: true,
          type: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    take,
    where: {
      status: "queued"
    }
  });
  let sentCount = 0;
  let failedCount = 0;
  let blockedCount = 0;
  const now = new Date();

  for (const delivery of deliveries) {
    if (delivery.mobileDevice.revokedAt) {
      blockedCount += 1;
      await prisma.mobilePushDelivery.update({
        data: {
          attemptedAt: now,
          errorCode: "device_revoked",
          errorMessage: "Device registration has been revoked.",
          status: "blocked"
        },
        where: {
          id: delivery.id
        }
      });
      continue;
    }

    if (!delivery.mobileDevice.tokenCiphertext || !secretEncryptionConfigured()) {
      blockedCount += 1;
      await prisma.mobilePushDelivery.update({
        data: {
          attemptedAt: now,
          errorCode: delivery.mobileDevice.tokenCiphertext ? "missing_encryption_key" : "missing_encrypted_token",
          errorMessage: delivery.mobileDevice.tokenCiphertext
            ? "PUSH_TOKEN_ENCRYPTION_KEY is required before queued pushes can be delivered."
            : "Device was registered before encrypted token storage was configured.",
          status: "blocked"
        },
        where: {
          id: delivery.id
        }
      });
      continue;
    }

    if (delivery.mobileDevice.provider !== "expo") {
      blockedCount += 1;
      await prisma.mobilePushDelivery.update({
        data: {
          attemptedAt: now,
          errorCode: "provider_not_supported",
          errorMessage: "Only Expo push delivery is currently wired. FCM, APNs, and web push are registered but not dispatched yet.",
          status: "blocked"
        },
        where: {
          id: delivery.id
        }
      });
      continue;
    }

    try {
      const token = decryptSecret(delivery.mobileDevice.tokenCiphertext);
      const result = await sendExpoPush({
        body: delivery.notification.body,
        deliveryId: delivery.id,
        notificationId: delivery.notification.id,
        title: delivery.notification.title,
        token,
        type: delivery.notification.type
      });

      if (result.ok) {
        sentCount += 1;
        await prisma.mobilePushDelivery.update({
          data: {
            attemptedAt: now,
            errorCode: null,
            errorMessage: null,
            providerMessageId: result.providerMessageId,
            sentAt: now,
            status: "sent"
          },
          where: {
            id: delivery.id
          }
        });
      } else {
        failedCount += 1;
        await prisma.$transaction([
          prisma.mobilePushDelivery.update({
            data: {
              attemptedAt: now,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
              status: "failed"
            },
            where: {
              id: delivery.id
            }
          }),
          ...(result.errorCode === "DeviceNotRegistered"
            ? [
                prisma.mobileDevice.update({
                  data: {
                    revokedAt: now
                  },
                  where: {
                    id: delivery.mobileDevice.id
                  }
                })
              ]
            : [])
        ]);
      }
    } catch (error) {
      failedCount += 1;
      await prisma.mobilePushDelivery.update({
        data: {
          attemptedAt: now,
          errorCode: "dispatch_error",
          errorMessage: error instanceof Error ? compactMessage(error.message, 500) : "Push dispatch failed.",
          status: "failed"
        },
        where: {
          id: delivery.id
        }
      });
    }
  }

  await writeAuditLog({
    action: "mobile.push.dispatch",
    actorId,
    metadata: {
      blockedCount,
      failedCount,
      limit: take,
      processedCount: deliveries.length,
      sentCount
    },
    severity: failedCount || blockedCount ? "warning" : "info"
  });

  return {
    blockedCount,
    failedCount,
    processedCount: deliveries.length,
    sentCount
  };
}

export async function checkExpoMobilePushReceipts(actorId: string, limit?: number) {
  const take = normalizedLimit(limit);
  const deliveries = await prisma.mobilePushDelivery.findMany({
    include: {
      mobileDevice: {
        select: {
          id: true
        }
      }
    },
    orderBy: {
      sentAt: "asc"
    },
    take,
    where: {
      provider: "expo",
      providerMessageId: {
        not: null
      },
      receiptStatus: null,
      status: "sent"
    }
  });
  const ids = deliveries.flatMap((delivery) => (delivery.providerMessageId ? [delivery.providerMessageId] : []));
  let deliveredCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  const now = new Date();

  if (!ids.length) {
    return {
      deliveredCount,
      failedCount,
      pendingCount,
      processedCount: 0
    };
  }

  const receipts = await getExpoPushReceipts(ids);

  for (const delivery of deliveries) {
    const receipt = delivery.providerMessageId ? receipts[delivery.providerMessageId] : undefined;

    if (!receipt) {
      pendingCount += 1;
      await prisma.mobilePushDelivery.update({
        data: {
          providerReceipt: {
            status: "pending"
          },
          receiptCheckedAt: now
        },
        where: {
          id: delivery.id
        }
      });
      continue;
    }

    if (receipt.status === "ok") {
      deliveredCount += 1;
      await prisma.mobilePushDelivery.update({
        data: {
          errorCode: null,
          errorMessage: null,
          providerReceipt: receipt as Prisma.InputJsonValue,
          receiptCheckedAt: now,
          receiptStatus: "ok",
          status: "delivered"
        },
        where: {
          id: delivery.id
        }
      });
      continue;
    }

    failedCount += 1;
    const errorCode = receiptErrorCode(receipt);
    await prisma.$transaction([
      prisma.mobilePushDelivery.update({
        data: {
          errorCode,
          errorMessage: receiptErrorMessage(receipt),
          providerReceipt: receipt as Prisma.InputJsonValue,
          receiptCheckedAt: now,
          receiptStatus: "error",
          status: "failed"
        },
        where: {
          id: delivery.id
        }
      }),
      ...(errorCode === "DeviceNotRegistered"
        ? [
            prisma.mobileDevice.update({
              data: {
                revokedAt: now
              },
              where: {
                id: delivery.mobileDevice.id
              }
            })
          ]
        : [])
    ]);
  }

  await writeAuditLog({
    action: "mobile.push.receipts",
    actorId,
    metadata: {
      deliveredCount,
      failedCount,
      limit: take,
      pendingCount,
      processedCount: deliveries.length
    },
    severity: failedCount ? "warning" : "info"
  });

  return {
    deliveredCount,
    failedCount,
    pendingCount,
    processedCount: deliveries.length
  };
}
