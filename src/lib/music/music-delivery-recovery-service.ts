import { assertMaintenanceConfirmation } from "@/lib/admin/maintenance-core";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import {
  paidMusicDeliveryRecoveryBatchLimit,
  repairPaidMusicDeliveryConfirmationText,
  type PaidMusicDeliveryRecoveryResult
} from "@/lib/music/music-delivery-recovery-core";

type PaidMusicDeliveryRecoveryInput = {
  confirmation?: string;
  requireConfirmation?: boolean;
  trackId?: string;
  writeAuditWhenEmpty?: boolean;
};

function missingSnapshotWhere(trackId?: string): Prisma.DigitalTrackPurchaseWhereInput {
  return {
    ...(trackId ? { trackId } : {}),
    OR: [{ downloadUrl: null }, { downloadUrl: "" }],
    status: "paid"
  };
}

function recoverableTrackWhere(trackId?: string): Prisma.DigitalTrackPurchaseWhereInput {
  return {
    ...missingSnapshotWhere(trackId),
    track: {
      AND: [
        {
          downloadUrl: {
            not: null
          }
        },
        {
          downloadUrl: {
            not: ""
          }
        }
      ]
    }
  };
}

function unrecoverableTrackWhere(trackId?: string): Prisma.DigitalTrackPurchaseWhereInput {
  return {
    ...missingSnapshotWhere(trackId),
    track: {
      OR: [{ downloadUrl: null }, { downloadUrl: "" }]
    }
  };
}

export async function repairPaidMusicPurchaseDelivery(
  actorId: string,
  { confirmation, requireConfirmation = true, trackId, writeAuditWhenEmpty = true }: PaidMusicDeliveryRecoveryInput = {}
): Promise<PaidMusicDeliveryRecoveryResult> {
  if (requireConfirmation) {
    assertMaintenanceConfirmation(confirmation, repairPaidMusicDeliveryConfirmationText);
  }

  const candidates = await prisma.digitalTrackPurchase.findMany({
    include: {
      track: {
        select: {
          downloadUrl: true,
          licenseSummary: true,
          licenseType: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    take: paidMusicDeliveryRecoveryBatchLimit,
    where: recoverableTrackWhere(trackId)
  });
  const skippedPurchases = await prisma.digitalTrackPurchase.count({
    where: unrecoverableTrackWhere(trackId)
  });

  let repairedPurchases = 0;

  if (candidates.length) {
    await prisma.$transaction(async (tx) => {
      for (const purchase of candidates) {
        if (!purchase.track.downloadUrl) {
          continue;
        }

        const update = await tx.digitalTrackPurchase.updateMany({
          data: {
            downloadUrl: purchase.track.downloadUrl,
            licenseSummary: purchase.track.licenseSummary,
            licenseType: purchase.track.licenseType
          },
          where: {
            id: purchase.id,
            ...missingSnapshotWhere(trackId)
          }
        });

        repairedPurchases += update.count;
      }
    });
  }

  const trackIds = [...new Set(candidates.map((purchase) => purchase.trackId))];

  if (repairedPurchases > 0 || writeAuditWhenEmpty) {
    await writeAuditLog({
      action: "music.paid_delivery.repair",
      actorId,
      metadata: {
        batchLimit: paidMusicDeliveryRecoveryBatchLimit,
        repairedPurchases,
        scannedPurchases: candidates.length,
        skippedPurchases,
        trackId: trackId ?? null,
        trackIds: trackIds.slice(0, 100)
      },
      severity: repairedPurchases > 0 ? "warning" : "info",
      target: trackId ? `digital-track:${trackId}` : "music:paid-delivery"
    });
  }

  return {
    repairedPurchases,
    scannedPurchases: candidates.length,
    skippedPurchases,
    trackIds
  };
}
