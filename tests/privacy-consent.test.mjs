import assert from "node:assert/strict";
import { test } from "node:test";
import {
  consentAllowsCategory,
  createConsentRecord,
  defaultConsentPreferences,
  normalizeConsentPreferences,
  normalizeConsentRecord
} from "../src/lib/privacy/consent-core.ts";

test("consent defaults allow necessary storage only", () => {
  const preferences = defaultConsentPreferences();

  assert.equal(preferences.necessary, true);
  assert.equal(preferences.analytics, false);
  assert.equal(preferences.marketing, false);
  assert.equal(preferences.preferences, false);
});

test("consent normalization never disables necessary category", () => {
  const preferences = normalizeConsentPreferences({
    analytics: true,
    marketing: true,
    necessary: false,
    preferences: true
  });

  assert.deepEqual(preferences, {
    analytics: true,
    marketing: true,
    necessary: true,
    preferences: true
  });
});

test("consent record controls optional categories", () => {
  const record = createConsentRecord(
    {
      analytics: true,
      marketing: false,
      preferences: true
    },
    new Date("2026-06-21T10:00:00.000Z")
  );

  assert.equal(record.updatedAt, "2026-06-21T10:00:00.000Z");
  assert.equal(consentAllowsCategory(record, "necessary"), true);
  assert.equal(consentAllowsCategory(record, "analytics"), true);
  assert.equal(consentAllowsCategory(record, "marketing"), false);
  assert.equal(consentAllowsCategory(null, "marketing"), false);
});

test("saved consent records are normalized defensively", () => {
  const record = normalizeConsentRecord({
    preferences: {
      analytics: "yes",
      marketing: true,
      necessary: false
    },
    updatedAt: "2026-06-21T10:00:00.000Z",
    version: 999
  });

  assert.equal(record?.preferences.necessary, true);
  assert.equal(record?.preferences.analytics, false);
  assert.equal(record?.preferences.marketing, true);
  assert.equal(record?.version, 1);
});
