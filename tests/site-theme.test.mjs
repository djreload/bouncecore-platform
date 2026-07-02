import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultThemeTokenValues,
  editableThemeTokenDefinitions,
  mergeThemeTokens,
  normalizeThemeInput,
  siteThemePresets
} from "../src/lib/admin/site-theme-core.ts";

test("theme presets cover every editable theme token", () => {
  const tokenKeys = editableThemeTokenDefinitions.map((token) => token.key).sort();

  for (const preset of siteThemePresets) {
    assert.deepEqual(Object.keys(preset.tokens).sort(), tokenKeys);
  }
});

test("default theme token values match editable token defaults", () => {
  const defaults = defaultThemeTokenValues();

  for (const token of editableThemeTokenDefinitions) {
    assert.equal(defaults[token.key], token.defaultValue);
  }
});

test("theme token merging uses saved valid hex values and falls back invalid values", () => {
  const tokens = mergeThemeTokens({
    tokens: {
      electric: "#11ccff",
      pink: "bad"
    }
  });

  assert.equal(tokens.find((token) => token.key === "electric")?.value, "#11ccff");
  assert.equal(tokens.find((token) => token.key === "pink")?.value, "#ff2bd6");
});

test("theme input normalizes lowercase hex and rejects unknown tokens", () => {
  const input = normalizeThemeInput({
    tokens: [
      {
        key: "electric",
        value: "#AABBCC"
      }
    ]
  });

  assert.equal(input.tokens.electric, "#aabbcc");

  assert.throws(
    () =>
      normalizeThemeInput({
        tokens: [
          {
            key: "unknown",
            value: "#000000"
          }
        ]
      }),
    /Unknown theme token/
  );
});
