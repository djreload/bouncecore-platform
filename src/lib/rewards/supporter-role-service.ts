import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const automaticSupporterRoleName = "supporter";

type RoleGrantClient = Prisma.TransactionClient | typeof prisma;

export async function grantAutomaticSupporterRole(userId: string, client: RoleGrantClient = prisma) {
  const role = await client.role.upsert({
    where: {
      name: automaticSupporterRoleName
    },
    update: {},
    create: {
      description: "Supporter/VIP role granted automatically after a successful stars purchase.",
      name: automaticSupporterRoleName,
      system: true
    }
  });

  return client.userRole.upsert({
    where: {
      userId_roleId: {
        roleId: role.id,
        userId
      }
    },
    update: {},
    create: {
      assignedById: null,
      roleId: role.id,
      userId
    }
  });
}
