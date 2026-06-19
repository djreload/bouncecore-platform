import assert from "node:assert/strict";
import { test } from "node:test";
import {
  eventNotificationDedupeKey,
  mobileEventDeliveryStatus,
  streamLiveNotificationContent,
  streamLiveNotificationDedupePrefix,
  streamLiveNotificationType
} from "../src/lib/mobile/event-notification-core.ts";

test("stream live notifications use a stable per-session dedupe prefix", () => {
  const prefix = streamLiveNotificationDedupePrefix({
    channelId: "channel_1",
    sessionId: "session_1"
  });

  assert.equal(prefix, `${streamLiveNotificationType}:channel_1:session_1`);
  assert.equal(eventNotificationDedupeKey(prefix, "user_1"), `${streamLiveNotificationType}:channel_1:session_1:user:user_1`);
});

test("stream live notifications build readable push content", () => {
  assert.deepEqual(streamLiveNotificationContent("Bouncecore Live"), {
    body: "Tap to watch the stream and join chat.",
    title: "Bouncecore Live is live",
    type: streamLiveNotificationType
  });
});

test("mobile event push delivery queues encrypted devices when encryption is configured", () => {
  assert.deepEqual(
    mobileEventDeliveryStatus({
      encryptionReady: true,
      tokenCiphertext: "v1.token",
    }),
    {
      errorCode: null,
      errorMessage: null,
      status: "queued"
    }
  );
});

test("mobile event push delivery blocks devices without encrypted tokens", () => {
  assert.deepEqual(
    mobileEventDeliveryStatus({
      encryptionReady: true,
      tokenCiphertext: null
    }),
    {
      errorCode: "missing_encrypted_token",
      errorMessage: "Device was registered before encrypted token storage was configured.",
      status: "blocked"
    }
  );
});

test("mobile event push delivery blocks encrypted devices when encryption is missing", () => {
  assert.deepEqual(
    mobileEventDeliveryStatus({
      encryptionReady: false,
      tokenCiphertext: "v1.token"
    }),
    {
      errorCode: "missing_encryption_key",
      errorMessage: "PUSH_TOKEN_ENCRYPTION_KEY is required before queued pushes can be delivered.",
      status: "blocked"
    }
  );
});
