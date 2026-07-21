import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { raveWarEntryRefundEligibility } from "../src/lib/rave-wars/rave-war-accounting-core.ts";

test("paid Rave War entry refunds are limited to unrefunded terminal challenges", () => {
  for (const status of ["cancelled", "declined", "expired"]) {
    assert.equal(raveWarEntryRefundEligibility({ entryStars: 25, entryStarsRefundedAt: null, status }).eligible, true);
  }

  assert.equal(raveWarEntryRefundEligibility({ entryStars: 0, entryStarsRefundedAt: null, status: "cancelled" }).eligible, false);
  assert.equal(raveWarEntryRefundEligibility({ entryStars: 25, entryStarsRefundedAt: new Date(), status: "cancelled" }).eligible, false);
  assert.equal(raveWarEntryRefundEligibility({ entryStars: 25, entryStarsRefundedAt: null, status: "active" }).eligible, false);
  assert.equal(raveWarEntryRefundEligibility({ entryStars: 25, entryStarsRefundedAt: null, status: "finished" }).eligible, false);
});

test("Rave War refund service claims once before crediting the wallet", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-accounting-service.ts"), "utf8");

  assert.match(source, /entryStarsRefundedAt:\s*null/);
  assert.match(source, /if \(claim\.count !== 1\)/);
  assert.match(source, /balance:\s*\{ increment: war\.entryStars \}/);
  assert.match(source, /challenge\.entry-refunded/);
});

test("decline, cancel, expiry, and pending admin force-end use the shared refund path", () => {
  const lifecycle = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");
  const admin = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-admin-service.ts"), "utf8");

  assert.ok((lifecycle.match(/refundRaveWarEntryStars\(tx/g) ?? []).length >= 3);
  assert.match(lifecycle, /terminationReason:\s*"challenge-expired"/);
  assert.match(admin, /war\.status === "pending"[\s\S]*refundRaveWarEntryStars\(tx/);
});
