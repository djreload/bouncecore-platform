export const raveWarProcessedActionLimit = 64;

export type RaveWarConnectionState = "connecting" | "live" | "polling" | "reconnecting";
export type RaveWarNetworkCounter = "actionRetryCount" | "fallbackCount" | "reconnectCount" | "staleSnapshotCount";
export type RaveWarNetworkQuality = "backup" | "fair" | "good" | "poor" | "recovering";

export type RaveWarNetworkDiagnostics = {
  actionRetryCount: number;
  averageLatencyMs: number | null;
  fallbackCount: number;
  latencySampleCount: number;
  peakLatencyMs: number | null;
  reconnectCount: number;
  staleSnapshotCount: number;
};

export const initialRaveWarNetworkDiagnostics: RaveWarNetworkDiagnostics = {
  actionRetryCount: 0,
  averageLatencyMs: null,
  fallbackCount: 0,
  latencySampleCount: 0,
  peakLatencyMs: null,
  reconnectCount: 0,
  staleSnapshotCount: 0
};

export function parseRaveWarClientActionId(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !/^[a-zA-Z0-9:_-]{8,96}$/.test(value)) {
    throw new Error("Rave War action ID is invalid.");
  }

  return value;
}

export function appendProcessedRaveWarActionId(actionIds: string[], actionId: string | null) {
  return actionId
    ? [...actionIds.filter((entry) => entry !== actionId), actionId].slice(-raveWarProcessedActionLimit)
    : actionIds.slice(-raveWarProcessedActionLimit);
}

export function shouldApplyRaveWarSnapshot(currentRevision: number, incomingRevision: number) {
  const safeCurrent = Number.isFinite(currentRevision) ? Math.max(0, Math.trunc(currentRevision)) : 0;
  const safeIncoming = Number.isFinite(incomingRevision) ? Math.max(0, Math.trunc(incomingRevision)) : 0;

  return safeIncoming >= safeCurrent;
}

export function recordRaveWarLatency(diagnostics: RaveWarNetworkDiagnostics, latencyMs: number) {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    return diagnostics;
  }

  const sample = Math.min(60_000, Math.round(latencyMs));
  const averageLatencyMs =
    diagnostics.averageLatencyMs === null ? sample : Math.round(diagnostics.averageLatencyMs * 0.75 + sample * 0.25);

  return {
    ...diagnostics,
    averageLatencyMs,
    latencySampleCount: diagnostics.latencySampleCount + 1,
    peakLatencyMs: diagnostics.peakLatencyMs === null ? sample : Math.max(diagnostics.peakLatencyMs, sample)
  };
}

export function incrementRaveWarNetworkCounter(diagnostics: RaveWarNetworkDiagnostics, counter: RaveWarNetworkCounter) {
  return {
    ...diagnostics,
    [counter]: Math.min(Number.MAX_SAFE_INTEGER, diagnostics[counter] + 1)
  };
}

export function getRaveWarNetworkQuality(connectionState: RaveWarConnectionState, averageLatencyMs: number | null): RaveWarNetworkQuality {
  if (connectionState === "connecting" || connectionState === "reconnecting") {
    return "recovering";
  }

  if (connectionState === "polling") {
    return "backup";
  }

  if (averageLatencyMs === null || averageLatencyMs < 250) {
    return "good";
  }

  if (averageLatencyMs < 700) {
    return "fair";
  }

  return "poor";
}
