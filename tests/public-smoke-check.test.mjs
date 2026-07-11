import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCheckUrl,
  evaluateSmokeResponse,
  normalizeBaseUrl,
  parseArgs
} from "../scripts/public-smoke-check.mjs";

test("public smoke check normalizes http and https base URLs", () => {
  assert.equal(normalizeBaseUrl("https://bouncecore.example.com/"), "https://bouncecore.example.com");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:3000/live?debug=1"), "http://127.0.0.1:3000/live");
});

test("public smoke check rejects unsafe base URL protocols", () => {
  assert.throws(() => normalizeBaseUrl("file:///tmp/site"), /http or https/);
  assert.throws(() => normalizeBaseUrl("not a url"), /Invalid base URL/);
});

test("public smoke check builds root-relative target URLs", () => {
  assert.equal(buildCheckUrl("https://bouncecore.example.com/app", "/api/health"), "https://bouncecore.example.com/api/health");
});

test("public smoke check parser reads base URL and timeout", () => {
  const args = parseArgs(["node", "script", "--base-url", "https://bouncecore.example.com", "--timeout-ms", "3000"], {});

  assert.equal(args.baseUrl, "https://bouncecore.example.com");
  assert.equal(args.timeoutMs, 3000);
});

test("public smoke check validates HTML responses", async () => {
  const result = await evaluateSmokeResponse(
    { kind: "html" },
    new Response("<!doctype html><html><body>Bouncecore</body></html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 200
    })
  );

  assert.equal(result.ok, true);
  assert.ok(result.bytes > 0);
});

test("public smoke check validates required and rejected HTML markers", async () => {
  const ok = await evaluateSmokeResponse(
    {
      kind: "html",
      rejectedText: ["Application error"],
      requiredText: ['data-bc-visual-shell="public"']
    },
    new Response('<!doctype html><html><body><div data-bc-visual-shell="public">Bouncecore</div></body></html>', {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 200
    })
  );

  assert.equal(ok.ok, true);

  const missing = await evaluateSmokeResponse(
    {
      kind: "html",
      requiredText: ['data-bc-visual-shell="public"']
    },
    new Response("<!doctype html><html><body>Bouncecore</body></html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 200
    })
  );

  assert.equal(missing.ok, false);
  assert.match(missing.error, /required text/);

  const rejected = await evaluateSmokeResponse(
    {
      kind: "html",
      rejectedText: ["Application error"]
    },
    new Response("<!doctype html><html><body>Application error</body></html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 200
    })
  );

  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /rejected text/);
});

test("public smoke check validates health JSON response", async () => {
  const result = await evaluateSmokeResponse(
    {
      kind: "json",
      validator: (payload) => (payload.ok === true && payload.status === "healthy" ? "" : "bad health")
    },
    new Response(JSON.stringify({ ok: true, status: "healthy" }), {
      headers: { "content-type": "application/json" },
      status: 200
    })
  );

  assert.equal(result.ok, true);
});

test("public smoke check reports JSON validation failures", async () => {
  const result = await evaluateSmokeResponse(
    {
      kind: "json",
      validator: () => "bad payload"
    },
    new Response(JSON.stringify({ ok: false }), {
      headers: { "content-type": "application/json" },
      status: 200
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "bad payload");
});

test("public smoke check validates image assets", async () => {
  const result = await evaluateSmokeResponse(
    { kind: "asset" },
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image/png" },
      status: 200
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.bytes, 3);
});
