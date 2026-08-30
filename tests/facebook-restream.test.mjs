import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  createFacebookOAuthState,
  decodeFacebookOAuthStateCookie,
  encodeFacebookOAuthStateCookie
} from "../src/lib/stream/facebook-restream-oauth.ts";

function source(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("facebook oauth state is bound to the actor and restream slot and expires", () => {
  const state = createFacebookOAuthState("admin_1", "primary");

  assert.equal(state.actorId, "admin_1");
  assert.equal(state.slot, "primary");
  assert.deepEqual(decodeFacebookOAuthStateCookie(encodeFacebookOAuthStateCookie(state)), state);

  const expired = {
    ...state,
    issuedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString()
  };

  assert.equal(decodeFacebookOAuthStateCookie(encodeFacebookOAuthStateCookie(expired)), null);
});

test("facebook automation creates and ends Page live videos using generated secure RTMPS", () => {
  const service = source("src/lib/stream/facebook-restream-service.ts");

  assert.match(service, /\/live_videos/);
  assert.match(service, /status: "LIVE_NOW"/);
  assert.match(service, /secure_stream_url/);
  assert.match(service, /end_live_video: "true"/);
  assert.match(service, /Promise\.allSettled/);
  assert.match(service, /encryptSecret\(secureStreamUrl\)/);
  assert.match(service, /settings\.broadcastTitle/);
  assert.match(service, /settings\.broadcastDescription/);
});

test("facebook oauth routes enforce stream permission and protect state with an http-only cookie", () => {
  const connectRoute = source("src/app/admin/stream/facebook/connect/route.ts");
  const callbackRoute = source("src/app/admin/stream/facebook/callback/route.ts");

  assert.match(connectRoute, /getApiUserWithPermission\("stream\.settings\.manage"\)/);
  assert.match(callbackRoute, /getApiUserWithPermission\("stream\.settings\.manage"\)/);
  assert.match(connectRoute, /httpOnly: true/);
  assert.match(connectRoute, /sameSite: "lax"/);
  assert.match(callbackRoute, /state\.actorId !== actor\.id/);
  assert.doesNotMatch(connectRoute + callbackRoute, /pageAccessTokenCiphertext/);
});

test("facebook relay target is generated server-side and never exposed in admin", () => {
  const settingsService = source("src/lib/stream/restream-settings-service.ts");
  const syncService = source("src/lib/stream/stream-session-sync-service.ts");
  const adminPanel = source("src/app/admin/stream/stream-control-panel.tsx");

  assert.match(settingsService, /getActiveFacebookRestreamTargetUrl/);
  assert.match(settingsService, /connectedFacebookPage/);
  assert.match(syncService, /syncFacebookRestreams/);
  assert.match(syncService, /finishFacebookRestreams/);
  assert.match(adminPanel, /Connect Facebook Page/);
  assert.match(adminPanel, /How to obtain the Meta app credentials/);
  assert.match(adminPanel, /pages_manage_posts/);
  assert.match(adminPanel, /How to configure Destination 2/);
  assert.doesNotMatch(adminPanel, /secureStreamUrlCiphertext|pageAccessTokenCiphertext/);
});
