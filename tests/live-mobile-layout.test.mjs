import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("live mobile layout keeps chat constrained to the video width", () => {
  const livePage = readFileSync(join(process.cwd(), "src/app/live/page.tsx"), "utf8");
  const chatPanel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(livePage, /max-w-\[100vw\]/);
  assert.match(livePage, /w-full max-w-full flex-1 overflow-hidden/);
  assert.match(livePage, /className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden/);
  assert.match(chatPanel, /grid-cols-\[minmax\(0,1fr\)_2rem_minmax\(4\.5rem,auto\)\]/);
  assert.match(chatPanel, /!w-full !flex-auto lg:!w-\[8\.5rem\]/);
});

test("mobile menu receives and refreshes online chat users", () => {
  const shell = readFileSync(join(process.cwd(), "src/components/layout/public-shell.tsx"), "utf8");
  const mobileMenu = readFileSync(join(process.cwd(), "src/components/navigation/public-mobile-menu.tsx"), "utf8");
  const chatPanel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");
  const onlineList = readFileSync(join(process.cwd(), "src/components/chat/mobile-online-user-list.tsx"), "utf8");

  assert.match(shell, /mobilePresenceUsers\?: PublicChatPresenceUserRow\[\]/);
  assert.match(shell, /<PublicMobileMenu[\s\S]*mobilePresenceUsers=\{mobilePresenceUsers\}/);
  assert.match(mobileMenu, /window\.addEventListener\("bouncecore:chat-presence"/);
  assert.match(mobileMenu, /<MobileOnlineUserList roleDisplayLabels=\{roleDisplayLabels\} users=\{presenceUsers\}/);
  assert.match(chatPanel, /new CustomEvent\("bouncecore:chat-presence", \{ detail: \{ users: visiblePresence \} \}\)/);
  assert.match(onlineList, /data-mobile-online-users/);
});
