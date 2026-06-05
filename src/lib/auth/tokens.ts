import { createHash, randomBytes } from "node:crypto";

export function createSecretToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function hashSecretToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenFingerprint(token: string) {
  return hashSecretToken(token).slice(0, 16);
}
