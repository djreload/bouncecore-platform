import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { permissionDefinitions, rolePermissions } from "../src/lib/auth/rbac.ts";
import { visibleRoleBadges } from "../src/lib/auth/role-display.ts";

test("owner and admin both receive every defined permission", () => {
  const allPermissionKeys = permissionDefinitions.map((permission) => permission.key);

  assert.equal(allPermissionKeys.length, 21);
  assert.deepEqual(rolePermissions.owner, allPermissionKeys);
  assert.deepEqual(rolePermissions.admin, allPermissionKeys);
});

test("viewer remains an internal role but is hidden from role badge displays", () => {
  assert.deepEqual(visibleRoleBadges(["viewer"]), []);
  assert.deepEqual(visibleRoleBadges(["viewer", "admin", "supporter"]), ["admin", "supporter"]);
});

test("admin roles page exposes owner/admin permission parity", () => {
  const content = readFileSync(join(process.cwd(), "src/app/admin/roles/page.tsx"), "utf8");

  assert.match(content, /Owner\/Admin parity/);
  assert.match(content, /Owner \{ownerPermissionCount\}\/\{totalPermissions\}/);
  assert.match(content, /Admin \{adminPermissionCount\}\/\{totalPermissions\}/);
});

test("public chat and mobile payloads use shared visible role badge filtering", () => {
  const chatPanel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");
  const mobileApi = readFileSync(join(process.cwd(), "src/lib/mobile/public-api.ts"), "utf8");

  assert.doesNotMatch(chatPanel, /visibleBadgeRoles/);
  assert.match(chatPanel, /visibleRoleBadges\(message\.authorRoles\)/);
  assert.match(chatPanel, /visibleRoleBadges\(currentUser\.roles\)/);
  assert.match(mobileApi, /roles: visibleRoleBadges\(message\.authorRoles\)/);
  assert.match(mobileApi, /roles: visibleRoleBadges\(user\.roles\)/);
});
