# Bouncecore Android WebView

This is a small native Android wrapper for the Bouncecore site. It renders the configured HTTPS site in a WebView and initializes Unity Ads for banner and interstitial placements.

## Unity Ads Configuration

- Project ID: `61d46651-d0a2-4175-ade1-fc300e58559f`
- Android Game ID: `6123220`
- Banner ad unit: `Banner_Android`
- Interstitial ad unit: `Interstitial_Android`

The app defaults Unity Ads to test mode. Set `UNITY_TEST_MODE=false` only for production builds after confirming Unity dashboard setup and policy requirements.

## Build

Open this `android-webview` folder in Android Studio, let Gradle sync, then build the `app` module.

To point the WebView at your live site, set this Gradle property:

```properties
BOUNCECORE_WEB_URL=https://your-domain.example
```

For command-line debug builds on Windows:

```powershell
.\android-webview\gradlew.bat -p android-webview --no-daemon assembleDebug -PBOUNCECORE_WEB_URL=https://your-domain.example -PUNITY_TEST_MODE=true
```

The debug APK is written to `android-webview/app/build/outputs/apk/debug/app-debug.apk`.

## Notes

- The WebView blocks navigation away from the configured host.
- Banner ads render in a native bottom container.
- Interstitial ads load after Unity Ads initialization and use a three-minute cooldown.
- The Android manifest declares `INTERNET`, `ACCESS_NETWORK_STATE`, and `AD_ID`.
