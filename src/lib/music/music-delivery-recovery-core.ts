export const repairPaidMusicDeliveryConfirmationText = "REPAIR PAID MUSIC DELIVERY";
export const paidMusicDeliveryRecoveryBatchLimit = 500;

export type PaidMusicDeliveryRecoveryResult = {
  repairedPurchases: number;
  scannedPurchases: number;
  skippedPurchases: number;
  trackIds: string[];
};

export function paidMusicDeliveryRecoveryMessage(result: PaidMusicDeliveryRecoveryResult) {
  const repaired = result.repairedPurchases.toLocaleString("en-GB");
  const skipped = result.skippedPurchases.toLocaleString("en-GB");

  return `${repaired} paid music purchase delivery snapshot${result.repairedPurchases === 1 ? "" : "s"} repaired. ${skipped} still need track delivery URLs.`;
}
