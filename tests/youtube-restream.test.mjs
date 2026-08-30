import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  createYouTubeOAuthState,
  decodeYouTubeOAuthStateCookie,
  encodeYouTubeOAuthStateCookie
} from "../src/lib/stream/youtube-restream-oauth.ts";

function source(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("youtube oauth state is bound to the actor and restream slot and expires", () => {
  const state = createYouTubeOAuthState("owner_1", "secondary");

  assert.equal(state.actorId, "owner_1");
  assert.equal(state.slot, "secondary");
  assert.deepEqual(decodeYouTubeOAuthStateCookie(encodeYouTubeOAuthStateCookie(state)), state);

  const expired = {
    ...state,
    issuedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString()
  };

  assert.equal(decodeYouTubeOAuthStateCookie(encodeYouTubeOAuthStateCookie(expired)), null);
});

test("youtube restream automation creates a public auto-start broadcast and binds the saved stream", () => {
  const service = source("src/lib/stream/youtube-restream-service.ts");

  assert.match(service, /privacyStatus: "public"/);
  assert.match(service, /enableAutoStart: true/);
  assert.match(service, /enableAutoStop: true/);
  assert.match(service, /ingestionInfo\?\.streamName === streamKey/);
  assert.match(service, /\/liveBroadcasts\/bind/);
  assert.match(service, /\/liveBroadcasts\/transition/);
  assert.match(service, /Promise\.allSettled/);
  assert.match(service, /settings\.broadcastTitle/);
  assert.match(service, /settings\.broadcastDescription/);
});

test("youtube oauth routes require stream settings permission and use an http-only state cookie", () => {
  const connectRoute = source("src/app/admin/stream/youtube/connect/route.ts");
  const callbackRoute = source("src/app/admin/stream/youtube/callback/route.ts");

  assert.match(connectRoute, /getApiUserWithPermission\("stream\.settings\.manage"\)/);
  assert.match(callbackRoute, /getApiUserWithPermission\("stream\.settings\.manage"\)/);
  assert.match(connectRoute, /httpOnly: true/);
  assert.match(connectRoute, /sameSite: "lax"/);
  assert.match(callbackRoute, /state\.actorId !== actor\.id/);
  assert.doesNotMatch(connectRoute + callbackRoute, /refreshTokenCiphertext/);
});

test("active stream sessions invoke public youtube sync without exposing channel secrets", () => {
  const syncService = source("src/lib/stream/stream-session-sync-service.ts");
  const adminPanel = source("src/app/admin/stream/stream-control-panel.tsx");
  const oauthService = source("src/lib/stream/youtube-restream-oauth.ts");

  assert.match(syncService, /syncPublicYouTubeRestreams/);
  assert.match(adminPanel, /Connect YouTube/);
  assert.match(adminPanel, /Destination \{index \+ 1\}: \{target\.slot === "primary" \? "YouTube" : "Facebook"\}/);
  assert.doesNotMatch(adminPanel, /restreamProviders\.map/);
  assert.match(adminPanel, /type="password"/);
  assert.match(oauthService, /encryptSecret\(token\.refresh_token/);
  assert.doesNotMatch(adminPanel, /refreshToken|streamKey\}/);
});
