package uk.co.bouncecore.app;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.view.Gravity;
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

    private WebView webView;
    private FrameLayout bannerContainer;
    private BannerView bannerView;
    private boolean interstitialLoaded = false;
    private long lastInterstitialShownAt = 0L;

    private final IUnityAdsLoadListener interstitialLoadListener = new IUnityAdsLoadListener() {
        @Override
        public void onUnityAdsAdLoaded(String placementId) {
            interstitialLoaded = true;
        }

        @Override
        public void onUnityAdsFailedToLoad(String placementId, UnityAds.UnityAdsLoadError error, String message) {
            interstitialLoaded = false;
            Log.w(TAG, "Interstitial failed to load: " + error + " " + message);
        }
    };

    private final IUnityAdsShowListener interstitialShowListener = new IUnityAdsShowListener() {
        @Override
        public void onUnityAdsShowFailure(String placementId, UnityAds.UnityAdsShowError error, String message) {
            interstitialLoaded = false;
            Log.w(TAG, "Interstitial failed to show: " + error + " " + message);
            loadInterstitial();
        }

        @Override
        public void onUnityAdsShowStart(String placementId) {
            lastInterstitialShownAt = SystemClock.elapsedRealtime();
        }

        @Override
        public void onUnityAdsShowClick(String placementId) {
            Log.d(TAG, "Interstitial clicked: " + placementId);
        }

        @Override
        public void onUnityAdsShowComplete(String placementId, UnityAds.UnityAdsShowCompletionState state) {
            interstitialLoaded = false;
            loadInterstitial();
        }
    };

    private final BannerView.IListener bannerListener = new BannerView.IListener() {
        @Override
        public void onBannerLoaded(BannerView bannerAdView) {
            Log.d(TAG, "Banner loaded: " + bannerAdView.getPlacementId());
        }

        @Override
        public void onBannerFailedToLoad(BannerView bannerAdView, BannerErrorInfo errorInfo) {
            Log.w(TAG, "Banner failed to load: " + errorInfo.errorCode + " " + errorInfo.errorMessage);
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
                maybeShowInterstitial();
            }
        });
    }

    private void initializeUnityAds() {
        UnityAds.initialize(getApplicationContext(), BuildConfig.UNITY_ANDROID_GAME_ID, BuildConfig.UNITY_TEST_MODE, this);
    }

    @Override
    public void onInitializationComplete() {
        loadBanner();
        loadInterstitial();
    }

    @Override
    public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
        Log.w(TAG, "Unity Ads initialization failed: " + error + " " + message);
    }

    private void loadBanner() {
        bannerContainer.removeAllViews();
        bannerView = new BannerView(this, BuildConfig.UNITY_BANNER_AD_UNIT_ID, new UnityBannerSize(320, 50));
        bannerView.setListener(bannerListener);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(dp(320), dp(50), Gravity.CENTER);
        bannerContainer.addView(bannerView, params);
        bannerView.load();
    }

    private void loadInterstitial() {
        UnityAds.load(BuildConfig.UNITY_INTERSTITIAL_AD_UNIT_ID, interstitialLoadListener);
    }

    private void maybeShowInterstitial() {
        long now = SystemClock.elapsedRealtime();
        boolean cooldownElapsed = now - lastInterstitialShownAt >= INTERSTITIAL_COOLDOWN_MS;

        if (interstitialLoaded && cooldownElapsed) {
            UnityAds.show(this, BuildConfig.UNITY_INTERSTITIAL_AD_UNIT_ID, new UnityAdsShowOptions(), interstitialShowListener);
        }
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
