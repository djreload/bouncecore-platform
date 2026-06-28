import { prisma } from "@/lib/db/prisma";

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

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: {
        id: input.targetUserId
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

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
      id: user.id
    };
  });
}
