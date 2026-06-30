import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStorageBytes,
  mediaStorageManifestFilename,
  summarizeMissingMediaReferences,
  summarizeMediaStorageCategories,
  uploadCategoryFromPath
} from "../src/lib/admin/media-storage-core.ts";

test("media storage byte formatter uses compact binary units", () => {
  assert.equal(formatStorageBytes(0), "0 B");
  assert.equal(formatStorageBytes(512), "512 B");
  assert.equal(formatStorageBytes(1536), "1.50 KB");
  assert.equal(formatStorageBytes(5 * 1024 * 1024), "5.00 MB");
});

test("media storage manifest filename uses a stable UTC timestamp", () => {
  assert.equal(
    mediaStorageManifestFilename(new Date("2026-06-30T22:30:45.123Z")),
    "bouncecore-upload-manifest-20260630T223045Z.json"
  );
});

test("media storage category parser uses first uploads folder segment", () => {
  assert.equal(uploadCategoryFromPath("/uploads/product-images/image.png"), "product-images");
  assert.equal(uploadCategoryFromPath("/uploads/file-at-root.png"), "root");
});

test("media storage summary groups referenced and orphan bytes by category", () => {
  const categories = summarizeMediaStorageCategories([
    {
      category: "track-artwork",
      modifiedAt: "2026-06-30T00:00:00.000Z",
      path: "/uploads/track-artwork/one.png",
      references: 1,
      sizeBytes: 100,
      status: "referenced"
    },
    {
      category: "track-artwork",
      modifiedAt: "2026-06-30T00:00:00.000Z",
      path: "/uploads/track-artwork/old.png",
      references: 0,
      sizeBytes: 50,
      status: "orphan"
    },
    {
      category: "product-images",
      modifiedAt: "2026-06-30T00:00:00.000Z",
      path: "/uploads/product-images/item.png",
      references: 1,
      sizeBytes: 300,
      status: "referenced"
    }
  ]);

  assert.deepEqual(categories, [
    {
      category: "product-images",
      fileCount: 1,
      orphanCount: 0,
      orphanSizeBytes: 0,
      referencedCount: 1,
      referencedSizeBytes: 300,
      sizeBytes: 300
    },
    {
      category: "track-artwork",
      fileCount: 2,
      orphanCount: 1,
      orphanSizeBytes: 50,
      referencedCount: 1,
      referencedSizeBytes: 100,
      sizeBytes: 150
    }
  ]);
});

test("media storage summary reports missing references with stable ordering", () => {
  const missing = summarizeMissingMediaReferences(
    [
      {
        field: "previewUrl",
        label: "Kisses",
        path: "/uploads/tracks/missing-preview.mp3",
        recordId: "track-1",
        source: "Track preview"
      },
      {
        field: "imageUrl",
        label: "Hoodie",
        path: "/uploads/products/hoodie.png",
        recordId: "product-1",
        source: "Product image"
      },
      {
        field: "artworkUrl",
        label: "Kisses",
        path: "/uploads/tracks/kisses.png",
        recordId: "track-1",
        source: "Track artwork"
      }
    ],
    ["/uploads/products/hoodie.png"]
  );

  assert.deepEqual(missing, [
    {
      field: "artworkUrl",
      label: "Kisses",
      path: "/uploads/tracks/kisses.png",
      recordId: "track-1",
      source: "Track artwork"
    },
    {
      field: "previewUrl",
      label: "Kisses",
      path: "/uploads/tracks/missing-preview.mp3",
      recordId: "track-1",
      source: "Track preview"
    }
  ]);
});
