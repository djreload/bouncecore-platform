import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("accepted registration invites are consumed inside the registration transaction", () => {
  const authService = readFileSync(join(process.cwd(), "src/lib/auth/auth-service.ts"), "utf8");

  assert.match(authService, /await tx\.userInvite\.delete\(\{/);
  assert.doesNotMatch(authService, /status: "accepted"/);
  assert.match(authService, /inviteId: invite\?\.id \?\? null/);
});

test("expired and legacy accepted invites are pruned automatically", () => {
  const inviteService = readFileSync(join(process.cwd(), "src/lib/auth/user-invite-service.ts"), "utf8");
  const worker = readFileSync(join(process.cwd(), "src/workers/main.ts"), "utf8");

  assert.match(inviteService, /export async function pruneInactiveUserInvites/);
  assert.match(inviteService, /status: "accepted"/);
  assert.match(inviteService, /expiresAt:[\s\S]*?lte: now/);
  assert.match(worker, /name: "user-invite-prune"/);
  assert.match(worker, /WORKER_USER_INVITE_PRUNE_INTERVAL_SECONDS/);
  assert.match(worker, /deletedInvites: await pruneInactiveUserInvites\(\)/);
});

test("the admin invite list contains only usable pending invitations", () => {
  const inviteService = readFileSync(join(process.cwd(), "src/lib/auth/user-invite-service.ts"), "utf8");
  const invitePanel = readFileSync(join(process.cwd(), "src/app/admin/users/invites-panel.tsx"), "utf8");

  assert.match(inviteService, /acceptedAt: null/);
  assert.match(inviteService, /revokedAt: null/);
  assert.match(inviteService, /expiresAt:[\s\S]*?gt: now/);
  assert.match(inviteService, /status: "pending"/);
  assert.match(invitePanel, /\{invites\.length\} pending/);
  assert.match(invitePanel, /No pending invites\./);
});
