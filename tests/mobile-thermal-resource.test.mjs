import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("Android WebView keeps live audio alive only while persistent playback is active", () => {
  const activity = readFileSync(
    join(process.cwd(), "android-webview/app/src/main/java/uk/co/bouncecore/app/MainActivity.java"),
    "utf8"
  );

  assert.match(activity, /BouncecoreAndroid\//);
  assert.match(activity, /settings\.setUserAgentString/);
  assert.match(activity, /persistentAudioActive/);
  assert.match(activity, /setPersistentAudioActive\(boolean active\)/);
  assert.match(activity, /webView != null && !persistentAudioActive/);
  assert.match(activity, /webView\.onPause\(\)/);
  assert.match(activity, /webView\.pauseTimers\(\)/);
  assert.match(activity, /webView\.onResume\(\)/);
  assert.match(activity, /webView\.resumeTimers\(\)/);
  assert.doesNotMatch(activity, /FLAG_KEEP_SCREEN_ON/);
});

test("persistent livestream playback stays alive after user-enabled background audio", () => {
  const player = readFileSync(join(process.cwd(), "src/components/live/persistent-live-audio.tsx"), "utf8");
  const runtime = readFileSync(join(process.cwd(), "src/lib/runtime/mobile-app-runtime.ts"), "utf8");

  assert.match(runtime, /bouncecoreAndroidUserAgentToken/);
  assert.match(player, /shouldSuspendPersistentPlayback/);
  assert.match(player, /if \(userEnabled\)/);
  assert.match(player, /setAndroidPersistentAudioActive/);
  assert.match(player, /persistentAudioActive = userEnabled && canPlay/);
  assert.match(player, /isBouncecoreAndroidRuntime\(\) && !isLivePath\(pathname\)/);
  assert.match(player, /document\.visibilityState === "hidden"/);
  assert.match(player, /suspendPlayback/);
  assert.match(player, /activeVideo\.preload = "metadata"/);
  assert.doesNotMatch(player, /activeVideo\.preload = "auto"/);
});

test("live status and overlays sleep when the page is hidden", () => {
  const liveStatus = readFileSync(join(process.cwd(), "src/components/live/live-status-client.ts"), "utf8");
  const sheepOverlay = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");
  const starOverlay = readFileSync(join(process.cwd(), "src/app/live/star-support-panel.tsx"), "utf8");

  assert.match(liveStatus, /pageIsHidden/);
  assert.match(liveStatus, /closeStatusTransport/);
  assert.match(liveStatus, /document\.addEventListener\("visibilitychange", handleFeedVisibilityChange\)/);
  assert.match(sheepOverlay, /maxOverlayDevicePixelRatio = 1\.5/);
  assert.match(sheepOverlay, /document\.visibilityState === "hidden"/);
  assert.match(starOverlay, /document\.visibilityState === "hidden"/);
});

test("resource saver marks runtime state and disables constant Android background drift", () => {
  const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
  const saver = readFileSync(join(process.cwd(), "src/components/performance/browser-resource-saver.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  assert.match(layout, /<BrowserResourceSaver \/>/);
  assert.match(saver, /dataset\.bcAndroidWebview/);
  assert.match(saver, /dataset\.bcPageVisibility/);
  assert.match(css, /html\[data-bc-android-webview="true"\] body::before/);
  assert.match(css, /content-visibility: auto/);
});
