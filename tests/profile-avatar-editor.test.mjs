import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("profile pictures upload through a dedicated authenticated endpoint", () => {
  const endpoint = readFileSync(join(process.cwd(), "src/app/api/account/profile/avatar/route.ts"), "utf8");

  assert.match(endpoint, /const user = await getCurrentUser\(\)/);
  assert.match(endpoint, /saveOptionalProfileAvatarUpload\(file\)/);
  assert.match(endpoint, /Sign in to upload a profile picture/);
  assert.match(endpoint, /maxCroppedAvatarRequestBytes/);
  assert.match(endpoint, /status: 413/);
  assert.match(endpoint, /"Cache-Control": "no-store"/);
});

test("profile forms no longer send full image files through Server Actions", () => {
  const accountAction = readFileSync(join(process.cwd(), "src/app/account/profile/actions.ts"), "utf8");
  const streamerAction = readFileSync(join(process.cwd(), "src/app/streamer/profile/actions.ts"), "utf8");
  const accountForm = readFileSync(join(process.cwd(), "src/app/account/profile/profile-form.tsx"), "utf8");
  const streamerForm = readFileSync(join(process.cwd(), "src/app/streamer/profile/profile-form.tsx"), "utf8");

  assert.doesNotMatch(accountAction, /saveOptionalProfileAvatarUpload|avatarFile/);
  assert.doesNotMatch(streamerAction, /saveOptionalProfileAvatarUpload|avatarFile/);
  assert.doesNotMatch(accountForm, /encType="multipart\/form-data"/);
  assert.doesNotMatch(streamerForm, /encType="multipart\/form-data"/);
  assert.match(accountForm, /AvatarCropEditor/);
  assert.match(streamerForm, /AvatarCropEditor/);
});

test("avatar editor supports drag, zoom, positioning, and compact square output", () => {
  const editor = readFileSync(join(process.cwd(), "src/components/profile/avatar-crop-editor.tsx"), "utf8");

  assert.match(editor, /const avatarOutputSize = 512/);
  assert.match(editor, /onPointerDown=\{startDrag\}/);
  assert.match(editor, /Horizontal position/);
  assert.match(editor, /Vertical position/);
  assert.match(editor, /type="range"/);
  assert.match(editor, /canvas\.toBlob/);
  assert.match(editor, /"image\/jpeg"/);
  assert.match(editor, /fetch\("\/api\/account\/profile\/avatar"/);
});
