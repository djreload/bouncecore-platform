export const liveStarSendAmounts = [10, 25, 50, 100, 250, 500, 1000, 2000, 2500] as const;
export const liveStarSendMaximum = 2500;

export function normalizeLiveStarSendAmount(value: string) {
  const amount = Number(value);

  if (!Number.isInteger(amount) || !liveStarSendAmounts.includes(amount as (typeof liveStarSendAmounts)[number])) {
    throw new Error(`Choose a valid star amount up to ${liveStarSendMaximum.toLocaleString("en-GB")}.`);
  }

  return amount;
}
