import { randomBytes } from "node:crypto";

export function makeProfileSlug(displayName: string) {
  const base = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${base || "raver"}-${randomBytes(3).toString("hex")}`;
}
