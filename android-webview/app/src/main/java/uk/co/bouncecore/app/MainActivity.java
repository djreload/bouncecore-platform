package uk.co.bouncecore.app;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.IUnityAdsLoadListener;
import com.unity3d.ads.IUnityAdsShowListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsShowOptions;
import com.unity3d.services.banners.BannerErrorInfo;
import com.unity3d.services.banners.BannerView;
import com.unity3d.services.banners.UnityBannerSize;

public class MainActivity extends Activity implements IUnityAdsInitializationListener {
    private static final String TAG = "BouncecoreAndroid";
    private static final long INTERSTITIAL_COOLDOWN_MS = 180_000L;
    private static final long BANNER_RETRY_DELAY_MS = 15_000L;
    private static final int MAX_BANNER_RETRIES = 6;

    private WebView webView;
    private FrameLayout bannerContainer;
    private BannerView bannerView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean unityAdsReady = false;
    private boolean activityResumed = false;
    private boolean interstitialLoaded = false;
    private boolean interstitialLoading = false;
    private boolean interstitialShowing = false;
    private boolean appOpenShownThisSession = false;
    private int bannerRetryCount = 0;
    private int bannerAdUnitAttempt = 0;
    private int interstitialAdUnitAttempt = 0;
    private String loadedInterstitialAdUnitId = BuildConfig.UNITY_INTERSTITIAL_AD_UNIT_ID;
    private long lastInterstitialShownAt = 0L;

    private final IUnityAdsLoadListener interstitialLoadListener = new IUnityAdsLoadListener() {
        @Override
        public void onUnityAdsAdLoaded(String placementId) {
            if (!isKnownInterstitialAdUnit(placementId)) {
                return;
            }

            Log.d(TAG, "Full-screen ad loaded: " + placementId);
            loadedInterstitialAdUnitId = placementId;
            interstitialLoading = false;
            interstitialLoaded = true;
            mainHandler.post(() -> maybeShowAppOpenAd("loaded"));
        }

        @Override
        public void onUnityAdsFailedToLoad(String placementId, UnityAds.UnityAdsLoadError error, String message) {
            if (!isKnownInterstitialAdUnit(placementId)) {
                return;
            }

            interstitialLoading = false;
            interstitialLoaded = false;
            Log.w(TAG, "Full-screen ad failed to load: " + error + " " + message);
            if (tryNextInterstitialAdUnit()) {
                return;
            }
        }
    };

    private final IUnityAdsShowListener interstitialShowListener = new IUnityAdsShowListener() {
        @Override
        public void onUnityAdsShowFailure(String placementId, UnityAds.UnityAdsShowError error, String message) {
            interstitialLoaded = false;
            interstitialShowing = false;
            Log.w(TAG, "Full-screen ad failed to show: " + error + " " + message);
            loadInterstitial();
        }

        @Override
        public void onUnityAdsShowStart(String placementId) {
            Log.d(TAG, "Full-screen ad started: " + placementId);
            interstitialShowing = true;
            appOpenShownThisSession = true;
            lastInterstitialShownAt = SystemClock.elapsedRealtime();
        }

        @Override
        public void onUnityAdsShowClick(String placementId) {
            Log.d(TAG, "Interstitial clicked: " + placementId);
        }

        @Override
        public void onUnityAdsShowComplete(String placementId, UnityAds.UnityAdsShowCompletionState state) {
            interstitialLoaded = false;
            interstitialShowing = false;
            loadInterstitial();
        }
    };

