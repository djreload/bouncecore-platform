import assert from "node:assert/strict";
import test from "node:test";
import { buildFcmMessage, fcmErrorMeansDeviceRevoked } from "../src/lib/mobile/fcm-push-service.ts";

test("buildFcmMessage creates an Android FCM notification payload", () => {
  const payload = buildFcmMessage({
    body: "Message body",
    deliveryId: "delivery_1",
    notificationId: "notification_1",
    title: "Message title",
    token: "fcm-token",
    type: "platform"
  });

  assert.equal(payload.message.token, "fcm-token");
  assert.equal(payload.message.notification.title, "Message title");
  assert.equal(payload.message.notification.body, "Message body");
  assert.equal(payload.message.android.priority, "HIGH");
  assert.equal(payload.message.android.notification.channel_id, "bouncecore_notifications");
  assert.deepEqual(payload.message.data, {
    deliveryId: "delivery_1",
    notificationId: "notification_1",
    type: "platform"
  });
});

test("fcmErrorMeansDeviceRevoked detects expired or mismatched Android tokens", () => {
  assert.equal(fcmErrorMeansDeviceRevoked("UNREGISTERED"), true);
  assert.equal(fcmErrorMeansDeviceRevoked("SENDER_ID_MISMATCH"), true);
  assert.equal(fcmErrorMeansDeviceRevoked("INVALID_ARGUMENT"), false);
  assert.equal(fcmErrorMeansDeviceRevoked(null), false);
});
