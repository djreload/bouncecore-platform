import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  defaultThemeTokenValues,
  editableThemeTokenDefinitions,
  mergeThemeTokens,
  normalizeThemeInput,
  siteThemePresets
} from "../src/lib/admin/site-theme-core.ts";

const globalsCss = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const buttonSource = readFileSync(new URL("../src/components/ui/button.tsx", import.meta.url), "utf8");

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

test("shared visual system styling is driven by theme tokens", () => {
  assert.match(globalsCss, /--bc-surface-glass:/);
  assert.match(globalsCss, /color-mix\(in srgb, var\(--color-bc-panel\)/);
  assert.match(globalsCss, /\.bc-button-primary/);
  assert.match(globalsCss, /\.bc-button-pink/);
  assert.doesNotMatch(globalsCss, /rgba\(17,\s*20,\s*33,\s*0\.96\)/);
  assert.doesNotMatch(globalsCss, /rgba\(11,\s*13,\s*20,\s*0\.98\)/);

  assert.match(buttonSource, /bc-button-primary/);
  assert.match(buttonSource, /bc-button-pink/);
  assert.doesNotMatch(buttonSource, /#00d5ff/);
  assert.doesNotMatch(buttonSource, /#ff2bd6/);
});
