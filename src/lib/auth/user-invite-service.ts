import { z } from "zod";
import { writeAuditLog } from "@/lib/auth/audit";
import { roleDefinitions, type Role } from "@/lib/auth/rbac";
import { createSecretToken, hashSecretToken, tokenFingerprint } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";

export const inviteAssignableRoles = roleDefinitions.filter((role) => role.key !== "owner");

export type UserInviteInput = {
  email: string;
  expiresDays: string;
  note?: string;
  roles: string[];
};

export type AdminUserInvitesData = Array<{
  acceptedAt: string | null;
  acceptedByDisplayName: string | null;
  createdAt: string;
  createdByDisplayName: string;
  email: string;
  expiresAt: string;
  id: string;
  note: string | null;
  revokedAt: string | null;
  revokedByDisplayName: string | null;
  roles: Role[];
  status: string;
}>;

export type RegisterInvitePreview = {
  email: string;
  expiresAt: string;
  roles: Role[];
};

const inviteEmailSchema = z.string().trim().toLowerCase().email().max(255);
const inviteRoleKeys: ReadonlySet<string> = new Set(inviteAssignableRoles.map((role) => role.key));

function normalizeNote(value: string | undefined) {
  const note = value?.trim() ?? "";

  if (!note) {
    return null;
  }

  if (note.length > 240) {
    throw new Error("Invite note must be 240 characters or fewer.");
  }

  return note;
}

function parseExpiresDays(value: string) {
  const days = Number(value);

  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error("Invite expiry must be between 1 and 90 days.");
  }

  return days;
}

export function normalizeInviteRoles(values: string[]): Role[] {
  const roles = Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value): value is Role => inviteRoleKeys.has(value as Role))
    )
  );

  if (!roles.includes("viewer")) {
    roles.unshift("viewer");
  }

  return roles;
}

export function rolesFromInviteJson(value: unknown): Role[] {
  if (!Array.isArray(value)) {
    return ["viewer"];
  }

  return normalizeInviteRoles(value.filter((role): role is string => typeof role === "string"));
}

function inviteIsUsable(invite: {
  acceptedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  status: string;
}) {
  return invite.status === "pending" && !invite.acceptedAt && !invite.revokedAt && invite.expiresAt > new Date();
}

export async function getAdminUserInvites(): Promise<AdminUserInvitesData> {
  const invites = await prisma.userInvite.findMany({
    include: {
      acceptedBy: {
        select: {
          displayName: true
        }
      },
      createdBy: {
        select: {
          displayName: true
        }
      },
      revokedBy: {
        select: {
          displayName: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });

  return invites.map((invite) => ({
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    acceptedByDisplayName: invite.acceptedBy?.displayName ?? null,
    createdAt: invite.createdAt.toISOString(),
    createdByDisplayName: invite.createdBy.displayName,
    email: invite.email,
    expiresAt: invite.expiresAt.toISOString(),
    id: invite.id,
    note: invite.note,
    revokedAt: invite.revokedAt?.toISOString() ?? null,
    revokedByDisplayName: invite.revokedBy?.displayName ?? null,
    roles: rolesFromInviteJson(invite.roles),
    status: invite.status
  }));
}

export async function createAdminUserInvite(input: UserInviteInput, actorId: string) {
  const email = inviteEmailSchema.parse(input.email);
  const roles = normalizeInviteRoles(input.roles);
  const expiresDays = parseExpiresDays(input.expiresDays);
  const token = createSecretToken("bc_invite");

  const invite = await prisma.userInvite.create({
    data: {
      createdById: actorId,
      email,
      expiresAt: new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000),
      note: normalizeNote(input.note),
      roles,
      tokenHash: hashSecretToken(token)
    }
  });

  await writeAuditLog({
    actorId,
    action: "user.invite.create",
    target: `user-invite:${invite.id}`,
    severity: roles.includes("admin") ? "warning" : "info",
    metadata: {
      email,
      expiresDays,
      roles,
      tokenFingerprint: tokenFingerprint(token)
    }
  });

  return {
    invite,
    token
  };
}

export async function revokeAdminUserInvite(inviteId: string, actorId: string) {
  if (!inviteId) {
    throw new Error("Missing invite.");
  }

  const invite = await prisma.userInvite.findUniqueOrThrow({
    where: {
      id: inviteId
    }
  });

  if (!inviteIsUsable(invite)) {
    throw new Error("Only pending, unused invites can be revoked.");
  }

  const revoked = await prisma.userInvite.update({
    where: {
      id: invite.id
    },
    data: {
      revokedAt: new Date(),
      revokedById: actorId,
      status: "revoked"
    }
  });

  await writeAuditLog({
    actorId,
    action: "user.invite.revoke",
    target: `user-invite:${revoked.id}`,
    severity: "warning",
    metadata: {
      email: revoked.email
    }
  });
}

export async function getRegisterInvitePreview(inviteToken: string | undefined): Promise<RegisterInvitePreview | null> {
  const token = inviteToken?.trim();

  if (!token) {
    return null;
  }

  const invite = await prisma.userInvite.findUnique({
    where: {
      tokenHash: hashSecretToken(token)
    }
  });

  if (!invite || !inviteIsUsable(invite)) {
    return null;
  }

  return {
    email: invite.email,
    expiresAt: invite.expiresAt.toISOString(),
    roles: rolesFromInviteJson(invite.roles)
  };
}
