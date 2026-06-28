import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEmailAddress } from "../src/lib/mail/email-address.ts";

test("normalizeEmailAddress trims and lowercases valid email addresses", () => {
  assert.equal(normalizeEmailAddress("  Admin@Example.COM  "), "admin@example.com");
});

test("normalizeEmailAddress rejects invalid email addresses", () => {
  assert.throws(() => normalizeEmailAddress("not-an-email"), /valid email/);
  assert.throws(() => normalizeEmailAddress(""), /required/);
});
