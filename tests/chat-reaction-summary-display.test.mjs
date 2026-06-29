import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("chat message cards render visible reaction summaries", () => {
  const content = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(content, /const visibleReactionSummaries = message\.reactions/);
  assert.match(content, /aria-label="Message reactions"/);
  assert.match(content, /summary\.count\.toLocaleString\("en-GB"\)/);
});
