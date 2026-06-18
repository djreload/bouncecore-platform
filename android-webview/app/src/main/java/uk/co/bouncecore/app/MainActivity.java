package uk.co.bouncecore.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.TextUtils;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.unity3d.mediation.LevelPlay;
import com.unity3d.mediation.LevelPlayAdError;
import com.unity3d.mediation.LevelPlayAdInfo;
import com.unity3d.mediation.LevelPlayAdSize;
import com.unity3d.mediation.LevelPlayConfiguration;
import com.unity3d.mediation.LevelPlayInitError;
import com.unity3d.mediation.LevelPlayInitListener;
import com.unity3d.mediation.LevelPlayInitRequest;
import com.unity3d.mediation.banner.LevelPlayBannerAdView;
import com.unity3d.mediation.banner.LevelPlayBannerAdViewListener;
import com.unity3d.mediation.interstitial.LevelPlayInterstitialAd;
import com.unity3d.mediation.interstitial.LevelPlayInterstitialAdListener;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends Activity {
    private static final String TAG = "BouncecoreAndroid";
    private static final long INTERSTITIAL_COOLDOWN_MS = 180_000L;
    private static final long BANNER_RETRY_DELAY_MS = 15_000L;
    private static final long CONFIG_REFRESH_INTERVAL_MS = 300_000L;
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 2101;
    private static final int MAX_BANNER_RETRIES = 6;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final Runnable configRefreshRunnable = new Runnable() {
        @Override
        public void run() {
            if (!activityResumed) {
                return;
            }

            fetchMobileConfig(false);
            mainHandler.postDelayed(this, CONFIG_REFRESH_INTERVAL_MS);
        }
    };

    private WebView webView;
    private FrameLayout bannerContainer;
    private LevelPlayBannerAdView bannerAdView;
    private LevelPlayInterstitialAd interstitialAd;

    private boolean activityResumed = false;
    private boolean levelPlayReady = false;
    private boolean interstitialShowing = false;
    private boolean appOpenShownThisSession = false;
    private boolean firebaseInitialized = false;
    private boolean fcmTokenRequestInFlight = false;
    private int bannerRetryCount = 0;
    private String fcmToken = "";
    private long lastConfigFetchedAt = 0L;
    private long lastInterstitialShownAt = 0L;
    private MobileRuntimeConfig runtimeConfig = MobileRuntimeConfig.fromBuildConfig();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        setContentView(createLayout());
        configureWebView();
        webView.loadUrl(BuildConfig.BOUNCECORE_WEB_URL);
        fetchMobileConfig(false);
    }

    private ViewGroup createLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(
                0,
                insets.getSystemWindowInsetTop(),
                0,
                insets.getSystemWindowInsetBottom()
            );
            return insets;
        });
        root.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT
        ));

        webView = new WebView(this);
        webView.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1f
        ));

        bannerContainer = new FrameLayout(this);
        bannerContainer.setForegroundGravity(Gravity.CENTER);
        bannerContainer.setVisibility(View.GONE);
        bannerContainer.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(56)
        ));

        root.addView(webView);
        root.addView(bannerContainer);
        return root;
    }

    private void configureWindow() {
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        window.setStatusBarColor(Color.parseColor("#050712"));
        window.setNavigationBarColor(Color.parseColor("#050712"));
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
            window.setAttributes(attributes);
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri currentHost = Uri.parse(BuildConfig.BOUNCECORE_WEB_URL);
                Uri target = request.getUrl();
                boolean sameHost = currentHost.getHost() != null && currentHost.getHost().equalsIgnoreCase(target.getHost());

                if (!TextUtils.isEmpty(runtimeConfig.updateUrl) && runtimeConfig.updateUrl.equals(target.toString())) {
                    openExternalUrl(target);
                    return true;
                }

                if (sameHost) {
                    return false;
                }

                openExternalUrl(target);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                registerFcmTokenWithCurrentSession();
                maybeShowAppOpenInterstitial("page-finished");
            }
        });
    }

    private void fetchMobileConfig(boolean force) {
        long now = SystemClock.elapsedRealtime();
        if (!force && lastConfigFetchedAt > 0 && now - lastConfigFetchedAt < CONFIG_REFRESH_INTERVAL_MS) {
            return;
        }

        lastConfigFetchedAt = now;
        networkExecutor.execute(() -> {
            try {
                MobileRuntimeConfig config = fetchMobileRuntimeConfig();
                mainHandler.post(() -> applyRuntimeConfig(config, "backend"));
            } catch (Exception error) {
                Log.w(TAG, "Mobile config fetch failed, using build fallback: " + error.getMessage());
                mainHandler.post(() -> applyRuntimeConfig(MobileRuntimeConfig.fromBuildConfig(), "build-fallback"));
            }
        });
    }

    private MobileRuntimeConfig fetchMobileRuntimeConfig() throws Exception {
        HttpURLConnection connection = null;

        try {
            URL url = new URL(configEndpointUrl());
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(8_000);
            connection.setReadTimeout(8_000);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", "application/json");

            int statusCode = connection.getResponseCode();
            if (statusCode < 200 || statusCode >= 300) {
                throw new IllegalStateException("HTTP " + statusCode);
            }

            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }

                return MobileRuntimeConfig.fromJson(new JSONObject(output.toString(StandardCharsets.UTF_8.name())));
            }
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private String configEndpointUrl() {
        String baseUrl = BuildConfig.BOUNCECORE_WEB_URL.endsWith("/")
            ? BuildConfig.BOUNCECORE_WEB_URL.substring(0, BuildConfig.BOUNCECORE_WEB_URL.length() - 1)
            : BuildConfig.BOUNCECORE_WEB_URL;
        return baseUrl + "/api/mobile/v1/config";
    }

    private void applyRuntimeConfig(MobileRuntimeConfig config, String source) {
        runtimeConfig = config;
        setTitle(config.appName);
        Log.d(
            TAG,
            "Mobile config applied from " + source
                + ": ads=" + config.adsEnabled
                + ", maintenance=" + config.maintenanceEnabled
                + ", minAndroid=" + config.minimumSupportedVersionCode
                + ", push=" + config.pushEnabled
        );

        if (isUpdateRequired(config)) {
            showRequiredUpdatePage(config);
            destroyBanner();
            return;
        }

        if (config.maintenanceEnabled) {
            showMaintenancePage(config);
            destroyBanner();
            return;
        }

        if (webView.getUrl() == null || webView.getUrl().startsWith("data:")) {
            webView.loadUrl(BuildConfig.BOUNCECORE_WEB_URL);
        }

        if (config.adsEnabled) {
            initializeLevelPlay(config);
        } else {
            destroyBanner();
        }

        if (config.pushEnabled) {
            initializeFirebaseMessaging(config);
        }
    }

    private boolean isUpdateRequired(MobileRuntimeConfig config) {
        return BuildConfig.VERSION_CODE < config.minimumSupportedVersionCode;
    }

    private void showRequiredUpdatePage(MobileRuntimeConfig config) {
        String safeAppName = escapeHtml(config.appName);
        String safeMessage = escapeHtml(config.updateMessage);
        String safeLatestVersion = escapeHtml(config.latestVersionName);
        String safeUpdateUrl = escapeHtml(config.updateUrl);
        String versionLine = "Current build " + BuildConfig.VERSION_CODE + " / required build " + config.minimumSupportedVersionCode;
        if (config.latestVersionCode > 0) {
            versionLine += " / latest build " + config.latestVersionCode;
        }
        String latestLine = !TextUtils.isEmpty(safeLatestVersion)
            ? "<p class=\"meta\">Latest version: " + safeLatestVersion + "</p>"
            : "";
        String updateAction = !TextUtils.isEmpty(config.updateUrl)
            ? "<p><a href=\"" + safeUpdateUrl + "\">Update app</a></p>"
            : "<p class=\"meta\">No update link is currently configured. Contact support for the latest APK.</p>";
        String html = "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            + "<style>body{margin:0;background:#050712;color:#fff;font-family:sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}"
            + "main{max-width:540px}h1{font-size:28px;margin:0 0 12px}p{color:#b7bdd2;line-height:1.5}.meta{font-size:14px;color:#8d96b4}"
            + "a{display:inline-flex;min-height:44px;align-items:center;border-radius:6px;background:#00d4ff;color:#041018;font-weight:800;padding:0 18px;text-decoration:none}</style></head>"
            + "<body><main><h1>Update " + safeAppName + "</h1><p>" + safeMessage + "</p><p class=\"meta\">" + escapeHtml(versionLine) + "</p>"
            + latestLine + updateAction + "</main></body></html>";
        webView.loadDataWithBaseURL(BuildConfig.BOUNCECORE_WEB_URL, html, "text/html", "UTF-8", null);
    }

    private void showMaintenancePage(MobileRuntimeConfig config) {
        String safeAppName = escapeHtml(config.appName);
        String safeMessage = escapeHtml(config.maintenanceMessage);
        String html = "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            + "<style>body{margin:0;background:#050712;color:#fff;font-family:sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}"
            + "main{max-width:520px}h1{font-size:28px;margin:0 0 12px}p{color:#b7bdd2;line-height:1.5}</style></head>"
            + "<body><main><h1>" + safeAppName + "</h1><p>" + safeMessage + "</p></main></body></html>";
        webView.loadDataWithBaseURL(BuildConfig.BOUNCECORE_WEB_URL, html, "text/html", "UTF-8", null);
    }

    private String escapeHtml(String value) {
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }

    private void openExternalUrl(Uri target) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, target));
        } catch (Exception error) {
            Log.w(TAG, "Could not open external URL: " + target + " " + error.getMessage());
        }
    }

    private void initializeFirebaseMessaging(MobileRuntimeConfig config) {
        if (!config.hasFirebaseAndroidConfig()) {
            Log.w(TAG, "Firebase Android config is missing; push token registration is disabled.");
            return;
        }

        requestNotificationPermissionIfNeeded();

        if (!firebaseInitialized) {
            try {
                if (FirebaseApp.getApps(this).isEmpty()) {
                    FirebaseOptions options = new FirebaseOptions.Builder()
                        .setApiKey(config.firebaseAndroidApiKey)
                        .setApplicationId(config.firebaseAndroidAppId)
                        .setGcmSenderId(config.firebaseMessagingSenderId)
                        .setProjectId(config.firebaseProjectId)
                        .build();
                    FirebaseApp.initializeApp(this, options);
                }

                firebaseInitialized = true;
            } catch (Exception error) {
                Log.w(TAG, "Firebase initialization failed: " + error.getMessage());
                return;
            }
        }

        requestFcmToken();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }

        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return;
        }

        requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, NOTIFICATION_PERMISSION_REQUEST_CODE);
    }

    private void requestFcmToken() {
        if (fcmTokenRequestInFlight || !TextUtils.isEmpty(fcmToken)) {
            registerFcmTokenWithCurrentSession();
            return;
        }

        fcmTokenRequestInFlight = true;
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener((task) -> {
            fcmTokenRequestInFlight = false;

            if (!task.isSuccessful() || TextUtils.isEmpty(task.getResult())) {
                Exception error = task.getException();
                Log.w(TAG, "FCM token request failed: " + (error != null ? error.getMessage() : "unknown error"));
                return;
            }

            fcmToken = task.getResult();
            Log.d(TAG, "FCM token received; registering after authenticated page load.");
            registerFcmTokenWithCurrentSession();
        });
    }

    private void registerFcmTokenWithCurrentSession() {
        if (TextUtils.isEmpty(fcmToken) || webView == null || webView.getUrl() == null || webView.getUrl().startsWith("data:")) {
            return;
        }

        try {
            JSONObject payload = new JSONObject()
                .put("appVersion", BuildConfig.VERSION_NAME)
                .put("deviceName", Build.MANUFACTURER + " " + Build.MODEL)
                .put("osVersion", "Android " + Build.VERSION.RELEASE)
                .put("platform", "android")
                .put("provider", "fcm")
                .put("pushToken", fcmToken);
            String script = "(function(){fetch('/api/mobile/v1/account/devices',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:"
                + JSONObject.quote(payload.toString())
                + "}).catch(function(){});})();";
            webView.evaluateJavascript(script, null);
        } catch (Exception error) {
            Log.w(TAG, "FCM token registration script failed: " + error.getMessage());
        }
    }

    private void initializeLevelPlay(MobileRuntimeConfig config) {
        if (levelPlayReady) {
            return;
        }

        if (TextUtils.isEmpty(config.levelPlayAppKey)) {
            Log.w(TAG, "LevelPlay app key is not configured; ads are disabled for this build.");
            return;
        }

        if (config.levelPlayTestSuiteEnabled) {
            LevelPlay.setMetaData("is_test_suite", "enable");
        }

        LevelPlayInitRequest initRequest = new LevelPlayInitRequest.Builder(config.levelPlayAppKey).build();
        LevelPlay.init(this, initRequest, new LevelPlayInitListener() {
            @Override
            public void onInitSuccess(LevelPlayConfiguration configuration) {
                levelPlayReady = true;
                Log.d(TAG, "LevelPlay initialized");
                createAndLoadBanner();
                createAndLoadInterstitial();

                if (runtimeConfig.levelPlayTestSuiteEnabled) {
                    mainHandler.postDelayed(() -> LevelPlay.launchTestSuite(MainActivity.this), 500L);
                }
            }

            @Override
            public void onInitFailed(LevelPlayInitError error) {
                levelPlayReady = false;
                Log.w(TAG, "LevelPlay init failed: " + error);
            }
        });
    }

    private void createAndLoadBanner() {
        if (!levelPlayReady || TextUtils.isEmpty(runtimeConfig.levelPlayBannerAdUnitId)) {
            Log.w(TAG, "LevelPlay banner ad unit is not configured; banner is disabled.");
            return;
        }

        destroyBanner();

        LevelPlayAdSize adSize = LevelPlayAdSize.BANNER;
        LevelPlayBannerAdView.Config adConfig = new LevelPlayBannerAdView.Config.Builder()
            .setAdSize(adSize)
            .build();

        bannerAdView = new LevelPlayBannerAdView(this, runtimeConfig.levelPlayBannerAdUnitId, adConfig);
        bannerAdView.setBannerListener(new LevelPlayBannerAdViewListener() {
            @Override
            public void onAdLoaded(LevelPlayAdInfo adInfo) {
                bannerRetryCount = 0;
                bannerContainer.setVisibility(View.VISIBLE);
                Log.d(TAG, "LevelPlay banner loaded: " + adInfo);
            }

            @Override
            public void onAdLoadFailed(LevelPlayAdError error) {
                Log.w(TAG, "LevelPlay banner failed to load: " + error);
                destroyBanner();
                retryBannerLoad();
            }

            @Override
            public void onAdDisplayed(LevelPlayAdInfo adInfo) {
                Log.d(TAG, "LevelPlay banner displayed: " + adInfo);
            }

            @Override
            public void onAdDisplayFailed(LevelPlayAdInfo adInfo, LevelPlayAdError error) {
                Log.w(TAG, "LevelPlay banner failed to display: " + error + " " + adInfo);
            }

            @Override
            public void onAdClicked(LevelPlayAdInfo adInfo) {
                Log.d(TAG, "LevelPlay banner clicked: " + adInfo);
            }

            @Override
            public void onAdExpanded(LevelPlayAdInfo adInfo) {
                Log.d(TAG, "LevelPlay banner expanded: " + adInfo);
            }

            @Override
            public void onAdCollapsed(LevelPlayAdInfo adInfo) {
                Log.d(TAG, "LevelPlay banner collapsed: " + adInfo);
            }

            @Override
            public void onAdLeftApplication(LevelPlayAdInfo adInfo) {
                Log.d(TAG, "LevelPlay banner left app: " + adInfo);
            }
        });

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(dp(320), dp(50), Gravity.CENTER);
        bannerContainer.addView(bannerAdView, params);
        bannerAdView.loadAd();
    }

    private void createAndLoadInterstitial() {
        if (!levelPlayReady || TextUtils.isEmpty(runtimeConfig.levelPlayInterstitialAdUnitId)) {
            Log.w(TAG, "LevelPlay interstitial ad unit is not configured; full-screen ads are disabled.");
            return;
        }

        interstitialAd = new LevelPlayInterstitialAd(runtimeConfig.levelPlayInterstitialAdUnitId);
        interstitialAd.setListener(new LevelPlayInterstitialAdListener() {
            @Override
            public void onAdLoaded(LevelPlayAdInfo adInfo) {
                Log.d(TAG, "LevelPlay interstitial loaded: " + adInfo);
                mainHandler.post(() -> maybeShowAppOpenInterstitial("loaded"));
            }

            @Override
            public void onAdLoadFailed(LevelPlayAdError error) {
                Log.w(TAG, "LevelPlay interstitial failed to load: " + error);
            }

            @Override
            public void onAdDisplayed(LevelPlayAdInfo adInfo) {
                interstitialShowing = true;
                appOpenShownThisSession = true;
                lastInterstitialShownAt = SystemClock.elapsedRealtime();
                Log.d(TAG, "LevelPlay interstitial displayed: " + adInfo);
            }

            @Override
            public void onAdDisplayFailed(LevelPlayAdError error, LevelPlayAdInfo adInfo) {
                interstitialShowing = false;
                Log.w(TAG, "LevelPlay interstitial failed to display: " + error + " " + adInfo);
                loadInterstitial();
            }

            @Override
            public void onAdClicked(LevelPlayAdInfo adInfo) {
                Log.d(TAG, "LevelPlay interstitial clicked: " + adInfo);
            }

            @Override
            public void onAdClosed(LevelPlayAdInfo adInfo) {
                interstitialShowing = false;
                loadInterstitial();
            }

            @Override
            public void onAdInfoChanged(LevelPlayAdInfo adInfo) {
                Log.d(TAG, "LevelPlay interstitial info changed: " + adInfo);
            }
        });

        loadInterstitial();
    }

    private void loadInterstitial() {
        if (interstitialAd != null) {
            interstitialAd.loadAd();
        }
    }

    private void maybeShowAppOpenInterstitial(String reason) {
        long now = SystemClock.elapsedRealtime();
        boolean cooldownElapsed = now - lastInterstitialShownAt >= INTERSTITIAL_COOLDOWN_MS;

        if (activityResumed
            && interstitialAd != null
            && interstitialAd.isAdReady()
            && cooldownElapsed
            && !interstitialShowing
            && !appOpenShownThisSession
            && !runtimeConfig.levelPlayTestSuiteEnabled) {
            Log.d(TAG, "Showing LevelPlay app-open interstitial after " + reason);
            interstitialAd.showAd(this);
        }
    }

    private void retryBannerLoad() {
        if (bannerRetryCount >= MAX_BANNER_RETRIES) {
            return;
        }

        bannerRetryCount += 1;
        mainHandler.postDelayed(() -> {
            if (levelPlayReady && activityResumed) {
                createAndLoadBanner();
            }
        }, BANNER_RETRY_DELAY_MS);
    }

    private void destroyBanner() {
        bannerContainer.removeAllViews();
        bannerContainer.setVisibility(View.GONE);

        if (bannerAdView != null) {
            bannerAdView.destroy();
            bannerAdView = null;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        activityResumed = true;
        fetchMobileConfig(false);
        mainHandler.removeCallbacks(configRefreshRunnable);
        mainHandler.postDelayed(configRefreshRunnable, CONFIG_REFRESH_INTERVAL_MS);
        maybeShowAppOpenInterstitial("resume");

        if (bannerAdView != null) {
            bannerAdView.resumeAutoRefresh();
        }
    }

    @Override
    protected void onPause() {
        if (bannerAdView != null) {
            bannerAdView.pauseAutoRefresh();
        }

        mainHandler.removeCallbacks(configRefreshRunnable);
        activityResumed = false;
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }

        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        destroyBanner();
        networkExecutor.shutdownNow();
        mainHandler.removeCallbacksAndMessages(null);

        if (webView != null) {
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static final class MobileRuntimeConfig {
        final boolean adsEnabled;
        final String appName;
        final String firebaseAndroidApiKey;
        final String firebaseAndroidAppId;
        final String firebaseMessagingSenderId;
        final String firebaseProjectId;
        final String levelPlayAppKey;
        final String levelPlayBannerAdUnitId;
        final String levelPlayInterstitialAdUnitId;
        final boolean levelPlayTestSuiteEnabled;
        final int latestVersionCode;
        final String latestVersionName;
        final boolean maintenanceEnabled;
        final String maintenanceMessage;
        final int minimumSupportedVersionCode;
        final boolean pushEnabled;
        final String updateMessage;
        final String updateUrl;

        private MobileRuntimeConfig(
            boolean adsEnabled,
            String appName,
            String firebaseAndroidApiKey,
            String firebaseAndroidAppId,
            String firebaseMessagingSenderId,
            String firebaseProjectId,
            String levelPlayAppKey,
            String levelPlayBannerAdUnitId,
            String levelPlayInterstitialAdUnitId,
            boolean levelPlayTestSuiteEnabled,
            int latestVersionCode,
            String latestVersionName,
            boolean maintenanceEnabled,
            String maintenanceMessage,
            int minimumSupportedVersionCode,
            boolean pushEnabled,
            String updateMessage,
            String updateUrl
        ) {
            this.adsEnabled = adsEnabled;
            this.appName = appName;
            this.firebaseAndroidApiKey = firebaseAndroidApiKey;
            this.firebaseAndroidAppId = firebaseAndroidAppId;
            this.firebaseMessagingSenderId = firebaseMessagingSenderId;
            this.firebaseProjectId = firebaseProjectId;
            this.levelPlayAppKey = levelPlayAppKey;
            this.levelPlayBannerAdUnitId = levelPlayBannerAdUnitId;
            this.levelPlayInterstitialAdUnitId = levelPlayInterstitialAdUnitId;
            this.levelPlayTestSuiteEnabled = levelPlayTestSuiteEnabled;
            this.latestVersionCode = latestVersionCode;
            this.latestVersionName = latestVersionName;
            this.maintenanceEnabled = maintenanceEnabled;
            this.maintenanceMessage = maintenanceMessage;
            this.minimumSupportedVersionCode = minimumSupportedVersionCode;
            this.pushEnabled = pushEnabled;
            this.updateMessage = updateMessage;
            this.updateUrl = updateUrl;
        }

        static MobileRuntimeConfig fromBuildConfig() {
            boolean hasAdsConfig = !TextUtils.isEmpty(BuildConfig.LEVELPLAY_APP_KEY)
                && !TextUtils.isEmpty(BuildConfig.LEVELPLAY_BANNER_AD_UNIT_ID)
                && !TextUtils.isEmpty(BuildConfig.LEVELPLAY_INTERSTITIAL_AD_UNIT_ID);

            return new MobileRuntimeConfig(
                hasAdsConfig,
                "Bouncecore",
                BuildConfig.FIREBASE_ANDROID_API_KEY,
                BuildConfig.FIREBASE_ANDROID_APP_ID,
                BuildConfig.FIREBASE_MESSAGING_SENDER_ID,
                BuildConfig.FIREBASE_PROJECT_ID,
                BuildConfig.LEVELPLAY_APP_KEY,
                BuildConfig.LEVELPLAY_BANNER_AD_UNIT_ID,
                BuildConfig.LEVELPLAY_INTERSTITIAL_AD_UNIT_ID,
                BuildConfig.LEVELPLAY_TEST_SUITE_ENABLED,
                BuildConfig.VERSION_CODE,
                BuildConfig.VERSION_NAME,
                false,
                "The mobile app is temporarily under maintenance.",
                1,
                hasBuildFirebaseConfig(),
                "A newer Bouncecore app is required. Please update to continue.",
                ""
            );
        }

        static MobileRuntimeConfig fromJson(JSONObject json) {
            JSONObject ads = json.optJSONObject("ads");
            JSONObject levelPlay = ads != null ? ads.optJSONObject("levelPlay") : null;
            JSONObject maintenance = json.optJSONObject("maintenance");
            JSONObject push = json.optJSONObject("push");
            JSONObject firebaseAndroid = push != null ? push.optJSONObject("firebaseAndroid") : null;
            JSONObject version = json.optJSONObject("version");
            boolean adsEnabled = ads != null && ads.optBoolean("enabled", false);
            String appKey = jsonString(levelPlay, "appKey", "");
            String bannerId = jsonString(levelPlay, "bannerAdUnitId", "");
            String interstitialId = jsonString(levelPlay, "interstitialAdUnitId", "");
            String firebaseApiKey = jsonString(firebaseAndroid, "apiKey", "");
            String firebaseAppId = jsonString(firebaseAndroid, "appId", "");
            String firebaseSenderId = jsonString(firebaseAndroid, "messagingSenderId", "");
            String firebaseProjectId = jsonString(firebaseAndroid, "projectId", "");
            boolean pushEnabled = push != null
                && push.optBoolean("enabled", false)
                && !TextUtils.isEmpty(firebaseApiKey)
                && !TextUtils.isEmpty(firebaseAppId)
                && !TextUtils.isEmpty(firebaseSenderId)
                && !TextUtils.isEmpty(firebaseProjectId);

            return new MobileRuntimeConfig(
                adsEnabled && !TextUtils.isEmpty(appKey) && !TextUtils.isEmpty(bannerId) && !TextUtils.isEmpty(interstitialId),
                json.optString("app", "Bouncecore"),
                firebaseApiKey,
                firebaseAppId,
                firebaseSenderId,
                firebaseProjectId,
                appKey,
                bannerId,
                interstitialId,
                levelPlay != null && levelPlay.optBoolean("testSuiteEnabled", false),
                version != null ? Math.max(0, version.optInt("latestVersionCode", 0)) : 0,
                jsonString(version, "latestVersionName", ""),
                maintenance != null && maintenance.optBoolean("enabled", false),
                jsonString(maintenance, "message", "The mobile app is temporarily under maintenance."),
                version != null ? Math.max(1, version.optInt("minimumSupportedVersionCode", 1)) : 1,
                pushEnabled,
                jsonString(version, "updateMessage", "A newer Bouncecore app is required. Please update to continue."),
                jsonString(version, "updateUrl", "")
            );
        }

        boolean hasFirebaseAndroidConfig() {
            return !TextUtils.isEmpty(firebaseAndroidApiKey)
                && !TextUtils.isEmpty(firebaseAndroidAppId)
                && !TextUtils.isEmpty(firebaseMessagingSenderId)
                && !TextUtils.isEmpty(firebaseProjectId);
        }

        private static boolean hasBuildFirebaseConfig() {
            return !TextUtils.isEmpty(BuildConfig.FIREBASE_ANDROID_API_KEY)
                && !TextUtils.isEmpty(BuildConfig.FIREBASE_ANDROID_APP_ID)
                && !TextUtils.isEmpty(BuildConfig.FIREBASE_MESSAGING_SENDER_ID)
                && !TextUtils.isEmpty(BuildConfig.FIREBASE_PROJECT_ID);
        }

        private static String jsonString(JSONObject object, String key, String fallback) {
            if (object == null || object.isNull(key)) {
                return fallback;
            }

            return object.optString(key, fallback);
        }
    }
}
