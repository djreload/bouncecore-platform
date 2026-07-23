import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("admin uploads authenticate before multipart parsing", () => {
  const source = readFileSync(join(process.cwd(), "src/app/api/admin/uploads/route.ts"), "utf8");
  const authenticationIndex = source.indexOf('getApiUserWithPermission("admin.access")');
  const formDataIndex = source.indexOf("await request.formData()");

  assert.ok(authenticationIndex >= 0);
  assert.ok(formDataIndex > authenticationIndex);
});

test("global responses include baseline security headers", () => {
  const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

  for (const header of ["Referrer-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options"]) {
    assert.match(source, new RegExp(header));
  }
});
