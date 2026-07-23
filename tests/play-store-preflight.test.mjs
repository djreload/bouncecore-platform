import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("Play preflight verifies AAB package and version from the generated bundle manifest", () => {
  const source = readFileSync(join(process.cwd(), "scripts/play-store-preflight.ps1"), "utf8");

  assert.match(source, /bundle_manifest\\release\\processApplicationManifestReleaseForBundle/);
  assert.match(source, /Release bundle is older than its generated manifest/);
  assert.match(source, /artifactVersionCode -le \$PreviousVersionCode/);
});
