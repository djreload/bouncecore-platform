import assert from "node:assert/strict";
import test from "node:test";
import { chatPresenceStatus, isChatPresenceOnline } from "../src/lib/chat/chat-presence-core.ts";

test("chat presence treats activity inside five minutes as online", () => {
  const now = new Date("2026-07-03T12:00:00.000Z");

  assert.equal(chatPresenceStatus(new Date("2026-07-03T11:55:01.000Z"), now), "online");
  assert.equal(isChatPresenceOnline(new Date("2026-07-03T11:55:01.000Z"), now), true);
});

test("chat presence treats activity older than five minutes as away", () => {
  const now = new Date("2026-07-03T12:00:00.000Z");

  assert.equal(chatPresenceStatus(new Date("2026-07-03T11:54:59.000Z"), now), "away");
  assert.equal(isChatPresenceOnline(new Date("2026-07-03T11:54:59.000Z"), now), false);
});
