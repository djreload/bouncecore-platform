import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("sheep throw impact targets exact viewport center", () => {
  const content = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");

  assert.match(content, /const targetX = width \* 0\.5;/);
  assert.match(content, /const targetY = height \* 0\.5;/);
  assert.match(content, /data-sheep-throw-overlay/);
  assert.doesNotMatch(content, /const targetX = width \* \(0\./);
  assert.doesNotMatch(content, /const targetY = height \* \(0\./);
});

test("sheep throw overlay can play impact sounds and mobile haptics", () => {
  const content = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");

  assert.match(content, /playImpactSound\(images\.sprite\.impactSoundUrl\)/);
  assert.match(content, /BouncecoreAndroid/);
  assert.match(content, /androidBridge\.vibrate/);
  assert.match(content, /navigator\.vibrate\(pattern\)/);
  assert.match(content, /vibrateMobile\(\[45, 40, 45\]\)/);
  assert.match(content, /vibrateMobile\(\[120, 45, 80\]\)/);
  assert.match(content, /if \(!mobileVibrationAvailable\(\)\)/);
});

test("sheep throw impact wobble does not transform body or overlay", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const shell = readFileSync(join(process.cwd(), "src/components/layout/public-shell.tsx"), "utf8");

  assert.match(shell, /data-bc-public-shell/);
  assert.match(css, /html\.bc-sheep-impact-wobble \[data-bc-public-shell\] > :not\(\[data-sheep-throw-overlay\]\)/);
  assert.doesNotMatch(css, /html\.bc-sheep-impact-wobble body/);
});
