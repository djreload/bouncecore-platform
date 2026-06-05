import { prisma } from "../src/lib/db/prisma";
import { seedRbac } from "../src/lib/auth/rbac-seed";

async function main() {
  await seedRbac(prisma);
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
