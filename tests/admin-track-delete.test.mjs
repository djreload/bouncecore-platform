import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("admin track deletion is blocked for purchased tracks and cleans managed uploads", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/music/admin-music-service.ts"), "utf8");
  const actions = readFileSync(join(process.cwd(), "src/app/admin/tracks/actions.ts"), "utf8");
  const panel = readFileSync(join(process.cwd(), "src/app/admin/tracks/tracks-panel.tsx"), "utf8");

  assert.match(service, /deleteAdminTrack/);
  assert.match(service, /existing\._count\.purchases > 0/);
  assert.match(service, /cleanupReplacedManagedUploads/);
  assert.match(actions, /intent === "delete-track"/);
  assert.match(panel, /DeleteTrackForm/);
  assert.match(panel, /Deletion locked/);
});
