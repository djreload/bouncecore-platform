export const raveWarDiagnosticStaleMs = 150_000;

export type RaveWarDiagnosticEvent = {
  createdAt: Date;
  payload: unknown;
  sequence: number;
  type: string;
};

export type RaveWarEventWindowDiagnostics = {
  actionIdCount: number;
  averageEventGapMs: number | null;
  duplicateActionIdCount: number;
  inspectedEventCount: number;
  latestEventAt: Date | null;
  maxEventGapMs: number | null;
  moveCount: number;
  sequenceGapCount: number;
  shotCount: number;
  totalEventCount: number;
};

export function raveWarClientActionIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const actionId = (payload as Record<string, unknown>).clientActionId;

  return typeof actionId === "string" && actionId.length > 0 ? actionId : null;
}

export function analyzeRaveWarEventWindow(events: RaveWarDiagnosticEvent[], totalEventCount = events.length): RaveWarEventWindowDiagnostics {
  const orderedEvents = events.slice().sort((first, second) => first.sequence - second.sequence);
  const actionIds: string[] = [];
  let eventGapTotalMs = 0;
  let maxEventGapMs: number | null = null;
  let sequenceGapCount = 0;

  for (let index = 0; index < orderedEvents.length; index += 1) {
    const event = orderedEvents[index];
    const actionId = raveWarClientActionIdFromPayload(event.payload);

    if (actionId) {
      actionIds.push(actionId);
    }

    const previousEvent = orderedEvents[index - 1];

    if (!previousEvent) {
      continue;
    }

    if (event.sequence !== previousEvent.sequence + 1) {
      sequenceGapCount += 1;
    }

    const gapMs = Math.max(0, event.createdAt.getTime() - previousEvent.createdAt.getTime());

    eventGapTotalMs += gapMs;
    maxEventGapMs = maxEventGapMs === null ? gapMs : Math.max(maxEventGapMs, gapMs);
  }

  const gapCount = Math.max(0, orderedEvents.length - 1);
  const latestEvent = orderedEvents.at(-1) ?? null;

  return {
    actionIdCount: actionIds.length,
    averageEventGapMs: gapCount > 0 ? Math.round(eventGapTotalMs / gapCount) : null,
    duplicateActionIdCount: actionIds.length - new Set(actionIds).size,
    inspectedEventCount: orderedEvents.length,
    latestEventAt: latestEvent?.createdAt ?? null,
    maxEventGapMs,
    moveCount: orderedEvents.filter((event) => event.type === "player.moved").length,
    sequenceGapCount,
    shotCount: orderedEvents.filter((event) => event.type === "shot.fired").length,
    totalEventCount: Math.max(totalEventCount, orderedEvents.length)
  };
}

export function raveWarMatchNeedsAttention(input: {
  diagnostics: Pick<RaveWarEventWindowDiagnostics, "duplicateActionIdCount" | "latestEventAt" | "sequenceGapCount">;
  now?: Date;
  status: string;
  updatedAt: Date;
}) {
  if (input.diagnostics.duplicateActionIdCount > 0 || input.diagnostics.sequenceGapCount > 0) {
    return true;
  }

  return raveWarMatchIsStalled({
    latestEventAt: input.diagnostics.latestEventAt,
    now: input.now,
    status: input.status,
    updatedAt: input.updatedAt
  });
}

export function raveWarMatchIsStalled(input: {
  latestEventAt: Date | null;
  now?: Date;
  status: string;
  updatedAt: Date;
}) {
  if (input.status !== "active") {
    return false;
  }

  const nowMs = (input.now ?? new Date()).getTime();
  const latestActivityMs = Math.max(input.updatedAt.getTime(), input.latestEventAt?.getTime() ?? 0);

  return nowMs - latestActivityMs > raveWarDiagnosticStaleMs;
}
