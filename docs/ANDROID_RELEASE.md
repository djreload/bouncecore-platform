# Android Release Builds

This project includes a native Android WebView wrapper at `android-webview/`.
Debug APKs are useful for device testing, but production installs and Play Store uploads must be signed with a persistent release key.

## Important Signing Rule

Keep the release keystore and passwords safe.
Android treats the signing key as the app identity. If the key is lost, future APK updates signed with a different key will not install over the existing app, and Play Store updates may be blocked unless Play App Signing recovery is configured.

Do not commit keystores or signing passwords. The repository ignores:

- `android-webview/release/`
- `*.jks`
- `*.keystore`
- `*.p12`
- `*.pfx`

## Create a Release Keystore

From Windows PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-android-release-keystore.ps1 -GeneratePasswords
```

Default outputs:

```text
android-webview/release/bouncecore-release.jks
android-webview/release/signing.properties
```

The default alias is:

```text
bouncecore
```

To choose a custom location or alias:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-android-release-keystore.ps1 `
  -KeystorePath C:\secure\bouncecore-release.jks `
  -CredentialsPath C:\secure\bouncecore-signing.properties `
  -Alias bouncecore `
  -GeneratePasswords
```

Back up both the keystore and `signing.properties` outside the repo.
The credentials file contains the signing passwords and is required for non-interactive release builds.

## Build a Signed Release APK

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-android-release.ps1 `
  -WebUrl https://app.yourdomain.com `
  -VersionCode 2 `
  -VersionName 1.0.1
```

Default output:

```text
android-webview/app/build/outputs/apk/release/app-release.apk
```

## Build a Signed Play Store AAB

Google Play normally expects an Android App Bundle:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-android-release.ps1 `
  -WebUrl https://app.yourdomain.com `
  -VersionCode 2 `
  -VersionName 1.0.1 `
  -Bundle
```

Default output:

```text
android-webview/app/build/outputs/bundle/release/app-release.aab
```

## Non-Interactive CI/Server Builds

Use the generated credentials file:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-android-release.ps1 `
  -CredentialsPath C:\secure\bouncecore-signing.properties `
  -WebUrl https://app.yourdomain.com `
  -VersionCode 2 `
  -VersionName 1.0.1 `
  -Bundle
```

Or set these environment variables before running the build script:

```powershell
$env:BOUNCECORE_RELEASE_STORE_FILE="C:\secure\bouncecore-release.jks"
$env:BOUNCECORE_RELEASE_STORE_PASSWORD="replace-with-secret"
$env:BOUNCECORE_RELEASE_KEY_ALIAS="bouncecore"
$env:BOUNCECORE_RELEASE_KEY_PASSWORD="replace-with-secret"
```

Then run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-android-release.ps1 `
  -WebUrl https://app.yourdomain.com `
  -VersionCode 2 `
  -VersionName 1.0.1 `
  -Bundle
```

## Versioning

Every release uploaded to Google Play must use a higher `VersionCode` than the previous upload.
`VersionName` is the public display version.

Recommended pattern:

```text
1.0.0 -> versionCode 1
1.0.1 -> versionCode 2
1.1.0 -> versionCode 10
```

The app package name is:

```text
uk.co.bouncecore.app
```

## Runtime Configuration

The Android app still pulls live settings from:

```text
https://app.yourdomain.com/api/mobile/v1/config
```

That means mobile ads, maintenance mode, update policy, Firebase push config, and feature flags can be changed in `Admin -> Mobile` without rebuilding the app. The release build only needs the correct WebView base URL and package signing.

For Play Store release candidates, you can also embed fallback values used before the backend config is fetched:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-android-release.ps1 `
  -WebUrl https://app.yourdomain.com `
  -VersionCode 1 `
  -VersionName 1.0.0 `
  -Bundle `
  -LevelPlayAppKey <levelplay-app-key> `
  -BannerAdUnitId <banner-ad-unit-id> `
  -InterstitialAdUnitId <interstitial-ad-unit-id> `
  -FirebaseAndroidApiKey <firebase-android-api-key> `
  -FirebaseAndroidAppId <firebase-android-app-id> `
  -FirebaseMessagingSenderId <firebase-sender-id> `
  -FirebaseProjectId <firebase-project-id>
```
