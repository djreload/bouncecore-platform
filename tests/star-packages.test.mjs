import assert from "node:assert/strict";
import test from "node:test";
import { getStarPackage, starPackages } from "../src/lib/rewards/star-packages.ts";

test("star packages offer expanded buy options with stable ids", () => {
  assert.equal(starPackages.length, 8);
  assert.deepEqual(
    starPackages.map((pack) => pack.id),
    ["spark", "starter", "supporter", "headliner", "mainstage", "supernova", "festival", "legend"]
  );
  assert.equal(new Set(starPackages.map((pack) => pack.id)).size, starPackages.length);
});

test("getStarPackage returns packages and rejects unknown ids", () => {
  assert.equal(getStarPackage("festival").stars, 7500);
  assert.equal(getStarPackage("legend").pricePence, 9999);
  assert.throws(() => getStarPackage("missing"), /Choose a stars package/);
});
