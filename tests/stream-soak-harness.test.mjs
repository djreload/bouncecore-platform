import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("dual stream smoke harness can run a real continuity soak", () => {
  const harness = readFileSync(join(process.cwd(), "scripts/stream-dual-smoke-test.ps1"), "utf8");
  const wrapper = readFileSync(join(process.cwd(), "scripts/stream-dual-smoke-with-temp-keys.ps1"), "utf8");

  assert.match(harness, /\[int\]\$SoakSeconds = 0/);
  assert.match(harness, /Get-HlsMediaSequence/);
  assert.match(harness, /consecutiveFailures -ge 3/);
  assert.match(harness, /Invoke-DualIngestSoak/);
  assert.match(wrapper, /"-SoakSeconds", \$SoakSeconds/);
});
