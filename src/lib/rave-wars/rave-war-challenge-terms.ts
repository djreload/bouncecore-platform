export function formatRaveWarRuleDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (!minutes) {
    return `${remainingSeconds}s`;
  }

  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export function formatRaveWarChallengeCost(costStars: number | null) {
  if (costStars === null || !Number.isFinite(costStars)) {
    return "Legacy";
  }

  const safeCost = Math.max(0, Math.floor(costStars));
  return safeCost === 0 ? "Free" : `${safeCost.toLocaleString("en-GB")} stars`;
}
