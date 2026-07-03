import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("mobile app download page uses backend mobile config and footer navigation links to it", () => {
  const page = readFileSync(join(process.cwd(), "src/app/mobile/page.tsx"), "utf8");
  const shell = readFileSync(join(process.cwd(), "src/components/layout/public-shell.tsx"), "utf8");
  const smoke = readFileSync(join(process.cwd(), "scripts/public-smoke-check.mjs"), "utf8");

  assert.match(page, /getPublicMobileConfig/);
  assert.match(page, /config\.version\.updateUrl/);
  assert.match(page, /Download APK/);
  assert.match(shell, /href="\/mobile"/);
  assert.match(smoke, /path: "\/mobile"/);
});
