import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  accountNavigation,
  adminNavigation,
  findActiveNavigationItem
} from "../src/config/navigation.ts";

test("dashboard navigation chooses the most specific active route", () => {
  assert.equal(findActiveNavigationItem(accountNavigation, "/account")?.href, "/account");
  assert.equal(findActiveNavigationItem(accountNavigation, "/account/profile")?.href, "/account/profile");
  assert.equal(findActiveNavigationItem(accountNavigation, "/account/downloads/purchase-1")?.href, "/account/downloads");
  assert.equal(findActiveNavigationItem(adminNavigation, "/admin/stream-keys")?.href, "/admin/stream-keys");
  assert.equal(findActiveNavigationItem(adminNavigation, "/admin/payments/webhooks/event-1")?.href, "/admin/payments");
});

test("account and admin shells use compact grouped navigation", () => {
  const groupedNav = readFileSync(join(process.cwd(), "src/components/navigation/grouped-nav.tsx"), "utf8");
  const accountShell = readFileSync(join(process.cwd(), "src/components/layout/dashboard-shell.tsx"), "utf8");
  const adminShell = readFileSync(join(process.cwd(), "src/components/layout/admin-shell.tsx"), "utf8");

  assert.match(groupedNav, /mobileOpen/);
  assert.match(groupedNav, /aria-expanded/);
  assert.match(groupedNav, /navigationGroupDescriptions/);
  assert.match(groupedNav, /max-h-\[62dvh\]/);
  assert.match(accountShell, /lg:max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(adminShell, /lg:grid-cols-\[300px_minmax\(0,1fr\)\]/);
});

test("large settings areas expose focused pages and section navigation", () => {
  const accountSettings = readFileSync(join(process.cwd(), "src/app/account/settings/page.tsx"), "utf8");
  const adminSettings = readFileSync(join(process.cwd(), "src/app/admin/settings/settings-panel.tsx"), "utf8");

  assert.equal(existsSync(join(process.cwd(), "src/app/account/preferences/page.tsx")), true);
  assert.equal(existsSync(join(process.cwd(), "src/app/account/privacy/page.tsx")), true);
  assert.match(accountSettings, /Each page contains only its related controls/);
  assert.match(adminSettings, /SectionJumpNav/);
  assert.match(adminSettings, /branding-settings/);
  assert.match(adminSettings, /legal-page-settings/);
  assert.match(adminSettings, /announcement-settings/);
});

test("Rave Wars visible movement buttons support press-and-hold input", () => {
  const game = readFileSync(join(process.cwd(), "src/app/rave-wars/[warId]/rave-war-game.tsx"), "utf8");
  const activity = readFileSync(
    join(process.cwd(), "android-webview/app/src/main/java/uk/co/bouncecore/app/MainActivity.java"),
    "utf8"
  );

  assert.match(game, /Hold to walk left/);
  assert.match(game, /Hold to walk right/);
  assert.match(game, /onPointerDown=.*startMoveHold/s);
  assert.match(game, /onPointerUp=.*stopMoveHold/s);
  assert.match(game, /onLostPointerCapture/);
  assert.match(activity, /dispatchRaveWarControl\(control, "down"\)/);
  assert.match(activity, /dispatchRaveWarControl\(control, holdControl \? "up" : "press"\)/);
});
