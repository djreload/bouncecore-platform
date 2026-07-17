import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  defaultPerformancePreferences,
  effectivePerformancePreferences,
  mergePerformancePreferences,
  recommendedMobileProtectionPreferences
} from "../src/lib/account/performance-preferences-core.ts";
import { applyLiveQualityCap } from "../src/components/live/live-playback-buffer.ts";

test("performance preferences merge untrusted values onto stable defaults", () => {
  assert.deepEqual(mergePerformancePreferences(null), defaultPerformancePreferences);
  assert.deepEqual(
    mergePerformancePreferences({
      animatedMediaEnabled: false,
      maxLiveQuality: "not-a-quality",
      particlesEnabled: "no"
    }),
    {
      ...defaultPerformancePreferences,
      animatedMediaEnabled: false
    }
  );
});

test("maximum performance is the default until a user enables a reduction", () => {
  const effective = effectivePerformancePreferences(defaultPerformancePreferences, { constrainedDevice: true });

  assert.equal(effective.automaticSaverActive, false);
  assert.equal(effective.batterySaverActive, false);
  assert.equal(effective.animationsEnabled, true);
  assert.equal(effective.animatedMediaEnabled, true);
  assert.equal(effective.maxLiveHeight, null);
  assert.equal(effective.particlesEnabled, true);
  assert.equal(effective.realtimeUpdatesEnabled, true);
  assert.equal(effective.secondaryVideoEnabled, true);
});

test("optional automatic mobile protection reduces expensive work but preserves chosen background audio", () => {
  const effective = effectivePerformancePreferences(recommendedMobileProtectionPreferences, { constrainedDevice: true });

  assert.equal(effective.automaticSaverActive, true);
  assert.equal(effective.batterySaverActive, true);
  assert.equal(effective.animationsEnabled, false);
  assert.equal(effective.animatedMediaEnabled, false);
  assert.equal(effective.backgroundPlaybackEnabled, true);
  assert.equal(effective.hapticsEnabled, false);
  assert.equal(effective.maxLiveHeight, 480);
  assert.equal(effective.nativeAdsEnabled, false);
  assert.equal(effective.particlesEnabled, false);
  assert.equal(effective.realtimeUpdatesEnabled, false);
  assert.equal(effective.secondaryVideoEnabled, false);
});

test("forced Battery Saver also stops background livestream playback", () => {
  const effective = effectivePerformancePreferences({
    ...defaultPerformancePreferences,
    batterySaverEnabled: true,
    maxLiveQuality: "720p"
  });

  assert.equal(effective.backgroundPlaybackEnabled, false);
  assert.equal(effective.maxLiveHeight, 480);
});

test("livestream quality cap chooses the highest eligible HLS level", () => {
  const hls = {
    autoLevelCapping: -1,
    levels: [{ height: 240 }, { height: 480 }, { height: 720 }, { height: 1080 }]
  };

  assert.equal(applyLiveQualityCap(hls, 480), 1);
  assert.equal(hls.autoLevelCapping, 1);
  assert.equal(applyLiveQualityCap(hls, 720), 2);
  assert.equal(applyLiveQualityCap(hls, null), -1);
});

test("resource monitor is account-accessible and preferences persist per user", () => {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/account/performance/route.ts"), "utf8");
  const monitor = readFileSync(
    join(process.cwd(), "src/app/account/performance/performance-resource-monitor.tsx"),
    "utf8"
  );
  const navigation = readFileSync(join(process.cwd(), "src/config/navigation.ts"), "utf8");

  assert.match(schema, /model UserPerformancePreference/);
  assert.match(schema, /userId\s+String\s+@unique/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(monitor, /Current resource load/);
  assert.match(monitor, /Battery and heat controls/);
  assert.match(monitor, /Battery Saver/);
  assert.match(monitor, /Quick protection/);
  assert.match(monitor, /Visuals and chat media/);
  assert.match(monitor, /Livestream playback/);
  assert.match(monitor, /Network and Android app/);
  assert.match(monitor, /Off means the feature remains available/);
  assert.match(monitor, /Turn off all reductions/);
  assert.match(monitor, /New accounts start at maximum performance/);
  assert.match(monitor, /recommendedMobileProtectionPreferences/);
  assert.match(navigation, /href: "\/account\/performance"/);
});

test("expensive browser and Android features obey effective performance settings", () => {
  const client = readFileSync(
    join(process.cwd(), "src/lib/performance/performance-preferences-client.ts"),
    "utf8"
  );
  const player = readFileSync(join(process.cwd(), "src/app/live/live-playback-player.tsx"), "utf8");
  const persistentAudio = readFileSync(
    join(process.cwd(), "src/components/live/persistent-live-audio.tsx"),
    "utf8"
  );
  const chat = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");
  const chatEffect = readFileSync(join(process.cwd(), "src/app/chat/chat-effect-text.tsx"), "utf8");
  const activity = readFileSync(
    join(process.cwd(), "android-webview/app/src/main/java/uk/co/bouncecore/app/MainActivity.java"),
    "utf8"
  );

  assert.match(client, /setPerformancePreferences/);
  assert.match(client, /bcAnimationsEnabled/);
  assert.match(player, /secondaryVideoEnabled/);
  assert.match(player, /applyLiveQualityCap/);
  assert.match(persistentAudio, /backgroundPlaybackEnabled/);
  assert.match(chat, /animatedMediaEnabled/);
  assert.match(chatEffect, /animationsEnabled \? getChatEffectById/);
  assert.match(chatEffect, /particlesEnabled && effect\?\.particlePreset/);
  assert.match(activity, /setOffscreenPreRaster\(false\)/);
  assert.match(activity, /setPerformancePreferences\(String preferencesJson\)/);
  assert.match(activity, /if \(!nativeAdsEnabled\)/);
  assert.match(activity, /if \(!hapticsEnabled \|\| TextUtils\.isEmpty\(patternCsv\)\)/);
});
