import assert from "node:assert/strict";
import test from "node:test";
import { musicCheckoutErrorParam } from "../src/lib/music/music-checkout-errors.ts";

test("musicCheckoutErrorParam exposes expected checkout block reasons", () => {
  assert.equal(musicCheckoutErrorParam(new Error("You cannot buy your own track.")), "own-track");
  assert.equal(musicCheckoutErrorParam(new Error("You already own Kisses.")), "already-owned");
  assert.equal(musicCheckoutErrorParam(new Error("Free tracks cannot use PayPal checkout.")), "free-track");
  assert.equal(musicCheckoutErrorParam(new Error("Choose at least one music track.")), "empty-cart");
});
