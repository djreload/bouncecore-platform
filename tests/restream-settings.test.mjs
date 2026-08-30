import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildRestreamTargetUrl,
  defaultRestreamSettings,
  mergeRestreamSettingsInput,
  restreamTargetSlotValue,
  toAdminRestreamSettings
} from "../src/lib/stream/restream-settings.ts";

test("restream target slots accept only the two isolated outputs", () => {
  assert.equal(restreamTargetSlotValue("primary"), "primary");
  assert.equal(restreamTargetSlotValue("secondary"), "secondary");
  assert.throws(() => restreamTargetSlotValue("unexpected"), /Invalid restream destination/);
});

test("secondary restream storage and endpoint do not replace the legacy primary target", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/stream/restream-settings-service.ts"), "utf8");
  const primaryRoute = readFileSync(join(process.cwd(), "src/app/internal/stream/restream-target/route.ts"), "utf8");
  const secondaryRoute = readFileSync(
    join(process.cwd(), "src/app/internal/stream/restream-target-secondary/route.ts"),
    "utf8"
  );

  assert.match(service, /primary: "stream\.restream_settings"/);
  assert.match(service, /secondary: "stream\.restream_settings\.secondary"/);
  assert.match(primaryRoute, /getRestreamTargetUrl\(\)/);
  assert.match(secondaryRoute, /getRestreamTargetUrl\("secondary"\)/);
});

test("restream target appends stream keys to RTMPS server URLs", () => {
  assert.equal(
    buildRestreamTargetUrl({
      ...defaultRestreamSettings,
      enabled: true,
      serverUrl: "rtmps://a.rtmps.youtube.com/live2",
      streamKey: "abc-123"
    }),
    "rtmps://a.rtmps.youtube.com/live2/abc-123"
  );
});

test("restream target supports stream key placeholders", () => {
  assert.equal(
    buildRestreamTargetUrl({
      ...defaultRestreamSettings,
      enabled: true,
      serverUrl: "rtmps://live-api-s.facebook.com:443/rtmp/{streamKey}",
      streamKey: "fb key"
    }),
    "rtmps://live-api-s.facebook.com:443/rtmp/fb%20key"
  );
});

test("restream target rejects non streaming protocols and private hosts", () => {
  assert.throws(
    () =>
      buildRestreamTargetUrl({
        ...defaultRestreamSettings,
        enabled: true,
        serverUrl: "https://youtube.example/live",
        streamKey: "abc"
      }),
    /RTMP or RTMPS/
  );
  assert.throws(
    () =>
      buildRestreamTargetUrl({
        ...defaultRestreamSettings,
        enabled: true,
        serverUrl: "rtmp://127.0.0.1/live",
        streamKey: "abc"
      }),
    /public streaming host/
  );
});

test("restream settings preserve an existing saved key when the admin leaves the key field blank", () => {
  assert.equal(
    mergeRestreamSettingsInput(
      {
        enabled: true,
        label: "YouTube",
        provider: "youtube",
        serverUrl: "rtmps://a.rtmps.youtube.com/live2",
        streamKey: ""
      },
      {
        ...defaultRestreamSettings,
        streamKey: "existing-key"
      }
    ).streamKey,
    "existing-key"
  );
});

test("admin restream settings never expose the saved stream key", () => {
  assert.deepEqual(
    toAdminRestreamSettings({
      ...defaultRestreamSettings,
      enabled: true,
      provider: "facebook",
      serverUrl: "rtmps://live-api-s.facebook.com:443/rtmp/",
      streamKey: "hidden"
    }),
    {
      enabled: true,
      facebookPageId: "",
      label: "",
      provider: "facebook",
      serverUrl: "rtmps://live-api-s.facebook.com:443/rtmp/",
      streamKeyConfigured: true,
      targetHost: "live-api-s.facebook.com"
    }
  );
});
