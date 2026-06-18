import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const png1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfab4d0000000049454e44ae426082",
  "hex"
);
const png2x1 = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000002000000010806000000000000000000000049454e44ae426082",
  "hex"
);

function mp3Frame(bitrateIndex) {
  const frame = Buffer.alloc(128);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = (bitrateIndex << 4) | 0x00;
  frame[3] = 0x64;

  return frame;
}

async function importMediaServiceForTempCwd(tempDir) {
  const originalCwd = process.cwd();
  process.chdir(tempDir);

  const url = pathToFileURL(path.join(originalCwd, "src/lib/media/media-service.ts"));
  url.searchParams.set("test", `${Date.now()}-${Math.random()}`);
  const mediaService = await import(url.href);

  return {
    mediaService,
    restore: () => process.chdir(originalCwd)
  };
}

test("image uploads accept generic MIME when extension and content are valid", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const image = new File([png1x1], "product.png", {
      type: "application/octet-stream"
    });
    const uploadPath = await mediaService.saveOptionalImageUpload(image, "product-images");

    assert.match(uploadPath, /^\/uploads\/product-images\/.+\.png$/);
    assert.equal(existsSync(path.join(tempDir, "public", uploadPath)), true);
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});

test("preview MP3 uploads accept common browser MP3 MIME aliases", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const sample = new File([mp3Frame(9)], "sample.mp3", {
      type: "audio/x-mpeg"
    });
    const uploadPath = await mediaService.saveOptionalPreviewMp3(sample);

    assert.match(uploadPath, /^\/uploads\/music-previews\/.+\.mp3$/);
    assert.equal(existsSync(path.join(tempDir, "public", uploadPath)), true);
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});

test("track artwork uploads accept non-square images for object-cover display", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const image = new File([png2x1], "wide-cover.png", {
      type: "image/png"
    });
    const uploadPath = await mediaService.saveOptionalImageUpload(image, "track-artwork");

    assert.match(uploadPath, /^\/uploads\/track-artwork\/.+\.png$/);
    assert.equal(existsSync(path.join(tempDir, "public", uploadPath)), true);
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});

test("profile avatar uploads store PNG and JPEG files only", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const avatar = new File([png1x1], "profile.png", {
      type: "image/png"
    });
    const uploadPath = await mediaService.saveOptionalProfileAvatarUpload(avatar);

    assert.match(uploadPath, /^\/uploads\/profile-avatars\/.+\.png$/);
    assert.equal(existsSync(path.join(tempDir, "public", uploadPath)), true);
    await assert.rejects(
      () =>
        mediaService.saveOptionalProfileAvatarUpload(
          new File([png1x1], "profile.webp", {
            type: "image/webp"
          })
        ),
      /PNG, JPG, or JPEG/
    );
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});

test("profile avatar URLs allow uploaded avatar paths", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    assert.equal(
      mediaService.normalizeOptionalProfileAvatarUrl("/uploads/profile-avatars/avatar.jpg"),
      "/uploads/profile-avatars/avatar.jpg"
    );
    assert.throws(
      () => mediaService.normalizeOptionalProfileAvatarUrl("/uploads/profile-avatars/avatar.gif"),
      /PNG, JPG, or JPEG/
    );
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});

test("download MP3 uploads still require 320kbps frames", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const download = new File([mp3Frame(14)], "download.mp3", {
      type: "application/octet-stream"
    });
    const uploadPath = await mediaService.saveOptionalDownloadMp3(download);

    assert.match(uploadPath, /^\/uploads\/music-downloads\/.+\.mp3$/);
    assert.equal(existsSync(path.join(tempDir, "public", uploadPath)), true);
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});

test("upload limits match production asset requirements", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);
  const overLimitFile = (name, type, size) => ({
    arrayBuffer() {
      throw new Error("Oversized files should fail before reading file bytes.");
    },
    name,
    size,
    type
  });

  try {
    await assert.rejects(
      () => mediaService.saveOptionalImageUpload(overLimitFile("cover.png", "image/png", 101 * 1024 * 1024), "product-images"),
      /Maximum 100MB/
    );
    await assert.rejects(
      () => mediaService.saveOptionalChatAssetUpload(overLimitFile("sticker.gif", "image/gif", 151 * 1024 * 1024), "chat-stickers"),
      /Maximum 150MB/
    );
    await assert.rejects(
      () => mediaService.saveOptionalPreviewMp3(overLimitFile("sample.mp3", "audio/mpeg", 101 * 1024 * 1024)),
      /Maximum 100MB/
    );
    await assert.rejects(
      () => mediaService.saveOptionalDownloadMp3(overLimitFile("download.mp3", "audio/mpeg", 201 * 1024 * 1024)),
      /Maximum 200MB/
    );
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});
