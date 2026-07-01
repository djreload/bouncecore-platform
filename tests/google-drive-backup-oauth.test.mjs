import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeGoogleDriveOAuthStateCookie,
  encodeGoogleDriveOAuthStateCookie,
  googleDriveAuthorizationUrl,
  googleDriveRcloneConfigContent,
  googleDriveTokenToRcloneToken
} from "../src/lib/admin/google-drive-backup-oauth.ts";

test("google drive oauth state cookie round-trips and expires", () => {
  const state = {
    actorId: "user_1",
    folder: "Bouncecore Backups",
    issuedAt: new Date().toISOString(),
    remoteName: "bouncecore-gdrive",
    state: "state-value"
  };

  assert.deepEqual(decodeGoogleDriveOAuthStateCookie(encodeGoogleDriveOAuthStateCookie(state)), state);

  const expired = {
    ...state,
    issuedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString()
  };

  assert.equal(decodeGoogleDriveOAuthStateCookie(encodeGoogleDriveOAuthStateCookie(expired)), null);
});

test("google drive token is converted to rclone token JSON", () => {
  const token = googleDriveTokenToRcloneToken(
    {
      access_token: "access-token",
      expires_in: 120,
      refresh_token: "refresh-token",
      token_type: "Bearer"
    },
    new Date("2026-07-01T12:00:00Z")
  );

  assert.deepEqual(JSON.parse(token), {
    access_token: "access-token",
    expiry: "2026-07-01T12:02:00.000Z",
    refresh_token: "refresh-token",
    token_type: "Bearer"
  });

  assert.throws(() => googleDriveTokenToRcloneToken({ access_token: "access-token" }), /refresh token/);
});

test("google drive rclone config content uses safe static fields", () => {
  const content = googleDriveRcloneConfigContent({
    clientId: "client-id",
    clientSecret: "client-secret",
    remoteName: "bouncecore-gdrive",
    token: '{"access_token":"access-token"}'
  });

  assert.match(content, /\[bouncecore-gdrive\]/);
  assert.match(content, /type = drive/);
  assert.match(content, /scope = drive\.file/);
  assert.match(content, /client_id = client-id/);
  assert.match(content, /client_secret = client-secret/);
  assert.match(content, /token = \{"access_token":"access-token"\}/);
});

test("google drive authorization url requests offline drive access", () => {
  const previousClientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
  const previousClientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;

  process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID = "client-id";
  process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = "client-secret";

  try {
    const url = googleDriveAuthorizationUrl(
      new Request("https://bouncecore.example.com/admin/storage/google-drive/connect"),
      {
        actorId: "user_1",
        folder: "Bouncecore Backups",
        issuedAt: new Date().toISOString(),
        remoteName: "bouncecore-gdrive",
        state: "state-value"
      }
    );

    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("client_id"), "client-id");
    assert.equal(url.searchParams.get("prompt"), "consent");
    assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/drive.file");
    assert.equal(url.searchParams.get("state"), "state-value");
    assert.equal(url.searchParams.get("redirect_uri"), "https://bouncecore.example.com/admin/storage/google-drive/callback");
  } finally {
    if (previousClientId === undefined) {
      delete process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
    } else {
      process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID = previousClientId;
    }

    if (previousClientSecret === undefined) {
      delete process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = previousClientSecret;
    }
  }
});
