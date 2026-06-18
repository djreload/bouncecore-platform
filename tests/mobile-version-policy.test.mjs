import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultMobileVersionPolicy,
  isAndroidUpdateRequired,
  normalizeMobileVersionPolicyInput
} from "../src/lib/mobile/version-policy.ts";

test("default mobile version policy does not block the first Android build", () => {
  const policy = defaultMobileVersionPolicy();

  assert.equal(policy.minimumSupportedVersionCode, 1);
  assert.equal(policy.latestVersionCode, null);
  assert.equal(isAndroidUpdateRequired(1, policy), false);
});

test("mobile version policy blocks Android clients below the minimum build", () => {
  const policy = normalizeMobileVersionPolicyInput({
    androidLatestVersionCode: "4",
    androidLatestVersionName: "1.1.0",
    androidMinimumVersionCode: "3",
    androidUpdateUrl: "https://example.com/app.apk"
  });

  assert.equal(isAndroidUpdateRequired(2, policy), true);
  assert.equal(isAndroidUpdateRequired(3, policy), false);
  assert.equal(policy.latestVersionCode, 4);
  assert.equal(policy.latestVersionName, "1.1.0");
});

test("mobile version policy validates update version fields", () => {
  assert.throws(
    () =>
      normalizeMobileVersionPolicyInput({
        androidLatestVersionCode: "2",
        androidMinimumVersionCode: "3",
        androidUpdateUrl: "https://example.com/app.apk"
      }),
    /Latest Android version code/
  );
  assert.throws(
    () =>
      normalizeMobileVersionPolicyInput({
        androidMinimumVersionCode: "2"
      }),
    /update URL/
  );
  assert.throws(
    () =>
      normalizeMobileVersionPolicyInput({
        androidMinimumVersionCode: "2",
        androidUpdateUrl: "http://example.com/app.apk"
      }),
    /HTTPS/
  );
});
