import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  collectManagedUploadPathsFromJson,
  jsonValueReferencesUpload,
  managedUploadDiskPath,
  normalizeManagedUploadPath,
  uniqueManagedUploadPaths
} from "../src/lib/media/upload-cleanup-core.ts";

test("managed upload cleanup accepts only safe local upload paths", () => {
  assert.equal(normalizeManagedUploadPath("/uploads/product-images/example.png"), "/uploads/product-images/example.png");
  assert.equal(normalizeManagedUploadPath("https://example.com/uploads/product-images/example.png"), null);
  assert.equal(normalizeManagedUploadPath("/uploads/product-images/../secret.png"), null);
  assert.equal(normalizeManagedUploadPath("/images/example.png"), null);
  assert.equal(normalizeManagedUploadPath("/uploads\\product-images\\example.png"), null);
});

test("managed upload cleanup resolves disk paths inside public uploads only", () => {
  const cwd = path.resolve("/srv/bouncecore");

  assert.equal(
    managedUploadDiskPath("/uploads/product-images/example.png", cwd),
    path.resolve(cwd, "public", "uploads", "product-images", "example.png")
  );
  assert.equal(managedUploadDiskPath("/uploads/product-images/../example.png", cwd), null);
});

test("managed upload cleanup detects exact JSON setting references", () => {
  const value = {
    branding: {
      faviconUrl: "/uploads/branding-images/favicon.ico",
      logoUrl: "/uploads/branding-images/logo.png"
    }
  };

  assert.equal(jsonValueReferencesUpload(value, "/uploads/branding-images/logo.png"), true);
  assert.equal(jsonValueReferencesUpload(value, "/uploads/branding-images/log.png"), false);
  assert.equal(jsonValueReferencesUpload(undefined, "/uploads/branding-images/logo.png"), false);
});

test("managed upload cleanup deduplicates only safe local upload paths", () => {
  assert.deepEqual(uniqueManagedUploadPaths([
    "/uploads/avatars/reload.png",
    " /uploads/avatars/reload.png ",
    "https://example.com/uploads/avatars/reload.png",
    "/uploads/avatars/../secret.png",
    "/uploads/chat-assets/sheep.png"
  ]), ["/uploads/avatars/reload.png", "/uploads/chat-assets/sheep.png"]);
});

test("managed upload cleanup collects upload paths from nested JSON values", () => {
  assert.deepEqual(
    collectManagedUploadPathsFromJson({
      branding: {
        logoUrl: "/uploads/branding/logo.png",
        unsafe: "/uploads/branding/../secret.png"
      },
      socialLinks: [
        {
          iconUrl: "/uploads/social/facebook.png"
        },
        "https://example.com/uploads/social/external.png"
      ]
    }),
    ["/uploads/branding/logo.png", "/uploads/social/facebook.png"]
  );
});
