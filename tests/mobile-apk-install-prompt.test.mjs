import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("mobile APK install prompt is driven by public mobile config and hidden inside WebView", () => {
  const prompt = readFileSync(join(process.cwd(), "src/components/mobile/mobile-apk-install-prompt.tsx"), "utf8");
  const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
  const uploadClient = readFileSync(join(process.cwd(), "src/lib/media/admin-upload-client.ts"), "utf8");
  const uploadRoute = readFileSync(join(process.cwd(), "src/app/api/admin/uploads/route.ts"), "utf8");

  assert.match(prompt, /\/api\/mobile\/v1\/config/);
  assert.match(prompt, /version\?\.updateUrl/);
  assert.match(prompt, /localStorage/);
  assert.match(prompt, /BouncecoreAndroid/);
  assert.match(layout, /<MobileApkInstallPrompt \/>/);
  assert.match(uploadClient, /"mobile-apk"/);
  assert.match(uploadRoute, /"mobile-apk"/);
});
