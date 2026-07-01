import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeOffsiteBackupSettingsInput,
  offsiteBackupSettingsToEnv
} from "../src/lib/admin/offsite-backup-settings.ts";

const ageRecipient = "age1ql3z7hjy54pw4klmpmdxcw4tw4fpdeuxmky0drg3m8xw3xt8pfnq4k0c0s";

test("offsite backup settings allow disabled empty config", () => {
  const settings = normalizeOffsiteBackupSettingsInput({
    ageRecipient: "",
    enabled: false,
    outputDir: "",
    rcloneRemote: "",
    removeLocalAfterUpload: false
  });

  assert.deepEqual(settings, {
    ageRecipient: null,
    enabled: false,
    outputDir: null,
    rcloneRemote: null,
    removeLocalAfterUpload: false
  });
});

test("offsite backup settings require destination and age recipient when enabled", () => {
  assert.throws(
    () =>
      normalizeOffsiteBackupSettingsInput({
        ageRecipient: ageRecipient,
        enabled: true,
        outputDir: "",
        rcloneRemote: "",
        removeLocalAfterUpload: false
      }),
    /rclone destination/
  );

  assert.throws(
    () =>
      normalizeOffsiteBackupSettingsInput({
        ageRecipient: "",
        enabled: true,
        outputDir: "",
        rcloneRemote: "r2:bouncecore/prod",
        removeLocalAfterUpload: false
      }),
    /age public recipient/
  );
});

test("offsite backup settings reject unsafe destination input", () => {
  assert.throws(
    () =>
      normalizeOffsiteBackupSettingsInput({
        ageRecipient: ageRecipient,
        enabled: true,
        outputDir: "",
        rcloneRemote: "r2:bouncecore;rm -rf /",
        removeLocalAfterUpload: false
      }),
    /shell control/
  );
});

test("offsite backup settings serialize the admin-managed env file", () => {
  const settings = normalizeOffsiteBackupSettingsInput({
    ageRecipient,
    enabled: true,
    outputDir: "/srv/bouncecore-backups/offsite",
    rcloneRemote: "r2:bouncecore/prod",
    removeLocalAfterUpload: true
  });

  const output = offsiteBackupSettingsToEnv(settings, new Date("2026-07-01T12:00:00Z"));

  assert.match(output, /OFFSITE_ENABLED=true/);
  assert.match(output, /OFFSITE_AGE_RECIPIENT=age1/);
  assert.match(output, /OFFSITE_RCLONE_REMOTE=r2:bouncecore\/prod/);
  assert.match(output, /OFFSITE_OUTPUT_DIR=\/srv\/bouncecore-backups\/offsite/);
  assert.match(output, /OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD=true/);
  assert.match(output, /UPDATED_AT=2026-07-01T12:00:00.000Z/);
});
