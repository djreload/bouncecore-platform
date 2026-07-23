import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { assertLocalReleaseDrillSafety } from "../src/lib/release/release-drill-safety.ts";

const safeInput = {
  appUrl: "http://127.0.0.1:3100",
  confirmation: "LOCAL-ONLY",
  databaseUrl: "postgresql://user:pass@postgres:5432/bouncecore_test",
  paypalMode: "sandbox",
  squareMode: "sandbox"
};

test("release drill accepts an explicitly confirmed local sandbox", () => {
  assert.equal(assertLocalReleaseDrillSafety(safeInput).appHostname, "127.0.0.1");
});

test("release drill refuses production hosts and live payment modes", () => {
  assert.throws(() => assertLocalReleaseDrillSafety({ ...safeInput, appUrl: "https://bouncecore.co.uk" }), /non-local application host/);
  assert.throws(() => assertLocalReleaseDrillSafety({ ...safeInput, paypalMode: "live" }), /PayPal sandbox/);
  assert.throws(() => assertLocalReleaseDrillSafety({ ...safeInput, squareMode: "live" }), /Square sandbox/);
  assert.throws(() => assertLocalReleaseDrillSafety({ ...safeInput, confirmation: "" }), /RELEASE_DRILL_CONFIRM/);
});

test("local release drill covers lifecycle, duplicate refunds, stock, downloads, and payout blocking", () => {
  const source = readFileSync(join(process.cwd(), "scripts/local-release-drill.ts"), "utf8");
  for (const marker of [
    "createRaveWarChallenge",
    "acceptRaveWarChallenge",
    "moveRaveWarPlayer",
    "fireRaveWarShot",
    "reconcileRaveWarDeadlines",
    "surrenderRaveWar",
    "duplicate webhook",
    "restockedVariant.stock === 7",
    "blockedPayout.status === \"blocked\""
  ]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});
