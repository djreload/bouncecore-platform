import { PrismaClient } from "@prisma/client";
import { permissionDefinitions, roleDefinitions, rolePermissions } from "../src/lib/auth/rbac";

const prisma = new PrismaClient();

async function main() {
  for (const permission of permissionDefinitions) {
    await prisma.permission.upsert({
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
    await prisma.role.upsert({
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
    const dbRole = await prisma.role.findUniqueOrThrow({ where: { name: role.key } });
    const grants = rolePermissions[role.key];

    for (const permissionKey of grants) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });

      await prisma.rolePermission.upsert({
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

  await prisma.appSetting.upsert({
    where: { key: "platform.name" },
    update: { value: "Bouncecore" },
    create: {
      key: "platform.name",
      value: "Bouncecore",
      description: "Public platform name."
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
