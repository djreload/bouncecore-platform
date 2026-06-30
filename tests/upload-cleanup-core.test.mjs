import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  jsonValueReferencesUpload,
  managedUploadDiskPath,
  normalizeManagedUploadPath
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
