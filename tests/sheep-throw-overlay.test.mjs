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

  assert.match(content, /playImpactSound\(sprite\.impactSoundUrl\)/);
  assert.match(content, /BouncecoreAndroid/);
  assert.match(content, /androidBridge\.vibrate/);
  assert.match(content, /navigator\.vibrate\(pattern\)/);
  assert.match(content, /const incomingVibrationPattern = \[80, 55, 120, 55, 170, 55, 230, 55, 300\]/);
  assert.match(content, /const impactVibrationPattern = \[180, 45, 120, 45, 90\]/);
  assert.match(content, /vibrateMobile\(incomingVibrationPattern\)/);
  assert.match(content, /vibrateMobile\(impactVibrationPattern\)/);
  assert.match(content, /if \(!mobileVibrationAvailable\(\)\)/);
});

test("targeted throwables bypass in-site performance settings", () => {
  const content = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  assert.doesNotMatch(content, /usePerformancePreferences|performancePreferencesRef/);
  assert.doesNotMatch(css, /data-bc-animations-enabled="false"\][^{]*bc-throwable-fallback/);
  assert.doesNotMatch(css, /data-bc-animations-enabled="false"\][^{]*bc-sheep-motion-blur/);
  assert.doesNotMatch(css, /data-bc-animations-enabled="false"\][^{]*bc-sheep-impact-wobble/);
  assert.match(content, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
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
  assert.match(content, /bc-throwable-fallback/);
  assert.match(content, /const interval = window\.setInterval\(refresh, settings\.pollMs\)/);
});

test("every accepted throwable becomes visible before its sprite asset finishes loading", () => {
  const content = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");
  const claimIndex = content.indexOf("activeThrowRef.current = nextThrow;");
  const loadIndex = content.indexOf("void loadImagesForSprite(nextThrow.sprite)");

  assert.ok(claimIndex > -1);
  assert.ok(loadIndex > claimIndex);
  assert.match(content, /setVisualFallback\(true\);/);
  assert.match(content, /canvasRegionHasVisiblePixels/);
  assert.match(content, /if \(canvasFrameConfirmedRef\.current\) \{[\s\S]*setVisualFallback\(false\)/);
  assert.match(content, /imageLoadTimeoutMs = 5000/);
});

test("interrupted throwable overlays can replay when the victim returns", () => {
  const content = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");

  assert.match(content, /const interruptedIds = new Set\([\s\S]*activeThrowRef\.current\?\.id,[\s\S]*loadingThrowRef\.current/);
  assert.match(content, /interruptedIds\.forEach\(\(id\) => seenIdsRef\.current\.delete\(id\)\)/);
  assert.match(content, /persistSeenThrowIds\(seenIdsRef\.current\)/);
  assert.match(content, /releaseInterruptedThrows\(\);[\s\S]*loadingThrowRef\.current = null/);
});

test("throw polling bypasses caches and keeps a burst-safe victim delivery window", () => {
  const overlay = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/chat/sheep-throws/route.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/chat/sheep-throw-service.ts"), "utf8");

  assert.match(overlay, /sheep-throws\?revision=\$\{Date\.now\(\)\}/);
  assert.match(overlay, /credentials: "same-origin"/);
  assert.match(route, /private, no-store, max-age=0, must-revalidate/);
  assert.match(service, /sheepThrowDeliveryMinimumEvents = 24/);
  assert.match(service, /take: deliveryEventLimit/);
});

test("sheep throw impact wobble does not transform body or overlay", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const shell = readFileSync(join(process.cwd(), "src/components/layout/public-shell.tsx"), "utf8");

  assert.match(shell, /data-bc-public-shell/);
  assert.match(css, /html\.bc-sheep-impact-wobble \[data-bc-public-shell\] > :not\(\[data-sheep-throw-overlay\]\)/);
  assert.doesNotMatch(css, /html\.bc-sheep-impact-wobble body/);
});
