export const raveWarRefundableStatuses = ["cancelled", "declined", "expired"] as const;

export type RaveWarRefundableStatus = (typeof raveWarRefundableStatuses)[number];

export function isRaveWarRefundableStatus(status: string): status is RaveWarRefundableStatus {
  return raveWarRefundableStatuses.includes(status as RaveWarRefundableStatus);
}

export function raveWarEntryRefundEligibility(input: {
  entryStars: number;
  entryStarsRefundedAt: Date | string | null;
  status: string;
}) {
  if (input.entryStars <= 0) {
    return { eligible: false, reason: "This challenge did not charge entry stars." } as const;
  }

  if (input.entryStarsRefundedAt) {
    return { eligible: false, reason: "The entry stars have already been refunded." } as const;
  }

  if (!isRaveWarRefundableStatus(input.status)) {
    return { eligible: false, reason: "Only cancelled, declined, or expired challenges can be refunded." } as const;
  }

  return { eligible: true, reason: null } as const;
}
