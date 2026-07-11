export const streamLiveNotificationType = "stream.live";

export type MobileEventDeliveryStatus = {
  errorCode: string | null;
  errorMessage: string | null;
  status: "blocked" | "queued";
};

export function eventNotificationDedupeKey(prefix: string, userId: string) {
  return `${prefix}:user:${userId}`;
}

export function mobileEventDeliveryStatus(input: {
  encryptionReady: boolean;
  tokenCiphertext: string | null;
}): MobileEventDeliveryStatus {
  if (!input.tokenCiphertext) {
    return {
      errorCode: "missing_encrypted_token",
      errorMessage: "Device was registered before encrypted token storage was configured.",
      status: "blocked"
    };
  }

  if (!input.encryptionReady) {
    return {
      errorCode: "missing_encryption_key",
      errorMessage: "PUSH_TOKEN_ENCRYPTION_KEY is required before queued pushes can be delivered.",
      status: "blocked"
    };
  }

  return {
    errorCode: null,
    errorMessage: null,
    status: "queued"
  };
}

export function streamLiveNotificationDedupePrefix(input: { channelId: string; sessionId: string }) {
  return `${streamLiveNotificationType}:${input.channelId}:${input.sessionId}`;
}

export function streamLiveNotificationContent(channelTitle: string, hostDisplayName?: string | null) {
  const title = channelTitle.trim() || "Bouncecore Live";
  const host = hostDisplayName?.trim();

  return {
    body: host ? `Tap to watch ${title} and join chat.` : "Tap to watch the stream and join chat.",
    title: host ? `${host} is live` : `${title} is live`,
    type: streamLiveNotificationType
  };
}
