import assert from "node:assert/strict";
import { test } from "node:test";
import {
  googleDriveDefaultFolder,
  googleDriveDefaultRemoteName,
  googleDriveRcloneDestination
} from "../src/lib/admin/offsite-backup-targets.ts";
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
    destinationType: "google-drive",
    enabled: false,
    googleDriveFolder: googleDriveDefaultFolder,
    googleDriveRemoteName: googleDriveDefaultRemoteName,
    outputDir: null,
    rcloneRemote: `${googleDriveDefaultRemoteName}:${googleDriveDefaultFolder}`,
    removeLocalAfterUpload: false
  });
});

test("offsite backup settings require destination and age recipient when enabled", () => {
  assert.throws(
    () =>
      normalizeOffsiteBackupSettingsInput({
        ageRecipient: ageRecipient,
        destinationType: "rclone",
        enabled: true,
        googleDriveFolder: "",
        googleDriveRemoteName: "",
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
        destinationType: "google-drive",
        enabled: true,
        googleDriveFolder: "",
        googleDriveRemoteName: "",
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
        destinationType: "rclone",
        enabled: true,
        googleDriveFolder: "",
        googleDriveRemoteName: "",
        outputDir: "",
        rcloneRemote: "r2:bouncecore;rm -rf /",
        removeLocalAfterUpload: false
      }),
    /shell control/
  );
});

test("google drive destination builds a safe rclone path", () => {
  assert.equal(googleDriveRcloneDestination("bouncecore-gdrive", "/Bouncecore Backups/prod/"), "bouncecore-gdrive:Bouncecore Backups/prod");
  assert.throws(() => googleDriveRcloneDestination("bad remote", "Bouncecore Backups"), /remote name/);
  assert.throws(() => googleDriveRcloneDestination("bouncecore-gdrive", "../secrets"), /Google Drive folder/);
});

test("google drive mode generates the rclone remote from remote name and folder", () => {
  const settings = normalizeOffsiteBackupSettingsInput({
    ageRecipient,
    destinationType: "google-drive",
    enabled: true,
    googleDriveFolder: "Bouncecore Backups/staging",
    googleDriveRemoteName: "bouncecore-gdrive",
    outputDir: "",
    rcloneRemote: "ignored:custom/path",
    removeLocalAfterUpload: false
  });

  assert.equal(settings.destinationType, "google-drive");
  assert.equal(settings.googleDriveRemoteName, "bouncecore-gdrive");
  assert.equal(settings.googleDriveFolder, "Bouncecore Backups/staging");
  assert.equal(settings.rcloneRemote, "bouncecore-gdrive:Bouncecore Backups/staging");
});

test("custom rclone mode preserves the explicit destination", () => {
  const settings = normalizeOffsiteBackupSettingsInput({
    ageRecipient,
    destinationType: "rclone",
    enabled: true,
    googleDriveFolder: "Bouncecore Backups",
    googleDriveRemoteName: "bouncecore-gdrive",
    outputDir: "",
    rcloneRemote: "r2:bouncecore/prod",
    removeLocalAfterUpload: false
  });

  assert.equal(settings.destinationType, "rclone");
  assert.equal(settings.rcloneRemote, "r2:bouncecore/prod");
});

test("offsite backup settings serialize the admin-managed env file", () => {
  const settings = normalizeOffsiteBackupSettingsInput({
    ageRecipient,
    destinationType: "rclone",
    enabled: true,
    googleDriveFolder: "",
    googleDriveRemoteName: "",
    outputDir: "/srv/bouncecore-backups/offsite",
    rcloneRemote: "r2:bouncecore/prod",
    removeLocalAfterUpload: true
  });

  const output = offsiteBackupSettingsToEnv(settings, new Date("2026-07-01T12:00:00Z"));

  assert.match(output, /OFFSITE_ENABLED=true/);
  assert.match(output, /OFFSITE_DESTINATION_TYPE=rclone/);
  assert.match(output, /OFFSITE_GOOGLE_DRIVE_REMOTE_NAME=bouncecore-gdrive/);
  assert.match(output, /OFFSITE_GOOGLE_DRIVE_FOLDER=Bouncecore Backups/);
  assert.match(output, /OFFSITE_AGE_RECIPIENT=age1/);
  assert.match(output, /OFFSITE_RCLONE_REMOTE=r2:bouncecore\/prod/);
  assert.match(output, /OFFSITE_OUTPUT_DIR=\/srv\/bouncecore-backups\/offsite/);
  assert.match(output, /OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD=true/);
  assert.match(output, /UPDATED_AT=2026-07-01T12:00:00.000Z/);
});
