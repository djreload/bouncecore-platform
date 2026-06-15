#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function usage() {
  console.error(`Usage:
  node scripts/temp-stream-key.mjs create --email user@example.com [--env-file .env.instance]
  node scripts/temp-stream-key.mjs revoke --key-id stream_key_id [--env-file .env.instance]`);
}

function parseArgs(argv) {
  const result = {
    command: argv[2] ?? "",
    options: {}
  };

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      result.options[key] = "true";
      continue;
    }

    result.options[key] = next;
    index += 1;
  }

  return result;
}

function loadEnvFile(path) {
  if (!path || !existsSync(path)) {
    return;
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

function requireOption(options, key) {
  const value = options[key]?.trim();

  if (!value) {
    usage();
    throw new Error(`Missing --${key}.`);
  }

  return value;
}

function createSecretToken(prefix) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

function hashSecretToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenFingerprint(token) {
  return hashSecretToken(token).slice(0, 16);
}

function prismaClient() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({
    connectionString
  });

  return {
    pool,
    prisma: new PrismaClient({
      adapter: new PrismaPg(pool)
    })
  };
}

async function createTemporaryKey(prisma, email) {
  const user = await prisma.user.findUnique({
    where: {
      email
    },
    select: {
      id: true
    }
  });

  if (!user) {
    throw new Error(`No user found for ${email}.`);
  }

  const channel = await prisma.streamChannel.findFirst({
    orderBy: {
      slug: "asc"
    },
    select: {
      id: true
    }
  });
  const rawKey = createSecretToken("bc_live");
  const fingerprint = tokenFingerprint(rawKey);
  const key = await prisma.streamKey.create({
    data: {
      channelId: channel?.id ?? null,
      fingerprint,
      keyHash: hashSecretToken(rawKey),
      status: "active",
      userId: user.id
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "stream.key.temp_smoke_create",
      metadata: {
        fingerprint,
        source: "stream-smoke-with-temp-key",
        targetUserId: user.id
      },
      severity: "critical",
      target: `stream-key:${key.id}`
    }
  });

  return {
    fingerprint,
    keyId: key.id,
    rawKey
  };
}

async function revokeTemporaryKey(prisma, keyId) {
  const key = await prisma.streamKey.findUnique({
    where: {
      id: keyId
    }
  });

  if (!key) {
    return {
      revoked: false
    };
  }

  await prisma.streamKey.update({
    data: {
      revokedAt: key.revokedAt ?? new Date(),
      status: key.revokedAt ? key.status : "revoked"
    },
    where: {
      id: key.id
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "stream.key.temp_smoke_revoke",
      metadata: {
        fingerprint: key.fingerprint,
        source: "stream-smoke-with-temp-key",
        targetUserId: key.userId
      },
      severity: "critical",
      target: `stream-key:${key.id}`
    }
  });

  return {
    fingerprint: key.fingerprint,
    keyId: key.id,
    revoked: true
  };
}

const { command, options } = parseArgs(process.argv);
loadEnvFile(options["env-file"]);

if (options.help === "true" || command === "--help" || command === "-h") {
  usage();
  process.exit(0);
}

if (!["create", "revoke"].includes(command)) {
  usage();
  process.exit(1);
}

let client;

try {
  client = prismaClient();
  const result =
    command === "create"
      ? await createTemporaryKey(client.prisma, requireOption(options, "email").toLowerCase())
      : await revokeTemporaryKey(client.prisma, requireOption(options, "key-id"));

  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Temporary stream key command failed.");
  process.exitCode = 1;
} finally {
  if (client) {
    await client.prisma.$disconnect();
    await client.pool.end();
  }
}
