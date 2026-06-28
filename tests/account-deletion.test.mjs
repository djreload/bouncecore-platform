import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accountDeletionConfirmationText,
  normalizeAccountDeletionRequest
} from "../src/lib/account/account-deletion-core.ts";

const user = {
  displayName: "Reload",
  email: "reload@example.com"
};

test("account deletion request requires explicit confirmation text", () => {
  assert.throws(
    () =>
      normalizeAccountDeletionRequest(
        {
          confirmation: "delete",
          reason: "Please remove me."
        },
        user
      ),
    /DELETE MY ACCOUNT/
  );
});

test("account deletion request creates operator-ready message", () => {
  const request = normalizeAccountDeletionRequest(
    {
      confirmation: accountDeletionConfirmationText,
      reason: "No longer using the account."
    },
    user
  );

  assert.equal(request.reason, "No longer using the account.");
  assert.match(request.message, /reload@example\.com/);
  assert.match(request.message, /payment, tax, or legal obligations/);
  assert.match(request.message, /No longer using the account/);
});

test("account deletion reason is length-limited", () => {
  assert.throws(
    () =>
      normalizeAccountDeletionRequest(
        {
          confirmation: accountDeletionConfirmationText,
          reason: "x".repeat(1001)
        },
        user
      ),
    /1000 characters/
  );
});
