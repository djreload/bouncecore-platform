import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const landscapeViewports = [
  { height: 360, width: 640 },
  { height: 390, width: 844 },
  { height: 412, width: 915 },
  { height: 600, width: 960 },
  { height: 800, width: 1280 }
];

test("Rave War battlefield remains a bounded 2:1 surface across common landscape viewports", () => {
  for (const viewport of landscapeViewports) {
    const availableHeight = Math.max(0, viewport.height - 64);
    const battlefieldWidth = Math.min(viewport.width, availableHeight * 2);
    const battlefieldHeight = battlefieldWidth / 2;

    assert.ok(battlefieldWidth <= viewport.width);
    assert.ok(battlefieldHeight <= availableHeight);
    assert.ok(battlefieldWidth > 0 && battlefieldHeight > 0);
  }
});

test("web and Android Rave War layouts reserve safe areas and native controls", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const game = readFileSync(join(process.cwd(), "src/app/rave-wars/[warId]/rave-war-game.tsx"), "utf8");
  const android = readFileSync(join(process.cwd(), "android-webview/app/src/main/java/uk/co/bouncecore/app/MainActivity.java"), "utf8");

  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /height: 100dvh/);
  assert.match(game, /aspect-\[2\/1\]/);
  assert.match(game, /Rotate to landscape/);
  assert.match(android, /SCREEN_ORIENTATION_SENSOR_LANDSCAPE/);
  assert.match(android, /bouncecore:rave-war-native-control/);
  assert.match(android, /bouncecore:app-resume/);
});
