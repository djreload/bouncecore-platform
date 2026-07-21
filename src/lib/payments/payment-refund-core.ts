export function nextRefundTotal(currentPence: number, incomingPence: number, paidPence: number) {
  return Math.min(Math.max(0, paidPence), Math.max(0, currentPence) + Math.max(0, incomingPence));
}

export function paymentRefundStatus(refundedPence: number, paidPence: number) {
  return refundedPence >= paidPence ? "refunded" : "partially-refunded";
}

export function proportionalStarRefund(input: {
  alreadyRefundedStars: number;
  incomingRefundPence: number;
  purchasePence: number;
  purchasedStars: number;
}) {
  if (input.purchasePence <= 0 || input.purchasedStars <= 0) {
    return 0;
  }

  const target = Math.min(
    input.purchasedStars,
    Math.floor((Math.max(0, input.incomingRefundPence) / input.purchasePence) * input.purchasedStars)
  );

  return Math.max(0, target - Math.max(0, input.alreadyRefundedStars));
}
