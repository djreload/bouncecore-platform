import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { reconnectDelayMs } from "../src/lib/realtime/reconnect.ts";

test("site reconnect backoff grows safely and remains capped", () => {
  assert.equal(reconnectDelayMs(0), 1000);
  assert.equal(reconnectDelayMs(1), 2000);
  assert.equal(reconnectDelayMs(4), 15_000);
  assert.equal(reconnectDelayMs(20), 15_000);
  assert.equal(reconnectDelayMs(Number.NaN), 1000);
});

test("web chat submits through a deployment-stable API and reconnects realtime transport", () => {
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/chat/rooms/[roomId]/messages/route.ts"), "utf8");

  assert.match(panel, /fetch\(`\/api\/chat\/rooms\/\$\{encodeURIComponent\(roomId\)\}\/messages`/);
  assert.doesNotMatch(panel, /useActionState/);
  assert.match(panel, /scheduleReconnect/);
  assert.match(panel, /startPollingFallback/);
  assert.match(panel, /window\.addEventListener\("online", resumeRealtimeConnection\)/);
  assert.match(route, /export async function POST/);
  assert.match(route, /publicChatAction\(initialPublicChatActionState, formData\)/);
});

test("visible and persistent live players rebuild HLS after fatal connectivity errors", () => {
  for (const file of ["src/app/live/live-playback-player.tsx", "src/components/live/persistent-live-audio.tsx"]) {
    const player = readFileSync(join(process.cwd(), file), "utf8");

    assert.match(player, /requestFullReconnect/);
    assert.match(player, /reconnectDelayMs/);
    assert.match(player, /hls\.stopLoad\(\)/);
    assert.match(player, /window\.addEventListener\("online"/);
    assert.doesNotMatch(player, /[\n\r]\s*hls\.destroy\(\);\s*[\n\r]\s*}\);/, `${file} must not permanently destroy HLS inside its fatal error callback`);
  }
});

test("stale deployment failures recover once without clearing the account session", () => {
  const recovery = readFileSync(join(process.cwd(), "src/components/runtime/site-connection-recovery.tsx"), "utf8");
  const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

  assert.match(recovery, /failed to find server action/);
  assert.match(recovery, /older or newer deployment/);
  assert.match(recovery, /window\.location\.reload\(\)/);
  assert.match(recovery, /recoveryCooldownMs = 30_000/);
  assert.doesNotMatch(recovery, /logout|bouncecore_session/);
  assert.match(layout, /<SiteConnectionRecovery \/>/);
});
