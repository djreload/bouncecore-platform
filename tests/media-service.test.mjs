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
const ico1x1 = Buffer.from("00000100010001010000010020006800000016000000", "hex");
const wavTiny = Buffer.from("524946462400000057415645666d74201000000001000100401f0000803e0000020010006461746100000000", "hex");

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

test("branding image uploads use the branding upload root", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const image = new File([png1x1], "logo.png", {
      type: "image/png"
    });
    const uploadPath = await mediaService.saveOptionalBrandingImageUpload(image);

    assert.match(uploadPath, /^\/uploads\/branding-images\/.+\.png$/);
    assert.equal(existsSync(path.join(tempDir, "public", uploadPath)), true);
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});

test("favicon uploads accept ico files in the branding upload root", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const icon = new File([ico1x1], "favicon.ico", {
      type: "image/x-icon"
    });
    const uploadPath = await mediaService.saveOptionalFaviconUpload(icon);

    assert.match(uploadPath, /^\/uploads\/branding-images\/.+\.ico$/);
    assert.equal(existsSync(path.join(tempDir, "public", uploadPath)), true);
    assert.equal(mediaService.normalizeOptionalFaviconUrl(uploadPath), uploadPath);
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});

test("stream offline image uploads use the stream offline upload root", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const image = new File([png1x1], "offline.png", {
      type: "image/png"
    });
    const uploadPath = await mediaService.saveOptionalStreamOfflineImageUpload(image);

    assert.match(uploadPath, /^\/uploads\/stream-offline-images\/.+\.png$/);
    assert.equal(existsSync(path.join(tempDir, "public", uploadPath)), true);
    assert.equal(mediaService.normalizeOptionalStreamOfflineImageUrl(uploadPath), uploadPath);
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});

test("chat sticker and emoji uploads use separate chat asset roots", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const sticker = new File([png1x1], "sticker.png", {
      type: "image/png"
    });
    const emoji = new File([png1x1], "emoji.png", {
      type: "image/png"
    });
    const stickerPath = await mediaService.saveOptionalChatAssetUpload(sticker, "chat-stickers");
    const emojiPath = await mediaService.saveOptionalChatAssetUpload(emoji, "chat-emojis");

    assert.match(stickerPath, /^\/uploads\/chat-stickers\/.+\.png$/);
    assert.match(emojiPath, /^\/uploads\/chat-emojis\/.+\.png$/);
    assert.equal(existsSync(path.join(tempDir, "public", stickerPath)), true);
    assert.equal(existsSync(path.join(tempDir, "public", emojiPath)), true);
    assert.equal(mediaService.normalizeOptionalChatAssetUrl(stickerPath, "chat-stickers"), stickerPath);
    assert.equal(mediaService.normalizeOptionalChatAssetUrl(emojiPath, "chat-emojis"), emojiPath);
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});

test("throw impact sound uploads use the throw sound root", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const sound = new File([wavTiny], "splat.wav", {
      type: "audio/wav"
    });
    const uploadPath = await mediaService.saveOptionalThrowSoundUpload(sound);

    assert.match(uploadPath, /^\/uploads\/throw-sounds\/.+\.wav$/);
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

test("branding image URLs only allow branding upload paths", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    assert.equal(
      mediaService.normalizeOptionalBrandingImageUrl("/uploads/branding-images/logo.webp", "Logo URL"),
      "/uploads/branding-images/logo.webp"
    );
    assert.throws(
      () => mediaService.normalizeOptionalBrandingImageUrl("/uploads/product-images/logo.webp", "Logo URL"),
      /branding image file/
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

test("Android APK uploads use the mobile APK upload root", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bouncecore-media-"));
  const { mediaService, restore } = await importMediaServiceForTempCwd(tempDir);

  try {
    const apk = new File([Buffer.from("apk")], "bouncecore.apk", {
      type: "application/vnd.android.package-archive"
    });
    const uploadPath = await mediaService.saveOptionalAndroidApkUpload(apk);

    assert.match(uploadPath, /^\/uploads\/mobile-apks\/.+\.apk$/);
    assert.equal(existsSync(path.join(tempDir, "public", uploadPath)), true);
    await assert.rejects(
      () =>
        mediaService.saveOptionalAndroidApkUpload(
          new File([Buffer.from("zip")], "bouncecore.zip", {
            type: "application/zip"
          })
        ),
      /\.apk file extension/
    );
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
    await assert.rejects(
      () => mediaService.saveOptionalAndroidApkUpload(overLimitFile("bouncecore.apk", "application/vnd.android.package-archive", 251 * 1024 * 1024)),
      /Maximum 250MB/
    );
    await assert.rejects(
      () => mediaService.saveOptionalThrowSoundUpload(overLimitFile("splat.wav", "audio/wav", 26 * 1024 * 1024)),
      /Maximum 25MB/
    );
  } finally {
    restore();
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
});