    private final BannerView.IListener bannerListener = new BannerView.IListener() {
        @Override
        public void onBannerLoaded(BannerView bannerAdView) {
            bannerRetryCount = 0;
            bannerContainer.setVisibility(View.VISIBLE);
            Log.d(TAG, "Banner loaded: " + bannerAdView.getPlacementId());
        }

        @Override
        public void onBannerFailedToLoad(BannerView bannerAdView, BannerErrorInfo errorInfo) {
            Log.w(TAG, "Banner failed to load: " + errorInfo.errorCode + " " + errorInfo.errorMessage);
            bannerContainer.removeAllViews();
            bannerContainer.setVisibility(View.GONE);
            if (bannerView == bannerAdView) {
                bannerView.destroy();
                bannerView = null;
            }

            if (tryNextBannerAdUnit()) {
                return;
            }

            if (bannerRetryCount < MAX_BANNER_RETRIES) {
                bannerRetryCount += 1;
                mainHandler.postDelayed(() -> {
                    if (unityAdsReady && activityResumed) {
                        loadBanner();
                    }
                }, BANNER_RETRY_DELAY_MS);
            }
        }

        @Override
        public void onBannerClick(BannerView bannerAdView) {
            Log.d(TAG, "Banner clicked: " + bannerAdView.getPlacementId());
        }

        @Override
        public void onBannerLeftApplication(BannerView bannerAdView) {
            Log.d(TAG, "Banner left app: " + bannerAdView.getPlacementId());
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(createLayout());
        configureWebView();
        initializeUnityAds();
        webView.loadUrl(BuildConfig.BOUNCECORE_WEB_URL);
    }

    private ViewGroup createLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setOrientation(LinearLayout.VERTICAL);
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
                maybeShowAppOpenAd("page-finished");
            }
        });
    }

    private void initializeUnityAds() {
        UnityAds.initialize(getApplicationContext(), BuildConfig.UNITY_ANDROID_GAME_ID, BuildConfig.UNITY_TEST_MODE, this);
    }

    @Override
    public void onInitializationComplete() {
        unityAdsReady = true;
        Log.d(TAG, "Unity Ads initialized");
        loadBanner();
        loadInterstitial();
    }

    @Override
    public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
        Log.w(TAG, "Unity Ads initialization failed: " + error + " " + message);
    }

    private void loadBanner() {
        if (!unityAdsReady) {
            return;
        }

        bannerContainer.removeAllViews();
        if (bannerView != null) {
            bannerView.destroy();
            bannerView = null;
        }

        String bannerAdUnitId = bannerAdUnitCandidates()[bannerAdUnitAttempt];
        Log.d(TAG, "Loading banner ad unit: " + bannerAdUnitId);
        bannerView = new BannerView(this, bannerAdUnitId, new UnityBannerSize(320, 50));
        bannerView.setListener(bannerListener);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(dp(320), dp(50), Gravity.CENTER);
        bannerContainer.addView(bannerView, params);
        bannerView.load();
    }

    private void loadInterstitial() {
        if (!unityAdsReady || interstitialLoading || interstitialLoaded) {
            return;
        }

        interstitialLoading = true;
        String interstitialAdUnitId = interstitialAdUnitCandidates()[interstitialAdUnitAttempt];
        Log.d(TAG, "Loading full-screen ad unit: " + interstitialAdUnitId);
        UnityAds.load(interstitialAdUnitId, interstitialLoadListener);
    }

    private void maybeShowAppOpenAd(String reason) {
        long now = SystemClock.elapsedRealtime();
        boolean cooldownElapsed = now - lastInterstitialShownAt >= INTERSTITIAL_COOLDOWN_MS;

        if (activityResumed && interstitialLoaded && cooldownElapsed && !interstitialShowing && !appOpenShownThisSession) {
            Log.d(TAG, "Showing app-open full-screen ad after " + reason);
            UnityAds.show(this, loadedInterstitialAdUnitId, new UnityAdsShowOptions(), interstitialShowListener);
        }
    }

    private boolean tryNextBannerAdUnit() {
        String[] candidates = bannerAdUnitCandidates();
        if (bannerAdUnitAttempt >= candidates.length - 1) {
            return false;
        }

        bannerAdUnitAttempt += 1;
        Log.d(TAG, "Retrying banner with test ad unit: " + candidates[bannerAdUnitAttempt]);
        mainHandler.postDelayed(() -> {
            if (unityAdsReady && activityResumed) {
                loadBanner();
            }
        }, 1_000L);
        return true;
    }

    private boolean tryNextInterstitialAdUnit() {
        String[] candidates = interstitialAdUnitCandidates();
        if (interstitialAdUnitAttempt >= candidates.length - 1) {
            return false;
        }

        interstitialAdUnitAttempt += 1;
        Log.d(TAG, "Retrying full-screen ad with test ad unit: " + candidates[interstitialAdUnitAttempt]);
        mainHandler.postDelayed(this::loadInterstitial, 1_000L);
        return true;
    }

    private String[] bannerAdUnitCandidates() {
        if (!BuildConfig.UNITY_TEST_MODE) {
            return new String[] { BuildConfig.UNITY_BANNER_AD_UNIT_ID };
        }

        return new String[] { BuildConfig.UNITY_BANNER_AD_UNIT_ID, "banner", "topBanner", "bottomBanner" };
    }

    private String[] interstitialAdUnitCandidates() {
        if (!BuildConfig.UNITY_TEST_MODE) {
            return new String[] { BuildConfig.UNITY_INTERSTITIAL_AD_UNIT_ID };
        }

        return new String[] { BuildConfig.UNITY_INTERSTITIAL_AD_UNIT_ID, "video" };
    }

    private boolean isKnownInterstitialAdUnit(String placementId) {
        for (String candidate : interstitialAdUnitCandidates()) {
            if (candidate.equals(placementId)) {
                return true;
            }
        }

        return false;
    }

    @Override
    protected void onResume() {
        super.onResume();
        activityResumed = true;
        if (unityAdsReady) {
            if (bannerView == null) {
                loadBanner();
            }
            loadInterstitial();
            maybeShowAppOpenAd("resume");
        }
    }

    @Override
    protected void onPause() {
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
        if (bannerView != null) {
            bannerContainer.removeAllViews();
            bannerView.destroy();
            bannerView = null;
        }

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
