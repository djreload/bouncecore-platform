import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("chat moderation actions stay behind a dedicated confirmed menu", () => {
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(panel, /openModerationMessageId/);
  assert.match(panel, /aria-controls={`message-moderation-\$\{message\.id\}`}/);
  assert.match(panel, /aria-expanded={moderationMenuOpen}/);
  assert.match(panel, /Restricted actions\. You will be asked to confirm before anything changes\./);
  assert.match(panel, /onSubmit=\{\(event\) => confirmMessageRemoval\(event, message\.authorDisplayName\)\}/);
  assert.match(panel, /onSubmit=\{\(event\) => confirmChatBan\(event, message\.authorDisplayName\)\}/);
  assert.match(panel, /window\.confirm\(`Remove \$\{displayName\}'s message from live chat\?/);
  assert.match(panel, /window\.confirm\(`Ban \$\{displayName\} from chat for \$\{durationLabel\}\?/);
  assert.match(panel, /setOpenModerationMessageId\(null\)/);
});

test("server-side permissions still guard chat removal and bans", () => {
  const actions = readFileSync(join(process.cwd(), "src/app/chat/actions.ts"), "utf8");

  assert.match(actions, /intent === "delete-message"[\s\S]*hasPermission\(user, "moderation\.use"\)/);
  assert.match(actions, /intent === "ban-user"[\s\S]*hasPermission\(user, "moderation\.use"\)/);
});
