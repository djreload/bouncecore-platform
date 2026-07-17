import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  dedupeGifResults,
  normalizeGiphyResults,
  normalizeKlipyResults
} from "../src/lib/chat/gif-provider-service.ts";

test("GIPHY normalization keeps PG-13-or-lower results and excludes adult ratings", () => {
  const results = normalizeGiphyResults({
    data: [
      {
        id: "safe",
        images: {
          fixed_width_small: { url: "https://media1.giphy.com/preview.gif" },
          original: { height: "200", url: "https://media1.giphy.com/original.gif", width: "300" }
        },
        rating: "pg-13",
        title: "Safe result",
        url: "https://giphy.com/gifs/safe"
      },
      {
        id: "adult",
        images: {
          fixed_width_small: { url: "https://media1.giphy.com/adult-preview.gif" },
          original: { url: "https://media1.giphy.com/adult.gif" }
        },
        rating: "r",
        title: "Adult result"
      }
    ]
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].provider, "giphy");
  assert.equal(results[0].gifUrl, "https://media1.giphy.com/original.gif");
  assert.equal(results[0].rating, "pg-13");
});

test("KLIPY normalization supports Tenor-style media formats", () => {
  const results = normalizeKlipyResults({
    results: [
      {
        content_description: "Dance",
        id: "klipy-1",
        media_formats: {
          gif: { dims: [320, 180], url: "https://cdn.klipy.com/full.gif" },
          tinygif: { url: "https://cdn.klipy.com/preview.gif" }
        },
        url: "https://klipy.com/gif/klipy-1"
      }
    ]
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].provider, "klipy");
  assert.equal(results[0].previewUrl, "https://cdn.klipy.com/preview.gif");
  assert.equal(results[0].width, 320);
});

test("dedupe prefers GIPHY over KLIPY duplicate GIF URLs", () => {
  const results = dedupeGifResults([
    {
      gifUrl: "https://media.example.com/dup.gif",
      id: "klipy-dup",
      previewUrl: "https://media.example.com/dup.gif",
      provider: "klipy",
      title: "KLIPY duplicate"
    },
    {
      gifUrl: "https://media.example.com/dup.gif",
      id: "giphy-dup",
      previewUrl: "https://media.example.com/dup.gif",
      provider: "giphy",
      title: "GIPHY duplicate"
    }
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].provider, "giphy");
});

test("unified GIF service uses allSettled and provider-specific failure logging", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/chat/gif-provider-service.ts"), "utf8");

  assert.match(service, /Promise\.allSettled/);
  assert.match(service, /\[gif-search\].*\$\{provider\} failed/);
});

test("chat GIF picker automatically loads its first page when opened", () => {
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(panel, /if \(!gifPanelOpen \|\| gifResults\.length \|\| gifLoadingRef\.current\)/);
  assert.match(panel, /void loadGifs\(gifQuery\)/);
  assert.match(panel, /\bRetry\b/);
});
