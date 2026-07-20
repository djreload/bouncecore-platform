import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hasPermission, roleDefinitions } from "../src/lib/auth/rbac.ts";
import {
  raveWarStalledOperatorAlertContent,
  raveWarStalledOperatorAlertDedupeKey,
  raveWarStalledOperatorAlertType
} from "../src/lib/rave-wars/rave-war-operator-alert-core.ts";

test("stalled Rave War alerts link operators directly to match diagnostics", () => {
  const content = raveWarStalledOperatorAlertContent({
    participantNames: ["Reload", "Kevin"],
    roomName: "#live",
    warId: "war/id"
  });

  assert.equal(content.actionUrl, "/admin/rave-wars/war%2Fid");
  assert.equal(content.title, "Rave War stalled: Reload vs Kevin");
  assert.match(content.body, /#live has recorded no server activity for at least 150 seconds/);
  assert.equal(content.type, raveWarStalledOperatorAlertType);
});

test("stalled Rave War alerts deduplicate per match revision and operator", () => {
  assert.equal(
    raveWarStalledOperatorAlertDedupeKey({ revision: 14.8, userId: "user_1", warId: "war_1" }),
    `${raveWarStalledOperatorAlertType}:war_1:revision:14:user:user_1`
  );
});

test("stalled Rave War alerts target exactly active roles with settings management", () => {
  const operatorRoles = roleDefinitions
    .filter((role) => hasPermission({ roles: [role.key] }, "settings.manage"))
    .map((role) => role.key);

  assert.deepEqual(operatorRoles, ["owner", "admin"]);
});

test("the worker runs the permission-targeted stalled match monitor", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-operator-alert-service.ts"), "utf8");
  const worker = readFileSync(join(process.cwd(), "src/workers/main.ts"), "utf8");

  assert.match(service, /where:\s*\{\s*status: "active"/);
  assert.match(service, /raveWarMatchIsStalled/);
  assert.match(service, /hasPermission\(\{ roles: \[role\.key\] \}, "settings\.manage"\)/);
  assert.match(service, /notifyAccountUserOnce/);
  assert.match(worker, /name: "rave-war-stalled-alerts"/);
  assert.match(worker, /WORKER_RAVE_WAR_ALERTS_INTERVAL_SECONDS/);
  assert.match(worker, /run: monitorStalledRaveWars/);
});
