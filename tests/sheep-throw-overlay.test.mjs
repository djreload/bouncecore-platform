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
  assert.match(content, /const incomingVibrationPattern = \[80, 55, 120, 55, 170, 55, 230, 55, 300\]/);
  assert.match(content, /const impactVibrationPattern = \[180, 45, 120, 45, 90\]/);
  assert.match(content, /vibrateMobile\(incomingVibrationPattern, performancePreferencesRef\.current\.hapticsEnabled\)/);
  assert.match(content, /vibrateMobile\(impactVibrationPattern, performancePreferencesRef\.current\.hapticsEnabled\)/);
  assert.match(content, /if \(!mobileVibrationAvailable\(\)\)/);
});

test("sheep throw overlay waits for the canvas before starting animation", () => {
  const content = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");

  assert.match(content, /startAnimationWhenCanvasReady/);
  assert.match(content, /if \(!canvasRef\.current && attempt < 20\)/);
  assert.match(content, /window\.requestAnimationFrame\(\(\) => startAnimationWhenCanvasReady\(attempt \+ 1\)\)/);
  assert.match(content, /startTimeRef\.current = performance\.now\(\)/);
});

test("received throwables are queued on first load and remain visible in reduced motion", () => {
  const content = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");

  assert.match(content, /readSeenThrowIds\(\)\.forEach/);
  assert.match(content, /enqueueThrows\(payload\.recentThrows\)/);
  assert.doesNotMatch(content, /payload\.recentThrows\.forEach\(\(sheepThrow\) => seenIdsRef\.current\.add/);
  assert.match(content, /const drawStaticImpact = useCallback/);
  assert.match(content, /showStaticImpactWhenCanvasReady/);
  assert.match(content, /fallbackThrowableGlyph\(activeThrow\.sprite\.label\)/);
  assert.match(content, /const interval = window\.setInterval\(refresh, settings\.pollMs\)/);
});

test("interrupted throwable overlays can replay when the victim returns", () => {
  const content = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");

  assert.match(content, /const interruptedIds = \[activeThrowRef\.current\?\.id, \.\.\.queueRef\.current\.map/);
  assert.match(content, /interruptedIds\.forEach\(\(id\) => seenIdsRef\.current\.delete\(id\)\)/);
  assert.match(content, /persistSeenThrowIds\(seenIdsRef\.current\)/);
});

test("sheep throw impact wobble does not transform body or overlay", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const shell = readFileSync(join(process.cwd(), "src/components/layout/public-shell.tsx"), "utf8");

  assert.match(shell, /data-bc-public-shell/);
  assert.match(css, /html\.bc-sheep-impact-wobble \[data-bc-public-shell\] > :not\(\[data-sheep-throw-overlay\]\)/);
  assert.doesNotMatch(css, /html\.bc-sheep-impact-wobble body/);
});
