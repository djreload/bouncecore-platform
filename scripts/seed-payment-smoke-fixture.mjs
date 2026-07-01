#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const smokeProducerEmail = "payment-smoke-producer@bouncecore.local";
const smokeProducerName = "Payment Smoke Producer";
const smokeTrackSlugPrefix = "payment-smoke-track";

function usage() {
  console.error(`Usage:
  node scripts/seed-payment-smoke-fixture.mjs [--env-file .env.instance] [--admin-email owner@example.com] [--download-url /uploads/music-downloads/file.mp3] [--price-pence 100] [--force-new] [--json]

Creates or refreshes a staging-only paid music track from a dedicated smoke producer so Admin -> Payments can run all PayPal smoke scenarios.

The script refuses to run when PAYPAL_MODE is live unless --allow-live is passed.`);
}

function parseArgs(argv) {
  const options = {
    adminEmail: "",
    allowLive: false,
    downloadUrl: "",
    envFile: "",
    forceNew: false,
    json: false,
    pricePence: 100
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--allow-live") {
      options.allowLive = true;
      continue;
    }

    if (arg === "--force-new") {
      options.forceNew = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      usage();
      throw new Error(`${arg} requires a value.`);
    }

    if (arg === "--admin-email") {
      options.adminEmail = next.trim().toLowerCase();
      index += 1;
      continue;
    }

    if (arg === "--download-url") {
      options.downloadUrl = next.trim();
      index += 1;
      continue;
    }

    if (arg === "--env-file") {
      options.envFile = next.trim();
      index += 1;
      continue;
    }

    if (arg === "--price-pence") {
      options.pricePence = Number(next);
      index += 1;
      continue;
    }

    usage();
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isInteger(options.pricePence) || options.pricePence < 50 || options.pricePence > 10000) {
    throw new Error("--price-pence must be an integer between 50 and 10000.");
  }

  return options;
}

function loadEnvFile(path) {
  if (!path) {
    return;
  }

  if (!existsSync(path)) {
    throw new Error(`Environment file not found: ${path}`);
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    let value = valueParts.join("=").trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key.trim()] ??= value;
  }
}

function prismaClient() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://bouncecore:change-me@localhost:5432/bouncecore_platform";
  const adapter = new PrismaPg(new Pool({ connectionString }));

  return new PrismaClient({ adapter });
}

function assertSafeMode(options) {
  const mode = (process.env.PAYPAL_MODE ?? "").trim().toLowerCase();

  if (mode === "live" && !options.allowLive) {
    throw new Error("Refusing to seed payment smoke fixtures while PAYPAL_MODE=live. Pass --allow-live only for an intentional staging/live drill.");
  }
}

function isUsableDownloadUrl(value) {
  return Boolean(value && typeof value === "string" && value.trim() && !value.includes("\n") && !value.includes("\r"));
}

async function findSmokeAdmin(prisma, adminEmail) {
  const where = adminEmail
    ? {
        email: adminEmail,
        roles: {
          some: {
            role: {
              name: {
                in: ["owner", "admin"]
              }
            }
          }
        }
      }
    : {
        roles: {
          some: {
            role: {
              name: {
                in: ["owner", "admin"]
              }
            }
          }
        }
      };

  return prisma.user.findFirst({
    orderBy: {
      createdAt: "asc"
    },
    select: {
      email: true,
      id: true
    },
    where
  });
}

