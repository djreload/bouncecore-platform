import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("successful chat sends carry a revision so the composer clears after repeated sends", () => {
  const state = readFileSync(join(process.cwd(), "src/app/chat/state.ts"), "utf8");
  const actions = readFileSync(join(process.cwd(), "src/app/chat/actions.ts"), "utf8");
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(state, /revision\?: number/);
  assert.match(actions, /revision: Date\.now\(\)/);
  assert.match(panel, /setComposerBody\(""\)/);
  assert.match(panel, /state\.revision/);
});
