import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("Android WebView exposes file uploads through the system file chooser", () => {
  const activity = readFileSync(
    join(process.cwd(), "android-webview/app/src/main/java/uk/co/bouncecore/app/MainActivity.java"),
    "utf8"
  );
  const manifest = readFileSync(join(process.cwd(), "android-webview/app/src/main/AndroidManifest.xml"), "utf8");

  assert.match(activity, /onShowFileChooser/);
  assert.match(activity, /FILE_CHOOSER_REQUEST_CODE/);
  assert.match(activity, /FileChooserParams\.parseResult/);
  assert.match(activity, /ValueCallback<Uri\[\]>/);
  assert.match(activity, /addJavascriptInterface\(new BouncecoreJavascriptBridge\(\), "BouncecoreAndroid"\)/);
  assert.match(activity, /@JavascriptInterface\s+public void vibrate\(String patternCsv\)/);
  assert.match(activity, /@JavascriptInterface\s+public void setRaveWarActive\(boolean active\)/);
  assert.match(activity, /@JavascriptInterface\s+public void setRaveWarControlState\(boolean canControl, boolean canFire, String status, String weaponLabel, int ammo\)/);
  assert.match(activity, /Math\.min\(parts\.length, 12\)/);
  assert.match(activity, /Math\.min\(900L, value\)/);
  assert.match(manifest, /android\.permission\.VIBRATE/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|READ_MEDIA_IMAGES|READ_MEDIA_VIDEO|READ_MEDIA_AUDIO/);
});

test("Android WebView uses native fullscreen controls for Rave War", () => {
  const activity = readFileSync(
    join(process.cwd(), "android-webview/app/src/main/java/uk/co/bouncecore/app/MainActivity.java"),
    "utf8"
  );

  assert.match(activity, /createRaveWarControlsOverlay/);
  assert.match(activity, /raveWarControlsOverlay/);
  assert.match(activity, /SCREEN_ORIENTATION_SENSOR_LANDSCAPE/);
  assert.match(activity, /WindowInsets\.Type\.statusBars\(\) \| WindowInsets\.Type\.navigationBars\(\)/);
  assert.match(activity, /dispatchRaveWarControl\(control, "down"\)/);
  assert.match(activity, /dispatchRaveWarControl\(control, holdControl \? "up" : "press"\)/);
  assert.match(activity, /"W-", "Previous weapon", "weapon-prev", false/);
  assert.match(activity, /"W\+", "Next weapon", "weapon-next", false/);
  assert.match(activity, /"Z\+", "Zoom in", "zoom-in", false/);
  assert.match(activity, /"Z-", "Zoom out", "zoom-out", false/);
  assert.match(activity, /backButtonParams\.gravity = Gravity\.TOP \| Gravity\.LEFT/);
  assert.match(activity, /backButtonParams\.setMargins\(dp\(6\), dp\(62\), 0, 0\)/);
  assert.match(activity, /leftToolbarParams\.gravity = Gravity\.BOTTOM \| Gravity\.LEFT/);
  assert.match(activity, /leftToolbarParams\.setMargins\(dp\(6\), 0, 0, dp\(6\)\)/);
  assert.match(activity, /rightToolbarParams\.gravity = Gravity\.BOTTOM \| Gravity\.RIGHT/);
  assert.match(activity, /rightToolbarParams\.setMargins\(0, 0, dp\(6\), dp\(6\)\)/);
  assert.doesNotMatch(activity, /applyRaveWarContentInsets|contentContainer|raveWarLeftSystemInset|raveWarRightSystemInset/);
  assert.match(activity, /weaponLabel \+ "\\nx"/);
  assert.doesNotMatch(activity, /Gravity\.TOP \| Gravity\.CENTER_HORIZONTAL/);
  assert.match(activity, /updateRaveWarControlState/);
  assert.match(activity, /button\.setAlpha\(enabled \? 1f : 0\.34f\)/);
  assert.match(activity, /bouncecore:rave-war-native-control/);
  assert.match(activity, /path != null && path\.startsWith\("\/rave-wars\/"\)/);
  assert.match(activity, /raveWarModeActive[\s\S]*bannerContainer\.setVisibility\(View\.GONE\)/);
});
