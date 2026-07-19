import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  maxTemporaryChatAttachmentBytes,
  safeChatAttachmentName,
  validateTemporaryChatAttachment
} from "../src/lib/media/media-service.ts";

test("temporary chat attachments accept safe browser images and real ZIP signatures", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const bitmap = Buffer.from([0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

  assert.deepEqual(validateTemporaryChatAttachment({ name: "photo.png", type: "image/png" }, png), {
    contentType: "image/png",
    extension: ".png",
    kind: "image"
  });
  assert.deepEqual(validateTemporaryChatAttachment({ name: "photo.bmp", type: "image/bmp" }, bitmap), {
    contentType: "image/bmp",
    extension: ".bmp",
    kind: "image"
  });
  assert.deepEqual(validateTemporaryChatAttachment({ name: "bundle.zip", type: "application/zip" }, zip), {
    contentType: "application/zip",
    extension: ".zip",
    kind: "file"
  });
  assert.equal(maxTemporaryChatAttachmentBytes, 150 * 1024 * 1024);
});

test("temporary chat attachments reject disguised archives and active SVG content", () => {
  const fakeZip = Buffer.from("not a zip");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

  assert.throws(
    () => validateTemporaryChatAttachment({ name: "bundle.zip", type: "application/zip" }, fakeZip),
    /valid \.zip archive/
  );
  assert.throws(() => validateTemporaryChatAttachment({ name: "image.svg", type: "image/svg+xml" }, svg), /JPG, PNG, WebP, GIF, or AVIF/);
  assert.equal(safeChatAttachmentName("../../unsafe\u0000 name.zip", "attachment.zip"), "unsafe name.zip");
});

test("chat attachment API and composer are permission gated", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/chat/attachments/route.ts"), "utf8");
  const chat = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/chat/chat-service.ts"), "utf8");

  assert.match(route, /hasPermission\(user, "moderation\.use"\)/);
  assert.match(route, /status: 403/);
  assert.match(service, /Only moderators and admins can send chat attachments/);
  assert.match(chat, /currentUserCanModerate \? \(/);
  assert.match(chat, /<Paperclip/);
  assert.match(chat, /\/api\/chat\/attachments/);
  assert.match(chat, /\.jpg,\.jpeg,\.jfif,\.png,\.gif,\.webp,\.avif,\.bmp,\.zip/);
});

test("temporary attachment links are revoked and files are cleaned with chat lifecycle", () => {
  const uploads = readFileSync(join(process.cwd(), "src/app/uploads/[...path]/route.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/chat/chat-service.ts"), "utf8");
  const chat = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(uploads, /mediaSource: "temporary_chat_attachment"/);
  assert.match(uploads, /Chat attachment is no longer available/);
  assert.match(uploads, /"private, no-store, max-age=0"/);
  assert.match(uploads, /"Content-Disposition"/);
  assert.match(service, /chat\.attachment\.prune_cleanup_failed/);
  assert.match(service, /chat\.attachment\.moderate_cleanup_failed/);
  assert.match(service, /chat\.attachment\.clear_cleanup_failed/);
  assert.match(service, /mediaPreviewUrl: null,[\s\S]*mediaUrl: null/);
  assert.match(chat, /message\.kind === "attachment-image"/);
  assert.match(chat, /message\.kind === "attachment-file"/);
  assert.match(chat, /Available until this chat is cleared/);
});
