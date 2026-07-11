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
  assert.match(manifest, /android\.permission\.VIBRATE/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|READ_MEDIA_IMAGES|READ_MEDIA_VIDEO|READ_MEDIA_AUDIO/);
});
