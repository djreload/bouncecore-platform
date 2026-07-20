export const raveWarProcessedActionLimit = 64;

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
