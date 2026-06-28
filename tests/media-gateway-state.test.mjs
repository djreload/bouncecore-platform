import assert from "node:assert/strict";
import test from "node:test";
import { mediaGatewayPathOnline } from "../src/lib/stream/media-gateway-state.ts";

test("mediaGatewayPathOnline reads the active MediaMTX path state", () => {
  assert.equal(
    mediaGatewayPathOnline(
      {
        items: [
          {
            name: "live/bc_live_key",
            online: true,
            source: {
              type: "rtmpsConn"
            }
          }
        ]
      },
      "live/bc_live_key"
    ),
    true
  );
});

test("mediaGatewayPathOnline reports missing or offline paths as offline", () => {
  assert.equal(mediaGatewayPathOnline({ items: [] }, "live/bc_live_key"), false);
  assert.equal(mediaGatewayPathOnline({ items: [{ name: "live/bc_live_key", online: false }] }, "live/bc_live_key"), false);
});

test("mediaGatewayPathOnline returns null for invalid API payloads", () => {
  assert.equal(mediaGatewayPathOnline(null, "live/bc_live_key"), null);
});
