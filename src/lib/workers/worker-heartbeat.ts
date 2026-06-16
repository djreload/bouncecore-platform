import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import {
  parseWorkerHeartbeat,
  workerHeartbeatSettingKey,
  type WorkerHeartbeatSnapshot,
  type WorkerHeartbeatTask
} from "./worker-heartbeat-core";

export {
  getWorkerHeartbeatStatus,
  parseWorkerHeartbeat,
  workerHeartbeatSettingKey,
  type WorkerHeartbeatSnapshot,
  type WorkerHeartbeatStatus,
  type WorkerHeartbeatTask
} from "./worker-heartbeat-core";

export async function getLatestWorkerHeartbeat() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: workerHeartbeatSettingKey
    }
  });

  return parseWorkerHeartbeat(setting?.value);
}

export async function recordWorkerHeartbeat(tasks: WorkerHeartbeatTask[]) {
  const heartbeat: WorkerHeartbeatSnapshot = {
    checkedAt: new Date().toISOString(),
    service: "bouncecore-worker",
    tasks
  };

  await prisma.appSetting.upsert({
    where: {
      key: workerHeartbeatSettingKey
    },
    update: {
      description: "Latest database heartbeat written by the Bouncecore background worker.",
      isSecret: false,
      value: heartbeat as Prisma.InputJsonValue
    },
    create: {
      description: "Latest database heartbeat written by the Bouncecore background worker.",
      isSecret: false,
      key: workerHeartbeatSettingKey,
      value: heartbeat as Prisma.InputJsonValue
    }
  });

  return heartbeat;
}