async function findSourceTrack(prisma, downloadUrl) {
  if (downloadUrl) {
    return {
      artworkUrl: null,
      downloadUrl,
      genre: "bounce",
      previewUrl: null
    };
  }

  return prisma.digitalTrack.findFirst({
    orderBy: {
      createdAt: "asc"
    },
    select: {
      artworkUrl: true,
      downloadUrl: true,
      genre: true,
      previewUrl: true
    },
    where: {
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
  });
}

async function ensureSmokeProducer(prisma) {
  const user = await prisma.user.upsert({
    create: {
      displayName: smokeProducerName,
      email: smokeProducerEmail,
      emailVerifiedAt: new Date(),
      status: "active"
    },
    update: {
      displayName: smokeProducerName,
      status: "active"
    },
    where: {
      email: smokeProducerEmail
    }
  });

  return prisma.producerProfile.upsert({
    create: {
      bio: "Staging-only producer used for PayPal music checkout smoke tests.",
      name: smokeProducerName,
      paypalPayoutEmail: smokeProducerEmail,
      slug: "payment-smoke-producer",
      userId: user.id
    },
    update: {
      bio: "Staging-only producer used for PayPal music checkout smoke tests.",
      name: smokeProducerName,
      paypalPayoutEmail: smokeProducerEmail,
      slug: "payment-smoke-producer"
    },
    where: {
      userId: user.id
    }
  });
}

async function findReusableSmokeTrack(prisma, adminUserId, producerId) {
  return prisma.digitalTrack.findFirst({
    orderBy: {
      createdAt: "desc"
    },
    where: {
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
      ],
      pricePence: {
        gt: 0
      },
      producerId,
      purchases: {
        none: {
          buyerId: adminUserId,
          status: "paid"
        }
      },
      slug: {
        startsWith: smokeTrackSlugPrefix
      },
      status: "approved"
    }
  });
}

function smokeTrackInput({ producerId, sourceTrack, pricePence, slug }) {
  return {
    artworkUrl: sourceTrack.artworkUrl,
    downloadUrl: sourceTrack.downloadUrl,
    genre: sourceTrack.genre ?? "bounce",
    licenseSummary: "Staging-only PayPal smoke test delivery asset.",
    licenseType: "personal",
    previewUrl: sourceTrack.previewUrl,
    pricePence,
    producerId,
    slug,
    status: "approved",
    title: "Payment Smoke Track"
  };
}

async function seedPaymentSmokeFixture(prisma, options) {
  const admin = await findSmokeAdmin(prisma, options.adminEmail);

  if (!admin) {
    throw new Error(options.adminEmail ? `No owner/admin user found for ${options.adminEmail}.` : "No owner/admin user found.");
  }

  const sourceTrack = await findSourceTrack(prisma, options.downloadUrl);

  if (!sourceTrack || !isUsableDownloadUrl(sourceTrack.downloadUrl)) {
    throw new Error("No usable music download URL exists. Upload one track first or pass --download-url.");
  }

  const producer = await ensureSmokeProducer(prisma);
  const reusableTrack = options.forceNew ? null : await findReusableSmokeTrack(prisma, admin.id, producer.id);
  const slug = reusableTrack?.slug ?? `${smokeTrackSlugPrefix}-${Date.now().toString(36)}`;
  const data = smokeTrackInput({
    pricePence: options.pricePence,
    producerId: producer.id,
    slug,
    sourceTrack
  });
  const track = reusableTrack
    ? await prisma.digitalTrack.update({
        data,
        where: {
          id: reusableTrack.id
        }
      })
    : await prisma.digitalTrack.create({
        data
      });

  return {
    adminEmail: admin.email,
    producerEmail: smokeProducerEmail,
    reusedExistingTrack: Boolean(reusableTrack),
    track: {
      downloadUrl: track.downloadUrl,
      id: track.id,
      pricePence: track.pricePence,
      slug: track.slug,
      title: track.title
    }
  };
}

async function main() {
  const options = parseArgs(process.argv);

  loadEnvFile(options.envFile);
  assertSafeMode(options);

  const prisma = prismaClient();

  try {
    const result = await seedPaymentSmokeFixture(prisma, options);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Payment smoke music fixture ready.");
      console.log(`Admin user: ${result.adminEmail}`);
      console.log(`Producer: ${result.producerEmail}`);
      console.log(`Track: ${result.track.title} (${result.track.slug})`);
      console.log(`Price: ${result.track.pricePence}p`);
      console.log(`Download URL: ${result.track.downloadUrl}`);
      console.log(`Reused existing track: ${result.reusedExistingTrack ? "yes" : "no"}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
