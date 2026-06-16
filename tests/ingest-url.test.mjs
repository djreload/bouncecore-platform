import assert from "node:assert/strict";
import test from "node:test";
import { obsServerUrlFromIngestUrl, resolveIngestUrlTemplate } from "../src/lib/stream/ingest-url.ts";

test("obsServerUrlFromIngestUrl keeps RTMPS server URL and strips stream key query credentials", () => {
  assert.equal(
    obsServerUrlFromIngestUrl("rtmps://develop.k-nrg.co.uk:1936/live?user=bouncecore&pass={streamKey}"),
    "rtmps://develop.k-nrg.co.uk:1936/live"
  );
});

test("obsServerUrlFromIngestUrl strips RTMPS stream key path placeholders", () => {
  assert.equal(
    obsServerUrlFromIngestUrl("rtmps://develop.k-nrg.co.uk:1936/live/{streamKey}"),
    "rtmps://develop.k-nrg.co.uk:1936/live"
  );
});

test("resolveIngestUrlTemplate inserts encoded stream keys into RTMPS templates", () => {
  assert.equal(
    resolveIngestUrlTemplate("rtmps://example.com:1936/live/{streamKey}", "bc_live_a/b"),
    "rtmps://example.com:1936/live/bc_live_a%2Fb"
  );
});
