import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultLegalPages, legalPageForKey, mergeLegalPages, normalizeLegalPagesInput } from "../src/lib/admin/legal-pages-core.ts";

test("default legal pages include privacy terms and cookies", () => {
  const pages = defaultLegalPages();

  assert.deepEqual(
    pages.map((page) => page.key),
    ["privacy", "terms", "cookies"]
  );
  assert.equal(pages.every((page) => page.enabled), true);
});

test("saved legal pages merge with defaults", () => {
  const pages = mergeLegalPages([
    {
      body: "Custom privacy text",
      enabled: false,
      key: "privacy",
      title: "Privacy"
    }
  ]);

  assert.equal(legalPageForKey(pages, "privacy")?.body, "Custom privacy text");
  assert.equal(legalPageForKey(pages, "privacy")?.enabled, false);
  assert.equal(legalPageForKey(pages, "terms")?.enabled, true);
});

test("legal page input rejects unknown or incomplete submissions", () => {
  assert.throws(
    () =>
      normalizeLegalPagesInput([
        {
          body: "Body",
          enabled: true,
          key: "privacy",
          title: "Privacy"
        },
        {
          body: "Body",
          enabled: true,
          key: "terms",
          title: "Terms"
        },
        {
          body: "Body",
          enabled: true,
          key: "unknown",
          title: "Unknown"
        }
      ]),
    /Unknown legal page setting/
  );

  assert.throws(
    () =>
      normalizeLegalPagesInput([
        {
          body: "Body",
          enabled: true,
          key: "privacy",
          title: "Privacy"
        }
      ]),
    /All legal page settings/
  );
});
