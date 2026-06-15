export const workerHeartbeatSettingKey = "worker.heartbeat";

export type WorkerHeartbeatTask = {
  enabled: boolean;
  intervalMs: number;
  name: string;
};

export type WorkerHeartbeatSnapshot = {
  checkedAt: string;
  service: "bouncecore-worker";
  tasks: WorkerHeartbeatTask[];
};

export type WorkerHeartbeatStatus = {
  detail: string;
  status: "healthy" | "warning" | "critical";
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTask(value: unknown): WorkerHeartbeatTask | null {
  if (!isRecord(value) || typeof value.name !== "string") {
    return null;
  }

  const intervalMs = typeof value.intervalMs === "number" && Number.isFinite(value.intervalMs) ? value.intervalMs : 0;

  return {
    enabled: value.enabled === true,
    intervalMs,
    name: value.name
  };
}

export function parseWorkerHeartbeat(value: unknown): WorkerHeartbeatSnapshot | null {
  if (!isRecord(value) || value.service !== "bouncecore-worker" || typeof value.checkedAt !== "string") {
    return null;
  }

  const tasks = Array.isArray(value.tasks) ? value.tasks.map(parseTask).filter((task) => task !== null) : [];

  return {
    checkedAt: value.checkedAt,
    service: "bouncecore-worker",
    tasks
  };
}

export function getWorkerHeartbeatStatus(
  heartbeat: WorkerHeartbeatSnapshot | null,
  options: {
    now?: Date;
    staleAfterSeconds?: number;
  } = {}
): WorkerHeartbeatStatus {
  if (!heartbeat) {
    return {
      detail: "No database worker heartbeat has been recorded yet. The worker may be disabled or not deployed.",
      status: "warning",
      value: "Not recorded"
    };
  }

  const checkedAtMs = Date.parse(heartbeat.checkedAt);

  if (!Number.isFinite(checkedAtMs)) {
    return {
      detail: "The saved worker heartbeat timestamp is invalid.",
      status: "warning",
      value: "Invalid"
    };
  }

  const now = options.now ?? new Date();
  const staleAfterSeconds = options.staleAfterSeconds ?? 120;
  const ageSeconds = Math.max(0, Math.round((now.getTime() - checkedAtMs) / 1000));
  const enabledTasks = heartbeat.tasks.filter((task) => task.enabled).length;
  const taskDetail = heartbeat.tasks.length
    ? `${enabledTasks}/${heartbeat.tasks.length} worker tasks enabled.`
    : "No task metadata was reported.";

  if (ageSeconds > staleAfterSeconds) {
    return {
      detail: `Last worker heartbeat was ${ageSeconds}s ago, beyond the ${staleAfterSeconds}s threshold. ${taskDetail}`,
      status: "critical",
      value: `${ageSeconds}s stale`
    };
  }

  return {
    detail: `Last worker heartbeat was ${ageSeconds}s ago. ${taskDetail}`,
    status: "healthy",
    value: `${ageSeconds}s ago`
  };
}
