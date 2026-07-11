import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("admin users page can send password reset emails", () => {
  const actions = readFileSync(join(process.cwd(), "src/app/admin/users/actions.ts"), "utf8");
  const forms = readFileSync(join(process.cwd(), "src/app/admin/users/user-management-forms.tsx"), "utf8");
  const page = readFileSync(join(process.cwd(), "src/app/admin/users/page.tsx"), "utf8");

  assert.match(actions, /sendAdminPasswordResetAction/);
  assert.match(actions, /requestPasswordReset/);
  assert.match(actions, /appOriginFromHeaders/);
  assert.match(forms, /PasswordResetForm/);
  assert.match(page, /<PasswordResetForm/);
});
