import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function importTenorService() {
  const url = pathToFileURL(path.join(process.cwd(), "src/lib/chat/tenor-service.ts"));
  url.searchParams.set("test", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

test("Tenor GIF search returns pagination cursor and forwards pos", async () => {
  const previousKey = process.env.TENOR_API_KEY;
  const previousFetch = global.fetch;
  const requestedUrls = [];

  process.env.TENOR_API_KEY = "test-tenor-key";
  global.fetch = async (url) => {
    requestedUrls.push(String(url));

    return {
      ok: true,
      async json() {
        return {
          next: "cursor-2",
          results: [
            {
              content_description: "Bounce GIF",
              id: "gif-1",
              media_formats: {
                gif: {
                  dims: [480, 270],
                  url: "https://media.tenor.com/full.gif"
                },
                tinygif: {
                  dims: [160, 90],
                  url: "https://media.tenor.com/preview.gif"
                }
              }
            }
          ]
        };
      }
    };
  };

  try {
    const { searchTenorGifs } = await importTenorService();
    const result = await searchTenorGifs("bounce", "cursor-1");
    const requestedUrl = new URL(requestedUrls[0]);

    assert.equal(requestedUrl.searchParams.get("limit"), "24");
    assert.equal(requestedUrl.searchParams.get("pos"), "cursor-1");
    assert.equal(result.next, "cursor-2");
    assert.equal(result.gifs.length, 1);
    assert.equal(result.gifs[0].previewUrl, "https://media.tenor.com/preview.gif");
  } finally {
    if (previousKey === undefined) {
      delete process.env.TENOR_API_KEY;
    } else {
      process.env.TENOR_API_KEY = previousKey;
    }

    global.fetch = previousFetch;
  }
});
