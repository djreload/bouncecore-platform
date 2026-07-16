export const reconnectBaseDelayMs = 1000;
export const reconnectMaximumDelayMs = 15_000;

export function reconnectDelayMs(attempt: number, baseDelayMs = reconnectBaseDelayMs, maximumDelayMs = reconnectMaximumDelayMs) {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.trunc(attempt)) : 0;
  const safeBase = Number.isFinite(baseDelayMs) ? Math.max(100, Math.trunc(baseDelayMs)) : reconnectBaseDelayMs;
  const safeMaximum = Number.isFinite(maximumDelayMs) ? Math.max(safeBase, Math.trunc(maximumDelayMs)) : reconnectMaximumDelayMs;

  return Math.min(safeMaximum, safeBase * 2 ** Math.min(safeAttempt, 8));
}
