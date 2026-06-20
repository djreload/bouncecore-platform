import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultNotificationPreferences,
  mergeNotificationPreferences,
  notificationDeliveryPreferences,
  notificationPreferenceCategoryForType,
  notificationPreferenceEnabled
} from "../src/lib/account/notification-preferences-core.ts";

test("notification preferences default every category to email and push", () => {
  const preferences = defaultNotificationPreferences();

  assert.equal(preferences.stream.email, true);
  assert.equal(preferences.stream.push, true);
  assert.equal(preferences.purchases.email, true);
  assert.equal(preferences.producer.push, true);
  assert.equal(preferences.account.email, true);
  assert.equal(preferences.chat.email, true);
  assert.equal(preferences.chat.push, true);
  assert.equal(preferences.admin.push, true);
});

test("notification preference merging preserves defaults for missing or invalid values", () => {
  const preferences = mergeNotificationPreferences({
    stream: {
      email: false
    },
    purchases: {
      push: false
    },
    producer: "invalid"
  });

  assert.equal(preferences.stream.email, false);
  assert.equal(preferences.stream.push, true);
  assert.equal(preferences.purchases.email, true);
  assert.equal(preferences.purchases.push, false);
  assert.equal(preferences.producer.email, true);
  assert.equal(preferences.producer.push, true);
  assert.equal(preferences.chat.email, true);
  assert.equal(preferences.chat.push, true);
});

test("notification types map to the correct preference categories", () => {
  assert.equal(notificationPreferenceCategoryForType("stream.live"), "stream");
  assert.equal(notificationPreferenceCategoryForType("shop.order.fulfilled"), "purchases");
  assert.equal(notificationPreferenceCategoryForType("music.purchase.paid"), "purchases");
  assert.equal(notificationPreferenceCategoryForType("stars.purchase.paid"), "purchases");
  assert.equal(notificationPreferenceCategoryForType("producer.sale.paid"), "producer");
  assert.equal(notificationPreferenceCategoryForType("chat.mention"), "chat");
  assert.equal(notificationPreferenceCategoryForType("notifications.admin_send"), "admin");
  assert.equal(notificationPreferenceCategoryForType("account.security.changed"), "account");
});

test("disabled notification preference blocks only the selected delivery channel", () => {
  const preferences = mergeNotificationPreferences({
    stream: {
      email: true,
      push: false
    }
  });

  assert.equal(notificationPreferenceEnabled(preferences, "stream.live", "email"), true);
  assert.equal(notificationPreferenceEnabled(preferences, "stream.live", "push"), false);
  assert.deepEqual(notificationDeliveryPreferences(preferences, "stream.live"), {
    category: "stream",
    email: true,
    push: false
  });
});
