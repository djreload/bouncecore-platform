# Bouncecore Android WebView

This is a small native Android wrapper for the Bouncecore site. It renders the configured HTTPS site in a WebView and initializes Unity LevelPlay for banner and interstitial placements.

## Unity LevelPlay Configuration

- Project ID: `61d46651-d0a2-4175-ade1-fc300e58559f`
- LevelPlay app key: set with `LEVELPLAY_APP_KEY`
- Banner ad unit: set with `LEVELPLAY_BANNER_AD_UNIT_ID`
- Interstitial ad unit: set with `LEVELPLAY_INTERSTITIAL_AD_UNIT_ID`

The Android wrapper uses Unity LevelPlay SDK. Ads are disabled if the app key is missing.
At runtime the app fetches `https://your-domain.example/api/mobile/v1/config` and uses the saved admin mobile settings first.
The Gradle properties are fallback values for local testing or if the backend config cannot be reached.

## Build

Open this `android-webview` folder in Android Studio, let Gradle sync, then build the `app` module.

To point the WebView at your live site, set this Gradle property:

```properties
BOUNCECORE_WEB_URL=https://your-domain.example
```

For command-line debug builds on Windows:

```powershell
.\android-webview\gradlew.bat -p android-webview --no-daemon assembleDebug -PBOUNCECORE_WEB_URL=https://your-domain.example -PLEVELPLAY_APP_KEY=<app-key> -PLEVELPLAY_BANNER_AD_UNIT_ID=<banner-ad-unit-id> -PLEVELPLAY_INTERSTITIAL_AD_UNIT_ID=<interstitial-ad-unit-id>
```

The debug APK is written to `android-webview/app/build/outputs/apk/debug/app-debug.apk`.

## Release Builds

Production APK/AAB builds must be signed with a persistent release keystore.
Use the release scripts from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-android-release-keystore.ps1 -GeneratePasswords
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-android-release.ps1 -WebUrl https://your-domain.example -VersionCode 2 -VersionName 1.0.1
```

For Google Play, add `-Bundle` to create `app-release.aab`.
Full release instructions are in `docs/ANDROID_RELEASE.md`. Back up `android-webview/release/bouncecore-release.jks` and `android-webview/release/signing.properties`; both are ignored by git.

Release builds can also embed fallback mobile integration values used before the backend config response is available:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-android-release.ps1 -WebUrl https://your-domain.example -VersionCode 1 -VersionName 1.0.0 -Bundle -LevelPlayAppKey <app-key> -BannerAdUnitId <banner-unit-id> -InterstitialAdUnitId <interstitial-unit-id>
```

## Push Notifications

Native Android push uses Firebase Cloud Messaging.

Set these public Android Firebase values in `Admin -> Mobile`:

- Firebase project ID
- Firebase messaging sender ID
- Android app ID
- Android API key

The app fetches them from `/api/mobile/v1/config`, requests Android notification permission when needed, obtains an FCM token, and registers that token through `/api/mobile/v1/account/devices` after the user logs in.

For server-side delivery, set these private environment variables on the web/worker host:

```env
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_CLIENT_PRIVATE_KEY=
PUSH_TOKEN_ENCRYPTION_KEY=
```

`PUSH_TOKEN_ENCRYPTION_KEY` is required because device tokens are encrypted at rest before the worker can deliver queued notifications.

To build, install, and launch on a connected ADB device:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-android-debug.ps1 -WebUrl https://your-domain.example
```

Use `-Serial <device-serial>` if more than one phone/emulator is connected.

The install script accepts LevelPlay values for device testing:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-android-debug.ps1 -WebUrl https://your-domain.example -LevelPlayAppKey <app-key> -BannerAdUnitId <banner-ad-unit-id> -InterstitialAdUnitId <interstitial-ad-unit-id>
```

Add `-LevelPlayTestSuite` to launch Unity's LevelPlay integration test suite after SDK initialization.
It also accepts Firebase fallback values for offline/local config testing: `-FirebaseProjectId`, `-FirebaseMessagingSenderId`, `-FirebaseAndroidAppId`, and `-FirebaseAndroidApiKey`.

## Notes

- The WebView blocks navigation away from the configured host.
- Banner ads render in a native bottom container.
- The Android Activity applies status-bar and navigation-bar insets so the site does not render underneath phone system icons.
- The app reads app name, maintenance mode, Android update policy, Firebase push settings, and LevelPlay ad settings from `/api/mobile/v1/config` on launch and while the app is resumed.
- If the backend minimum supported Android build is higher than the installed `versionCode`, the app shows a required update screen before loading the site.
- LevelPlay does not document a separate app-open ad format in the Android guide, so the app uses the configured interstitial ad unit as the app-open full-screen ad.
- The app-open full-screen ad shows once per foreground app open when the interstitial ad unit has a ready ad.
- The Android manifest declares `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, and `AD_ID`.
