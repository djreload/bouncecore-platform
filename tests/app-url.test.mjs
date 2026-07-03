import assert from "node:assert/strict";
import { test } from "node:test";
import { appOrigin, appOriginFromHeaders, appUrl } from "../src/lib/http/app-url.ts";

function withAppUrl(value, callback) {
  const previous = process.env.NEXT_PUBLIC_APP_URL;

  if (value == null) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = value;
  }

  try {
    return callback();
  } finally {
    if (previous == null) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = previous;
    }
  }
}

test("appOrigin prefers configured public app URL over forwarded headers", () => {
  withAppUrl("https://bouncecore.example.com/path", () => {
    const request = new Request("http://internal.local/account/rewards", {
      headers: {
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "http"
      }
    });

    assert.equal(appOrigin(request), "https://bouncecore.example.com");
  });
});

test("appOrigin sanitizes forwarded host and protocol fallbacks", () => {
  withAppUrl(null, () => {
    const request = new Request("https://internal.local/shop", {
      headers: {
        host: "develop.example.com",
        "x-forwarded-host": "evil.example.com/path",
        "x-forwarded-proto": "javascript"
      }
    });

    assert.equal(appOrigin(request), "https://develop.example.com");
  });
});

test("appOriginFromHeaders builds an origin from forwarded headers", () => {
  withAppUrl(null, () => {
    const requestHeaders = new Headers({
      host: "internal.local:3000",
      "x-forwarded-host": "bouncecore.example.com",
      "x-forwarded-proto": "https"
    });

    assert.equal(appOriginFromHeaders(requestHeaders), "https://bouncecore.example.com");
  });
});

test("appOriginFromHeaders prefers configured app URL", () => {
  withAppUrl("https://public.example.com/admin", () => {
    const requestHeaders = new Headers({
      host: "internal.local:3000",
      "x-forwarded-host": "attacker.example.com",
      "x-forwarded-proto": "http"
    });

    assert.equal(appOriginFromHeaders(requestHeaders), "https://public.example.com");
  });
});

test("appUrl builds safe absolute URLs with query params", () => {
  withAppUrl("https://bouncecore.example.com", () => {
    const request = new Request("http://internal.local/music");
    const url = appUrl(request, "/music/checkout/return", {
      purchaseId: "purchase_1",
      ignored: null
    });

    assert.equal(url.toString(), "https://bouncecore.example.com/music/checkout/return?purchaseId=purchase_1");
  });
});
