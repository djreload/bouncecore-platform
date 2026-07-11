import assert from "node:assert/strict";
import { test } from "node:test";
import { accountDeletionConfirmationText } from "../src/lib/account/account-deletion-core.ts";
import { normalizePublicAccountDeletionRequest } from "../src/lib/account/public-account-deletion-core.ts";

test("public account deletion request creates a high priority account support request", () => {
  const request = normalizePublicAccountDeletionRequest({
    confirmation: accountDeletionConfirmationText,
    email: " PERSON@EXAMPLE.COM ",
    name: " Person ",
    reason: " Close it "
  });

  assert.equal(request.supportRequest.category, "account");
  assert.equal(request.supportRequest.email, "person@example.com");
  assert.equal(request.supportRequest.name, "Person");
  assert.equal(request.supportRequest.priority, "high");
  assert.equal(request.supportRequest.subject, "Public account deletion request");
  assert.match(request.supportRequest.message ?? "", /Verify account ownership|verify identity/i);
  assert.match(request.supportRequest.message ?? "", /Close it/);
});

test("public account deletion request can use signed-in requester email fallback", () => {
  const request = normalizePublicAccountDeletionRequest(
    {
      confirmation: accountDeletionConfirmationText
    },
    {
      displayName: "Reload",
      email: "reload@example.com"
    }
  );

  assert.equal(request.supportRequest.email, "reload@example.com");
  assert.equal(request.supportRequest.name, "Reload");
  assert.match(request.supportRequest.message ?? "", /signed in as Reload/);
});

test("public account deletion request rejects invalid confirmation", () => {
  assert.throws(
    () =>
      normalizePublicAccountDeletionRequest({
        confirmation: "delete",
        email: "person@example.com"
      }),
    /DELETE MY ACCOUNT/
  );
});

test("public account deletion request rejects invalid email", () => {
  assert.throws(
    () =>
      normalizePublicAccountDeletionRequest({
        confirmation: accountDeletionConfirmationText,
        email: "bad"
      }),
    /valid email/
  );
});
