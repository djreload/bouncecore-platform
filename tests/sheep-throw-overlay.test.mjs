import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("sheep throw impact targets exact viewport center", () => {
  const content = readFileSync(join(process.cwd(), "src/components/chat/sheep-throw-overlay.tsx"), "utf8");

  assert.match(content, /const targetX = width \* 0\.5;/);
  assert.match(content, /const targetY = height \* 0\.5;/);
  assert.doesNotMatch(content, /const targetX = width \* \(0\./);
  assert.doesNotMatch(content, /const targetY = height \* \(0\./);
});
