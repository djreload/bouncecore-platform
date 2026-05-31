import { Prisma, type PrismaClient } from "@prisma/client";
import { permissionDefinitions, roleDefinitions, rolePermissions } from "@/lib/auth/rbac";

type SeedClient = PrismaClient | Prisma.TransactionClient;

export async function seedRbac(client: SeedClient) {
  for (const permission of permissionDefinitions) {
    await client.permission.upsert({
      where: { key: permission.key },
      update: {
        group: permission.group,
        description: permission.description
      },
      create: {
        key: permission.key,
        group: permission.group,
        description: permission.description
      }
    });
  }

  for (const role of roleDefinitions) {
    await client.role.upsert({
      where: { name: role.key },
      update: {
        description: role.description,
        system: true
      },
      create: {
        name: role.key,
        description: role.description,
        system: true
      }
    });
  }

  for (const role of roleDefinitions) {
    const dbRole = await client.role.findUniqueOrThrow({ where: { name: role.key } });

    for (const permissionKey of rolePermissions[role.key]) {
      const permission = await client.permission.findUniqueOrThrow({ where: { key: permissionKey } });

      await client.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: dbRole.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: dbRole.id,
          permissionId: permission.id
        }
      });
    }
  }

  await client.appSetting.upsert({
    where: { key: "platform.name" },
    update: { value: "Bouncecore" },
    create: {
      key: "platform.name",
      value: "Bouncecore",
      description: "Public platform name."
    }
  });
}
