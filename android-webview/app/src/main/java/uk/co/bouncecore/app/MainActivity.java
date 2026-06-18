package uk.co.bouncecore.app;

import android.app.Activity;
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

public class MainActivity extends Activity {
    private static final String TAG = "BouncecoreAndroid";
    private static final long INTERSTITIAL_COOLDOWN_MS = 180_000L;
    private static final long BANNER_RETRY_DELAY_MS = 15_000L;
    private static final int MAX_BANNER_RETRIES = 6;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private WebView webView;
    private FrameLayout bannerContainer;
    private LevelPlayBannerAdView bannerAdView;
    private LevelPlayInterstitialAd interstitialAd;

    private boolean activityResumed = false;
    private boolean levelPlayReady = false;
    private boolean interstitialShowing = false;
    private boolean appOpenShownThisSession = false;
    private int bannerRetryCount = 0;
    private long lastInterstitialShownAt = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        setContentView(createLayout());
        configureWebView();
        initializeLevelPlay();
        webView.loadUrl(BuildConfig.BOUNCECORE_WEB_URL);
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
                return !sameHost;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                maybeShowAppOpenInterstitial("page-finished");
            }
        });
    }

    private void initializeLevelPlay() {
        if (TextUtils.isEmpty(BuildConfig.LEVELPLAY_APP_KEY)) {
            Log.w(TAG, "LevelPlay app key is not configured; ads are disabled for this build.");
            return;
        }

        if (BuildConfig.LEVELPLAY_TEST_SUITE_ENABLED) {
            LevelPlay.setMetaData("is_test_suite", "enable");
        }

        LevelPlayInitRequest initRequest = new LevelPlayInitRequest.Builder(BuildConfig.LEVELPLAY_APP_KEY).build();
        LevelPlay.init(this, initRequest, new LevelPlayInitListener() {
            @Override
            public void onInitSuccess(LevelPlayConfiguration configuration) {
                levelPlayReady = true;
                Log.d(TAG, "LevelPlay initialized");
                createAndLoadBanner();
                createAndLoadInterstitial();

                if (BuildConfig.LEVELPLAY_TEST_SUITE_ENABLED) {
                    LevelPlay.launchTestSuite(getApplicationContext());
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
        if (!levelPlayReady || TextUtils.isEmpty(BuildConfig.LEVELPLAY_BANNER_AD_UNIT_ID)) {
            Log.w(TAG, "LevelPlay banner ad unit is not configured; banner is disabled.");
            return;
        }

        destroyBanner();

        LevelPlayAdSize adSize = LevelPlayAdSize.BANNER;
        LevelPlayBannerAdView.Config adConfig = new LevelPlayBannerAdView.Config.Builder()
            .setAdSize(adSize)
            .build();

        bannerAdView = new LevelPlayBannerAdView(this, BuildConfig.LEVELPLAY_BANNER_AD_UNIT_ID, adConfig);
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
        if (!levelPlayReady || TextUtils.isEmpty(BuildConfig.LEVELPLAY_INTERSTITIAL_AD_UNIT_ID)) {
            Log.w(TAG, "LevelPlay interstitial ad unit is not configured; full-screen ads are disabled.");
            return;
        }

        interstitialAd = new LevelPlayInterstitialAd(BuildConfig.LEVELPLAY_INTERSTITIAL_AD_UNIT_ID);
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
            && !appOpenShownThisSession) {
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
}
