import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizePrivacyRightsRequest,
  privacyRightsRequestTypeLabel,
  privacyRightsRequestTypes
} from "../src/lib/privacy/privacy-rights-core.ts";

test("privacy rights request types expose expected labels", () => {
  assert.deepEqual([...privacyRightsRequestTypes], [
    "access",
    "correction",
    "portability",
    "deletion",
    "restriction",
    "objection",
    "consent",
    "other"
  ]);
  assert.equal(privacyRightsRequestTypeLabel("portability"), "Export or transfer my data");
});

test("privacy rights requests create tracked privacy support requests", () => {
  const request = normalizePrivacyRightsRequest({
    email: " USER@EXAMPLE.COM ",
    message: " Please export my data ",
    name: " User ",
    requestType: "portability"
  });

  assert.equal(request.requestType, "portability");
  assert.equal(request.supportRequest.category, "privacy");
  assert.equal(request.supportRequest.email, "user@example.com");
  assert.equal(request.supportRequest.name, "User");
  assert.equal(request.supportRequest.priority, "high");
  assert.equal(request.supportRequest.subject, "Privacy rights request: Export or transfer my data");
  assert.match(request.supportRequest.message ?? "", /verify identity/i);
  assert.match(request.supportRequest.message ?? "", /Please export my data/);
});

test("privacy rights requests can use signed-in requester email fallback", () => {
  const request = normalizePrivacyRightsRequest(
    {
      message: "Show my records",
      requestType: "access"
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

test("privacy rights requests reject missing details and bad email", () => {
  assert.throws(
    () =>
      normalizePrivacyRightsRequest({
        email: "bad",
        message: "Help",
        requestType: "access"
      }),
    /valid email/
  );

  assert.throws(
    () =>
      normalizePrivacyRightsRequest({
        email: "user@example.com",
        message: "",
        requestType: "access"
      }),
    /Message is required/
  );
});
