import { setTimeout as sleep } from "node:timers/promises";
import { writeFile } from "node:fs/promises";
import { pruneExpiredChatHistory } from "../lib/chat/chat-service";
import { prisma } from "../lib/db/prisma";
import { checkExpoMobilePushReceipts, processQueuedMobilePushDeliveries } from "../lib/mobile/push-dispatch-service";
import { syncStreamProviderSnapshot } from "../lib/stream/stream-session-sync-service";

type WorkerTask = {
  enabled: boolean;
  intervalMs: number;
  name: string;
  run: () => Promise<unknown>;
};

let stopping = false;

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function envBoolean(key: string, fallback: boolean) {
  const value = envValue(key).toLowerCase();

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value);
}

function envNumber(key: string, fallback: number) {
  const value = Number(envValue(key));

  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function log(level: "info" | "warn" | "error", message: string, metadata: Record<string, unknown> = {}) {
  console[level](
    JSON.stringify({
      level,
      message,
      service: "bouncecore-worker",
      time: new Date().toISOString(),
      ...metadata
    })
  );
}

async function heartbeat() {
  await writeFile("/tmp/bouncecore-worker-heartbeat", new Date().toISOString()).catch(() => {
    return;
  });
}

async function runHeartbeatLoop() {
  while (!stopping) {
    await heartbeat();
    await sleep(30_000);
  }
}

async function runLoop(task: WorkerTask) {
  if (!task.enabled) {
    log("info", "Worker task disabled.", {
      task: task.name
    });
    return;
  }

  log("info", "Worker task started.", {
    intervalMs: task.intervalMs,
    task: task.name
  });

  while (!stopping) {
    const startedAt = Date.now();

    try {
      const result = await task.run();
      await heartbeat();
      log("info", "Worker task completed.", {
        durationMs: Date.now() - startedAt,
        result,
        task: task.name
      });
    } catch (error) {
      log("error", "Worker task failed.", {
        error: error instanceof Error ? error.message : "Unknown error.",
        task: task.name
      });
    }

    await sleep(task.intervalMs);
  }
}

async function shutdown() {
  stopping = true;
  log("info", "Worker shutdown requested.");
  await prisma.$disconnect();
}

process.once("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

const mobilePushLimit = envNumber("WORKER_MOBILE_PUSH_LIMIT", 50);
const tasks: WorkerTask[] = [
  {
    enabled: envBoolean("WORKER_CHAT_PRUNE_ENABLED", true),
    intervalMs: envNumber("WORKER_CHAT_PRUNE_INTERVAL_SECONDS", 3600) * 1000,
    name: "chat-history-prune",
    run: async () => ({
      deletedMessages: await pruneExpiredChatHistory()
    })
  },
  {
    enabled: envBoolean("WORKER_STREAM_SYNC_ENABLED", true),
    intervalMs: envNumber("WORKER_STREAM_SYNC_INTERVAL_SECONDS", 15) * 1000,
    name: "stream-provider-sync",
    run: syncStreamProviderSnapshot
  },
  {
    enabled: envBoolean("WORKER_MOBILE_PUSH_DISPATCH_ENABLED", true),
    intervalMs: envNumber("WORKER_MOBILE_PUSH_DISPATCH_INTERVAL_SECONDS", 60) * 1000,
    name: "mobile-push-dispatch",
    run: () => processQueuedMobilePushDeliveries(null, mobilePushLimit)
  },
  {
    enabled: envBoolean("WORKER_MOBILE_PUSH_RECEIPTS_ENABLED", true),
    intervalMs: envNumber("WORKER_MOBILE_PUSH_RECEIPT_INTERVAL_SECONDS", 300) * 1000,
    name: "mobile-push-receipts",
    run: () => checkExpoMobilePushReceipts(null, mobilePushLimit)
  }
];

log("info", "Bouncecore worker booting.", {
  tasks: tasks.map((task) => ({
    enabled: task.enabled,
    intervalMs: task.intervalMs,
    name: task.name
  }))
});

await heartbeat();
void runHeartbeatLoop();
await Promise.all(tasks.map((task) => runLoop(task)));
