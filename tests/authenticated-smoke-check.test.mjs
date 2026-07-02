import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCookieHeader,
  extractSetCookieHeaders,
  parseAuthSmokeArgs,
  runAuthenticatedSmokeChecks
} from "../scripts/authenticated-smoke-check.mjs";

test("authenticated smoke check parser requires credentials", () => {
  assert.throws(
    () => parseAuthSmokeArgs(["node", "script", "--base-url", "https://bouncecore.example.com"], {}),
    /SMOKE_AUTH_EMAIL/
  );

  const args = parseAuthSmokeArgs(["node", "script", "--timeout-ms", "3000"], {
    SMOKE_AUTH_EMAIL: "owner@example.com",
    SMOKE_AUTH_PASSWORD: "secret",
    SMOKE_BASE_URL: "https://bouncecore.example.com/"
  });

  assert.equal(args.baseUrl, "https://bouncecore.example.com");
  assert.equal(args.email, "owner@example.com");
  assert.equal(args.password, "secret");
  assert.equal(args.timeoutMs, 3000);
});

test("authenticated smoke check converts set-cookie headers to a request cookie header", () => {
  assert.deepEqual(
    extractSetCookieHeaders(
      new Headers({
        "set-cookie": "bouncecore_session=abc; Path=/; HttpOnly, other=value; Path=/"
      })
    ),
    ["bouncecore_session=abc; Path=/; HttpOnly", "other=value; Path=/"]
  );
  assert.equal(
    buildCookieHeader(["bouncecore_session=abc; Path=/; HttpOnly", "other=value; Path=/"]),
    "bouncecore_session=abc; other=value"
  );
});

test("authenticated smoke check logs in and validates protected shell markers", async () => {
  const calls = [];
  const checks = [
    {
      id: "account",
      kind: "html",
      label: "Account dashboard",
      path: "/account",
      rejectedText: ["Application error"],
      requiredText: ['data-bc-visual-shell="account"', 'data-bc-visual-part="dashboard-shell"']
    }
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ options, url: String(url) });

    if (String(url).endsWith("/api/auth/login")) {
      return new Response("", {
        headers: {
          location: "https://bouncecore.example.com/account",
          "set-cookie": "bouncecore_session=abc; Path=/; HttpOnly"
        },
        status: 303
      });
    }

    assert.equal(options.headers.cookie, "bouncecore_session=abc");

    return new Response('<!doctype html><html><body><main data-bc-visual-shell="account" data-bc-visual-part="dashboard-shell">Dashboard</main></body></html>', {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 200
    });
  };

  const report = await runAuthenticatedSmokeChecks({
    baseUrl: "https://bouncecore.example.com",
    checks,
    email: "owner@example.com",
    fetchImpl,
    password: "secret",
    timeoutMs: 3000
  });

  assert.equal(report.status, "healthy");
  assert.equal(report.passed, 1);
  assert.equal(report.failed, 0);
  assert.equal(calls.length, 2);
});
