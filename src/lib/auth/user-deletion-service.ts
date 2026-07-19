import { prisma } from "@/lib/db/prisma";
import { cleanupDeletedManagedUploads } from "@/lib/media/upload-cleanup-service";

type UserDeletionMode = "admin" | "self";

export type DeleteUserAndRelatedDataInput = {
  actorId: string;
  mode: UserDeletionMode;
  reason?: string | null;
  targetUserId: string;
};

export type DeletedUserSummary = {
  displayName: string;
  email: string;
  id: string;
};

type DeletedUserTransactionResult = DeletedUserSummary & {
  uploadPaths: Array<string | null>;
};

function normalizedDeletionReason(reason: string | null | undefined) {
  const value = reason?.trim() ?? "";

  if (!value) {
    return null;
  }

  if (value.length > 1000) {
    throw new Error("Reason must be 1000 characters or fewer.");
  }

  return value;
}

export async function deleteUserAndRelatedData(input: DeleteUserAndRelatedDataInput): Promise<DeletedUserSummary> {
  const reason = normalizedDeletionReason(input.reason);

  const result: DeletedUserTransactionResult = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: {
        id: input.targetUserId
      },
      include: {
        profile: {
          select: {
            avatarUrl: true
          }
        },
        roles: {
          include: {
            role: true
          }
        }
      }
    });
    const removedChatMedia = await tx.chatMessage.findMany({
      where: {
        userId: user.id
      },
      select: {
        mediaPreviewUrl: true,
        mediaUrl: true
      }
    });
    const removedReportMedia = await tx.chatReport.findMany({
      where: {
        OR: [
          {
            reporterId: user.id
          },
          {
            targetUserId: user.id
          }
        ]
      },
      select: {
        mediaPreviewUrl: true
      }
    });
    const removedDirectMessageMedia = await tx.directMessage.findMany({
      where: {
        conversation: {
          OR: [{ userOneId: user.id }, { userTwoId: user.id }]
        }
      },
      select: {
        mediaPreviewUrl: true,
        mediaUrl: true
      }
    });
    const removedProducerTrackMedia = await tx.digitalTrack.findMany({
      where: {
        producer: {
          userId: user.id
        }
      },
      select: {
        artworkUrl: true,
        downloadUrl: true,
        previewUrl: true,
        purchases: {
          select: {
            downloadUrl: true
          }
        }
      }
    });
    const removedBuyerPurchaseMedia = await tx.digitalTrackPurchase.findMany({
      where: {
        buyerId: user.id
      },
      select: {
        downloadUrl: true
      }
    });
    const uploadPaths = [
      user.profile?.avatarUrl ?? null,
      ...removedChatMedia.flatMap((message) => [message.mediaUrl, message.mediaPreviewUrl]),
      ...removedDirectMessageMedia.flatMap((message) => [message.mediaUrl, message.mediaPreviewUrl]),
      ...removedReportMedia.map((report) => report.mediaPreviewUrl),
      ...removedProducerTrackMedia.flatMap((track) => [
        track.artworkUrl,
        track.previewUrl,
        track.downloadUrl,
        ...track.purchases.map((purchase) => purchase.downloadUrl)
      ]),
      ...removedBuyerPurchaseMedia.map((purchase) => purchase.downloadUrl)
    ];

    const isOwner = user.roles.some((userRole) => userRole.role.name === "owner");

    if (isOwner) {
      const otherOwnerCount = await tx.userRole.count({
        where: {
          role: {
            name: "owner"
          },
          userId: {
            not: user.id
          },
          user: {
            status: {
              in: ["active", "pending"]
            }
          }
        }
      });

      if (otherOwnerCount < 1) {
        throw new Error("You cannot delete the last server owner account.");
      }
    }

    await tx.auditLog.create({
      data: {
        action: input.mode === "self" ? "user.delete.self" : "user.delete.admin",
        actorId: input.actorId,
        metadata: {
          deletedUserId: user.id,
          mode: input.mode,
          ...(reason ? { reason } : {})
        },
        severity: "critical",
        target: `user:${user.id}`
      }
    });

    await tx.userRole.updateMany({
      where: {
        assignedById: user.id
      },
      data: {
        assignedById: null
      }
    });

    await tx.emailVerificationToken.deleteMany({
      where: {
        email: user.email
      }
    });

    await tx.passwordResetToken.deleteMany({
      where: {
        email: user.email
      }
    });

    await tx.userInvite.deleteMany({
      where: {
        OR: [
          {
            createdById: user.id
          },
          {
            email: user.email
          }
        ]
      }
    });

    await tx.supportRequest.deleteMany({
      where: {
        OR: [
          {
            userId: user.id
          },
          {
            email: user.email
          }
        ]
      }
    });

    await tx.chatReport.deleteMany({
      where: {
        OR: [
          {
            reporterId: user.id
          },
          {
            targetUserId: user.id
          }
        ]
      }
    });

    await tx.chatSheepThrow.deleteMany({
      where: {
        OR: [
          {
            throwerId: user.id
          },
          {
            targetUserId: user.id
          }
        ]
      }
    });

    await tx.chatMessage.deleteMany({
      where: {
        userId: user.id
      }
    });

    await tx.starWallet.deleteMany({
      where: {
        userId: user.id
      }
    });

    await tx.user.delete({
      where: {
        id: user.id
      }
    });

    return {
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      uploadPaths
    };
  });

  await cleanupDeletedManagedUploads(result.uploadPaths);

  return {
    displayName: result.displayName,
    email: result.email,
    id: result.id
  };
}
