package uk.co.bouncecore.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.text.TextUtils;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
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
    static final String EXTRA_NOTIFICATION_ACTION_URL = "uk.co.bouncecore.app.NOTIFICATION_ACTION_URL";
    private static final String APP_OPEN_INTERSTITIAL_DISABLED = "disabled";
    private static final String APP_OPEN_INTERSTITIAL_EVERY_OPEN = "every_open";
    private static final String APP_OPEN_INTERSTITIAL_ONCE_PER_SESSION = "once_per_session";
    private static final String MOBILE_PRIVACY_CHOICES_PATH = "/mobile/privacy-choices";
    private static final String PRIVACY_PREFS_NAME = "bouncecore_privacy";
    private static final String PERFORMANCE_PREFS_NAME = "bouncecore_performance";
    private static final String PREF_ADS_CONSENT_SET = "ads_consent_set";
    private static final String PREF_ADS_MARKETING_CONSENT = "ads_marketing_consent";
    private static final String PREF_NOTIFICATION_DISCLOSURE_SHOWN = "notification_disclosure_shown";
    private static final String PREF_HAPTICS_ENABLED = "haptics_enabled";
    private static final String PREF_NATIVE_ADS_ENABLED = "native_ads_enabled";
    private static final long BANNER_RETRY_DELAY_MS = 15_000L;
    private static final long CONFIG_REFRESH_INTERVAL_MS = 300_000L;
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 2101;
    private static final int FILE_CHOOSER_REQUEST_CODE = 2102;
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
    private ValueCallback<Uri[]> filePathCallback;
    private FrameLayout bannerContainer;
    private FrameLayout raveWarControlsOverlay;
    private final List<Button> raveWarTurnControls = new ArrayList<>();
    private Button raveWarFireButton;
    private TextView raveWarStatusText;
    private LevelPlayBannerAdView bannerAdView;
    private LevelPlayInterstitialAd interstitialAd;

    private boolean activityResumed = false;
    private boolean levelPlayReady = false;
    private boolean interstitialShowing = false;
    private boolean appOpenShownThisForeground = false;
    private boolean appOpenShownThisProcess = false;
    private boolean pausedForInterstitial = false;
    private boolean firebaseInitialized = false;
    private boolean fcmTokenRequestInFlight = false;
    private boolean adConsentDialogShowing = false;
    private boolean notificationDisclosureShowing = false;
    private boolean raveWarModeActive = false;
    private boolean persistentAudioActive = false;
    private boolean hapticsEnabled = true;
    private boolean nativeAdsEnabled = true;
    private int bannerRetryCount = 0;
    private String fcmToken = "";
    private long lastConfigFetchedAt = 0L;
    private MobileRuntimeConfig runtimeConfig = MobileRuntimeConfig.fromBuildConfig();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SharedPreferences performancePreferences = getSharedPreferences(PERFORMANCE_PREFS_NAME, MODE_PRIVATE);
        hapticsEnabled = performancePreferences.getBoolean(PREF_HAPTICS_ENABLED, true);
        nativeAdsEnabled = performancePreferences.getBoolean(PREF_NATIVE_ADS_ENABLED, true);
        configureWindow();
        NotificationChannels.ensureDefaultChannel(this);
        setContentView(createLayout());
        configureWebView();
        webView.loadUrl(resolveAppUrlFromIntent(getIntent()));
        fetchMobileConfig(false);
    }

    private ViewGroup createLayout() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        LinearLayout content = new LinearLayout(this);
        content.setBackgroundColor(Color.BLACK);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setFitsSystemWindows(false);
        content.setOnApplyWindowInsetsListener((view, insets) -> {
            if (raveWarModeActive) {
                view.setPadding(0, 0, 0, 0);
            } else {
                view.setPadding(
                    0,
                    insets.getSystemWindowInsetTop(),
                    0,
                    insets.getSystemWindowInsetBottom()
                );
            }

            return insets;
        });
        content.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
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

        content.addView(webView);
        content.addView(bannerContainer);
        root.addView(content);

        raveWarControlsOverlay = createRaveWarControlsOverlay();
        root.addView(raveWarControlsOverlay);

        return root;
    }

    private FrameLayout createRaveWarControlsOverlay() {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setVisibility(View.GONE);
        overlay.setClickable(false);
        overlay.setFitsSystemWindows(false);
        overlay.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        overlay.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(
                Math.max(0, insets.getSystemWindowInsetLeft()),
                0,
                Math.max(0, insets.getSystemWindowInsetRight()),
                Math.max(0, insets.getSystemWindowInsetBottom())
            );
            return insets;
        });

        Button backButton = nativeOverlayButton("LIVE", "Back to live", dp(42), dp(36));
        backButton.setOnClickListener((view) -> {
            setRaveWarMode(false);
            openInternalPath("/live");
        });
        FrameLayout.LayoutParams backButtonParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        backButtonParams.gravity = Gravity.TOP | Gravity.LEFT;
        backButtonParams.setMargins(dp(6), dp(62), 0, 0);
        overlay.addView(backButton, backButtonParams);

        LinearLayout leftToolbar = new LinearLayout(this);
        leftToolbar.setGravity(Gravity.CENTER);
        leftToolbar.setOrientation(LinearLayout.HORIZONTAL);
        leftToolbar.setPadding(dp(3), dp(3), dp(3), dp(3));
        leftToolbar.setBackground(panelBackground("#a6050712", "#8843536d"));

        leftToolbar.addView(raveWarControlButton("<", "Move left", "left", true, dp(38), dp(36)));
        leftToolbar.addView(raveWarControlButton(">", "Move right", "right", true, dp(38), dp(36)));
        leftToolbar.addView(raveWarControlButton("A+", "Aim up", "aim-up", true, dp(38), dp(36)));
        leftToolbar.addView(raveWarControlButton("A-", "Aim down", "aim-down", true, dp(38), dp(36)));

        FrameLayout.LayoutParams leftToolbarParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        leftToolbarParams.gravity = Gravity.BOTTOM | Gravity.LEFT;
        leftToolbarParams.setMargins(dp(6), 0, 0, dp(6));
        overlay.addView(leftToolbar, leftToolbarParams);

        LinearLayout rightToolbar = new LinearLayout(this);
        rightToolbar.setGravity(Gravity.CENTER);
        rightToolbar.setOrientation(LinearLayout.HORIZONTAL);
        rightToolbar.setPadding(dp(3), dp(3), dp(3), dp(3));
        rightToolbar.setBackground(panelBackground("#a6050712", "#66ff3fa4"));
        rightToolbar.addView(raveWarControlButton("W-", "Previous weapon", "weapon-prev", false, dp(38), dp(36)));

        raveWarStatusText = new TextView(this);
        raveWarStatusText.setGravity(Gravity.CENTER);
        raveWarStatusText.setText("WAIT");
        raveWarStatusText.setTextColor(Color.WHITE);
        raveWarStatusText.setTextSize(8f);
        raveWarStatusText.setTypeface(Typeface.DEFAULT_BOLD);
        raveWarStatusText.setMaxLines(2);
        raveWarStatusText.setPadding(dp(2), dp(2), dp(2), dp(2));
        raveWarStatusText.setLayoutParams(new LinearLayout.LayoutParams(dp(52), dp(36)));
        rightToolbar.addView(raveWarStatusText);
        rightToolbar.addView(raveWarControlButton("W+", "Next weapon", "weapon-next", false, dp(38), dp(36)));
        rightToolbar.addView(raveWarControlButton("Z-", "Zoom out", "zoom-out", false, dp(38), dp(36)));
        rightToolbar.addView(raveWarControlButton("Z+", "Zoom in", "zoom-in", false, dp(38), dp(36)));

        raveWarFireButton = raveWarControlButton("FIRE", "Charge and fire", "fire", true, dp(54), dp(36));
        raveWarFireButton.setTextColor(Color.BLACK);
        raveWarFireButton.setBackground(buttonBackground("#ff32ddff", "#ffffffff"));
        rightToolbar.addView(raveWarFireButton);

        FrameLayout.LayoutParams rightToolbarParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        rightToolbarParams.gravity = Gravity.BOTTOM | Gravity.RIGHT;
        rightToolbarParams.setMargins(0, 0, dp(6), dp(6));
        overlay.addView(rightToolbar, rightToolbarParams);

        updateRaveWarControlState(false, false, "Loading match controls...", "", 0);
        return overlay;
    }

    private Button raveWarControlButton(String label, String description, String control, boolean holdControl, int width, int height) {
        Button button = nativeOverlayButton(label, description, width, height);

        if (!control.startsWith("zoom-")) {
            raveWarTurnControls.add(button);
        }

        button.setOnTouchListener((view, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                view.setPressed(true);
                if (holdControl) {
                    dispatchRaveWarControl(control, "down");
                }
                return true;
            }

            if (event.getAction() == MotionEvent.ACTION_UP) {
                view.setPressed(false);
                dispatchRaveWarControl(control, holdControl ? "up" : "press");
                return true;
            }

            if (event.getAction() == MotionEvent.ACTION_CANCEL) {
                view.setPressed(false);
                if (holdControl) {
                    dispatchRaveWarControl(control, "up");
                }
                return true;
            }

            return true;
        });
        return button;
    }

    private void updateRaveWarControlState(boolean canControl, boolean canFire, String status, String weaponLabel, int ammo) {
        for (Button button : raveWarTurnControls) {
            boolean enabled = canControl && (button != raveWarFireButton || canFire);
            button.setEnabled(enabled);
            button.setAlpha(enabled ? 1f : 0.34f);
        }

        if (raveWarStatusText != null) {
            String safeStatus = TextUtils.isEmpty(status) ? "Waiting for match state..." : status;
            String weaponStatus = canControl && !TextUtils.isEmpty(weaponLabel)
                ? weaponLabel + "\nx" + Math.max(0, ammo)
                : "WAIT";
            raveWarStatusText.setText(weaponStatus);
            raveWarStatusText.setContentDescription(
                safeStatus + (canControl ? ". " + weaponLabel + ", " + Math.max(0, ammo) + " remaining." : "")
            );
        }

        if (raveWarControlsOverlay != null) {
            raveWarControlsOverlay.setContentDescription(TextUtils.isEmpty(status) ? "Rave War controls" : status);
        }
    }

    private Button nativeOverlayButton(String label, String description, int width, int height) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setMinHeight(0);
        button.setMinWidth(0);
        button.setPadding(dp(8), 0, dp(8), 0);
        button.setText(label);
        button.setContentDescription(description);
        button.setTextColor(Color.WHITE);
        button.setTextSize(11f);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setSingleLine(true);
        button.setBackground(buttonBackground("#dd111421", "#aa2b3148"));
        button.setLayoutParams(new LinearLayout.LayoutParams(width, height));
        return button;
    }

    private GradientDrawable buttonBackground(String fill, String stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(Color.parseColor(fill));
        drawable.setCornerRadius(dp(10));
        drawable.setStroke(dp(1), Color.parseColor(stroke));
        return drawable;
    }

    private GradientDrawable panelBackground(String fill, String stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(Color.parseColor(fill));
        drawable.setCornerRadius(dp(14));
        drawable.setStroke(dp(1), Color.parseColor(stroke));
        return drawable;
    }

    private void dispatchRaveWarControl(String control, String state) {
        if (webView == null || !raveWarModeActive) {
            return;
        }

        String script = "window.dispatchEvent(new CustomEvent('bouncecore:rave-war-native-control',{detail:{control:"
            + JSONObject.quote(control)
            + ",state:"
            + JSONObject.quote(state)
            + "}}));";
        webView.evaluateJavascript(script, null);
    }

    private boolean isRaveWarUrl(String url) {
        if (TextUtils.isEmpty(url) || url.startsWith("data:")) {
            return false;
        }

        Uri base = Uri.parse(BuildConfig.BOUNCECORE_WEB_URL);
        Uri target = Uri.parse(url);
        boolean sameHost = base.getHost() != null && base.getHost().equalsIgnoreCase(target.getHost());
        String path = target.getPath();
        return sameHost && path != null && path.startsWith("/rave-wars/");
    }

    private void syncRaveWarModeFromUrl(String url) {
        setRaveWarMode(isRaveWarUrl(url));
    }

    private void setRaveWarMode(boolean active) {
        if (raveWarModeActive == active) {
            return;
        }

        raveWarModeActive = active;

        if (raveWarControlsOverlay != null) {
            raveWarControlsOverlay.setVisibility(active ? View.VISIBLE : View.GONE);
        }

        if (active) {
            updateRaveWarControlState(false, false, "Loading match controls...", "", 0);
        }

        if (bannerContainer != null) {
            if (active) {
                bannerContainer.setVisibility(View.GONE);
            } else if (bannerAdView != null && runtimeConfig.bannerAdsEnabled) {
                bannerContainer.setVisibility(View.VISIBLE);
            }
        }

        applyRaveWarWindowMode(active);

        if (webView != null && webView.getParent() instanceof View) {
            ((View) webView.getParent()).requestApplyInsets();
        }
    }

    private void applyRaveWarWindowMode(boolean active) {
        Window window = getWindow();
        View decorView = window.getDecorView();

        if (active) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.setStatusBarColor(Color.BLACK);
            window.setNavigationBarColor(Color.BLACK);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams attributes = window.getAttributes();
                attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                window.setAttributes(attributes);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) {
                    controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                }
            } else {
                decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                );
            }
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
            window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.setStatusBarColor(Color.parseColor("#050712"));
            window.setNavigationBarColor(Color.parseColor("#050712"));

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams attributes = window.getAttributes();
                attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
                window.setAttributes(attributes);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) {
                    controller.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                }
            } else {
                decorView.setSystemUiVisibility(0);
            }
        }
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
        settings.setOffscreenPreRaster(false);
        webView.addJavascriptInterface(new BouncecoreJavascriptBridge(), "BouncecoreAndroid");
        String userAgent = settings.getUserAgentString();
        if (TextUtils.isEmpty(userAgent)) {
            userAgent = "";
        }
        if (!userAgent.contains("BouncecoreAndroid/")) {
            settings.setUserAgentString((userAgent + " BouncecoreAndroid/" + BuildConfig.VERSION_NAME).trim());
        }
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }

                MainActivity.this.filePathCallback = filePathCallback;

                Intent chooserIntent;
                try {
                    chooserIntent = fileChooserParams.createIntent();
                    chooserIntent.addCategory(Intent.CATEGORY_OPENABLE);
                } catch (Exception error) {
                    MainActivity.this.filePathCallback = null;
                    filePathCallback.onReceiveValue(null);
                    Log.w(TAG, "Could not create file chooser intent: " + error.getMessage());
                    return true;
                }

                try {
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception error) {
                    MainActivity.this.filePathCallback = null;
                    filePathCallback.onReceiveValue(null);
                    Log.w(TAG, "Could not open file chooser: " + error.getMessage());
                }

                return true;
            }
        });
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

                if (sameHost && MOBILE_PRIVACY_CHOICES_PATH.equals(target.getPath())) {
                    showAdConsentDialog(true);
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
                syncRaveWarModeFromUrl(url);
                registerFcmTokenWithCurrentSession();
                maybeShowAppOpenInterstitial("page-finished");
            }
        });
    }

    private class BouncecoreJavascriptBridge {
        @JavascriptInterface
        public void vibrate(String patternCsv) {
            mainHandler.post(() -> performVibration(patternCsv));
        }

        @JavascriptInterface
        public void setRaveWarActive(boolean active) {
            mainHandler.post(() -> setRaveWarMode(active));
        }

        @JavascriptInterface
        public void setRaveWarControlState(boolean canControl, boolean canFire, String status, String weaponLabel, int ammo) {
            mainHandler.post(() -> updateRaveWarControlState(canControl, canFire, status, weaponLabel, ammo));
        }

        @JavascriptInterface
        public void setPersistentAudioActive(boolean active) {
            mainHandler.post(() -> {
                persistentAudioActive = active;

                if (!persistentAudioActive && !activityResumed && webView != null) {
                    webView.onPause();
                    webView.pauseTimers();
                }
            });
        }

        @JavascriptInterface
        public void setPerformancePreferences(String preferencesJson) {
            mainHandler.post(() -> applyPerformancePreferences(preferencesJson));
        }
    }

    private void applyPerformancePreferences(String preferencesJson) {
        try {
            JSONObject preferences = new JSONObject(preferencesJson);
            hapticsEnabled = preferences.optBoolean("hapticsEnabled", true);
            nativeAdsEnabled = preferences.optBoolean("nativeAdsEnabled", true);
            getSharedPreferences(PERFORMANCE_PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putBoolean(PREF_HAPTICS_ENABLED, hapticsEnabled)
                .putBoolean(PREF_NATIVE_ADS_ENABLED, nativeAdsEnabled)
                .apply();

            if (!hapticsEnabled) {
                Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (vibrator != null) {
                    vibrator.cancel();
                }
            }

            if (!nativeAdsEnabled) {
                destroyBanner();
                disableInterstitialAds();
            } else {
                maybeInitializeLevelPlayWithConsent(runtimeConfig);
            }
        } catch (Exception error) {
            Log.w(TAG, "Performance preferences could not be applied: " + error.getMessage());
        }
    }

    private void performVibration(String patternCsv) {
        if (!hapticsEnabled || TextUtils.isEmpty(patternCsv)) {
            return;
        }

        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) {
            return;
        }

        long[] pattern = parseVibrationPattern(patternCsv);
        if (pattern.length == 0) {
            return;
        }

        if (pattern.length == 1) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(pattern[0], VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(pattern[0]);
            }
            return;
        }

        long[] waveform = new long[pattern.length + 1];
        waveform[0] = 0L;
        System.arraycopy(pattern, 0, waveform, 1, pattern.length);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(waveform, -1));
        } else {
            vibrator.vibrate(waveform, -1);
        }
    }

    private long[] parseVibrationPattern(String patternCsv) {
        String[] parts = patternCsv.split(",");
        int maxParts = Math.min(parts.length, 12);
        long[] values = new long[maxParts];
        int count = 0;

        for (int index = 0; index < maxParts; index += 1) {
            try {
                long value = Long.parseLong(parts[index].trim());
                if (value > 0L) {
                    values[count] = Math.min(900L, value);
                    count += 1;
                }
            } catch (NumberFormatException ignored) {
                // Ignore malformed vibration segments from JavaScript.
            }
        }

        long[] normalized = new long[count];
        System.arraycopy(values, 0, normalized, 0, count);
        return normalized;
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
                + ", banner=" + config.bannerAdsEnabled
                + ", appOpen=" + config.appOpenInterstitialEnabled
                + ", appOpenFrequency=" + config.appOpenInterstitialFrequency
                + ", maintenance=" + config.maintenanceEnabled
                + ", minAndroid=" + config.minimumSupportedVersionCode
                + ", push=" + config.pushEnabled
        );

        if (isUpdateRequired(config)) {
            showRequiredUpdatePage(config);
            destroyBanner();
            disableInterstitialAds();
            return;
        }

        if (config.maintenanceEnabled) {
            showMaintenancePage(config);
            destroyBanner();
            disableInterstitialAds();
            return;
        }

        if (webView.getUrl() == null || webView.getUrl().startsWith("data:")) {
            webView.loadUrl(BuildConfig.BOUNCECORE_WEB_URL);
        }

        if (config.adsEnabled) {
            maybeInitializeLevelPlayWithConsent(config);
        } else {
            destroyBanner();
            disableInterstitialAds();
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

    private String resolveAppUrlFromIntent(Intent intent) {
        if (intent == null) {
            return BuildConfig.BOUNCECORE_WEB_URL;
        }

        String actionUrl = intent.getStringExtra(EXTRA_NOTIFICATION_ACTION_URL);
        if (TextUtils.isEmpty(actionUrl)) {
            actionUrl = intent.getStringExtra("actionUrl");
        }

        return resolveAppUrl(actionUrl);
    }

    private String resolveAppUrl(String requestedUrl) {
        if (TextUtils.isEmpty(requestedUrl)) {
            return BuildConfig.BOUNCECORE_WEB_URL;
        }

        String trimmed = requestedUrl.trim();
        Uri base = Uri.parse(BuildConfig.BOUNCECORE_WEB_URL);
        String root = BuildConfig.BOUNCECORE_WEB_URL.endsWith("/")
            ? BuildConfig.BOUNCECORE_WEB_URL.substring(0, BuildConfig.BOUNCECORE_WEB_URL.length() - 1)
            : BuildConfig.BOUNCECORE_WEB_URL;

        Uri target = Uri.parse(trimmed);
        if (TextUtils.isEmpty(target.getScheme()) && TextUtils.isEmpty(target.getHost())) {
            if (trimmed.startsWith("/")) {
                return root + trimmed;
            }

            return root + "/" + trimmed;
        }

        boolean sameHost = base.getHost() != null && base.getHost().equalsIgnoreCase(target.getHost());
        boolean safeScheme = "https".equalsIgnoreCase(target.getScheme()) || "http".equalsIgnoreCase(target.getScheme());
        return sameHost && safeScheme ? trimmed : BuildConfig.BOUNCECORE_WEB_URL;
    }

    private SharedPreferences privacyPreferences() {
        return getSharedPreferences(PRIVACY_PREFS_NAME, MODE_PRIVATE);
    }

    private boolean hasAdConsentChoice() {
        return privacyPreferences().getBoolean(PREF_ADS_CONSENT_SET, false);
    }

    private boolean adConsentGranted() {
        return hasAdConsentChoice() && privacyPreferences().getBoolean(PREF_ADS_MARKETING_CONSENT, false);
    }

    private void setAdConsent(boolean granted) {
        privacyPreferences()
            .edit()
            .putBoolean(PREF_ADS_CONSENT_SET, true)
            .putBoolean(PREF_ADS_MARKETING_CONSENT, granted)
            .apply();
        LevelPlay.setConsent(granted);

        if (!granted) {
            destroyBanner();
            disableInterstitialAds();
        }
    }

    private void maybeInitializeLevelPlayWithConsent(MobileRuntimeConfig config) {
        if (!nativeAdsEnabled) {
            destroyBanner();
            disableInterstitialAds();
            return;
        }

        if (!hasAdConsentChoice()) {
            LevelPlay.setConsent(false);
            destroyBanner();
            disableInterstitialAds();
            showAdConsentDialog(false);
            return;
        }

        if (!adConsentGranted()) {
            LevelPlay.setConsent(false);
            destroyBanner();
            disableInterstitialAds();
            return;
        }

        LevelPlay.setConsent(true);
        initializeLevelPlay(config);
    }

    private void openInternalPath(String path) {
        String root = BuildConfig.BOUNCECORE_WEB_URL.endsWith("/")
            ? BuildConfig.BOUNCECORE_WEB_URL.substring(0, BuildConfig.BOUNCECORE_WEB_URL.length() - 1)
            : BuildConfig.BOUNCECORE_WEB_URL;
        webView.loadUrl(root + path);
    }

    private void showAdConsentDialog(boolean force) {
        if (adConsentDialogShowing || (!force && !runtimeConfig.adsEnabled)) {
            return;
        }

        adConsentDialogShowing = true;
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Mobile advertising privacy")
            .setMessage(
                "Bouncecore can show Unity LevelPlay ads. Ads may use the Android advertising ID, app/device data, and network data for ad delivery, measurement, fraud prevention, and frequency control. Choose Allow ads to enable the ad SDK. Choose Necessary only to keep ads disabled."
            )
            .setPositiveButton("Allow ads", (dialogInterface, which) -> {
                setAdConsent(true);
                maybeInitializeLevelPlayWithConsent(runtimeConfig);
            })
            .setNegativeButton("Necessary only", (dialogInterface, which) -> setAdConsent(false))
            .setNeutralButton("Privacy Policy", null)
            .create();

        dialog.setCancelable(force);
        dialog.setCanceledOnTouchOutside(false);
        dialog.setOnDismissListener((dialogInterface) -> adConsentDialogShowing = false);
        dialog.setOnShowListener((dialogInterface) -> dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener((view) -> openInternalPath("/privacy")));
        dialog.show();
    }

    private void initializeFirebaseMessaging(MobileRuntimeConfig config) {
        if (!config.hasFirebaseAndroidConfig()) {
            Log.w(TAG, "Firebase Android config is missing; push token registration is disabled.");
            return;
        }

        if (!notificationPermissionReady()) {
            return;
        }

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

    private boolean notificationPermissionReady() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true;
        }

        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return true;
        }

        showNotificationPermissionDisclosure();
        return false;
    }

    private void showNotificationPermissionDisclosure() {
        if (notificationDisclosureShowing || privacyPreferences().getBoolean(PREF_NOTIFICATION_DISCLOSURE_SHOWN, false)) {
            return;
        }

        notificationDisclosureShowing = true;
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Enable Bouncecore notifications")
            .setMessage(
                "Bouncecore uses notifications for chat mentions, livestream updates, order and download updates, account security, and admin messages you choose in notification settings. Android will ask for permission before notifications can be shown."
            )
            .setPositiveButton("Continue", (dialogInterface, which) -> {
                privacyPreferences().edit().putBoolean(PREF_NOTIFICATION_DISCLOSURE_SHOWN, true).apply();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, NOTIFICATION_PERMISSION_REQUEST_CODE);
                }
            })
            .setNegativeButton("Not now", (dialogInterface, which) ->
                privacyPreferences().edit().putBoolean(PREF_NOTIFICATION_DISCLOSURE_SHOWN, true).apply()
            )
            .create();

        dialog.setCanceledOnTouchOutside(false);
        dialog.setOnDismissListener((dialogInterface) -> notificationDisclosureShowing = false);
        dialog.show();
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
            syncLevelPlayAds();
            return;
        }

        if (TextUtils.isEmpty(config.levelPlayAppKey)) {
            Log.w(TAG, "LevelPlay app key is not configured; ads are disabled for this build.");
            return;
        }

        if (config.levelPlayTestSuiteEnabled) {
            LevelPlay.setMetaData("is_test_suite", "enable");
        }

        LevelPlay.setConsent(true);
        LevelPlayInitRequest initRequest = new LevelPlayInitRequest.Builder(config.levelPlayAppKey).build();
        LevelPlay.init(this, initRequest, new LevelPlayInitListener() {
            @Override
            public void onInitSuccess(LevelPlayConfiguration configuration) {
                levelPlayReady = true;
                Log.d(TAG, "LevelPlay initialized");
                syncLevelPlayAds();

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

    private void syncLevelPlayAds() {
        if (!nativeAdsEnabled) {
            destroyBanner();
            disableInterstitialAds();
            return;
        }

        if (raveWarModeActive) {
            if (bannerContainer != null) {
                bannerContainer.setVisibility(View.GONE);
            }
            return;
        }

        if (runtimeConfig.bannerAdsEnabled) {
            if (bannerAdView == null) {
                createAndLoadBanner();
            }
        } else {
            destroyBanner();
        }

        if (runtimeConfig.appOpenInterstitialEnabled && !APP_OPEN_INTERSTITIAL_DISABLED.equals(runtimeConfig.appOpenInterstitialFrequency)) {
            if (interstitialAd == null) {
                createAndLoadInterstitial();
            } else {
                maybeShowAppOpenInterstitial("config-sync");
            }
        } else {
            disableInterstitialAds();
        }
    }

    private void createAndLoadBanner() {
        if (!nativeAdsEnabled || raveWarModeActive) {
            return;
        }

        if (!levelPlayReady || !runtimeConfig.bannerAdsEnabled || TextUtils.isEmpty(runtimeConfig.levelPlayBannerAdUnitId)) {
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
                bannerContainer.setVisibility(raveWarModeActive ? View.GONE : View.VISIBLE);
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
        if (!nativeAdsEnabled
            || !levelPlayReady
            || !runtimeConfig.appOpenInterstitialEnabled
            || APP_OPEN_INTERSTITIAL_DISABLED.equals(runtimeConfig.appOpenInterstitialFrequency)
            || TextUtils.isEmpty(runtimeConfig.levelPlayInterstitialAdUnitId)) {
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
                appOpenShownThisForeground = true;
                appOpenShownThisProcess = true;
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
        if (nativeAdsEnabled
            && interstitialAd != null
            && runtimeConfig.appOpenInterstitialEnabled
            && !APP_OPEN_INTERSTITIAL_DISABLED.equals(runtimeConfig.appOpenInterstitialFrequency)) {
            interstitialAd.loadAd();
        }
    }

    private void disableInterstitialAds() {
        interstitialAd = null;
        interstitialShowing = false;
    }

    private void maybeShowAppOpenInterstitial(String reason) {
        if (!nativeAdsEnabled
            || raveWarModeActive
            || !runtimeConfig.appOpenInterstitialEnabled
            || APP_OPEN_INTERSTITIAL_DISABLED.equals(runtimeConfig.appOpenInterstitialFrequency)) {
            return;
        }

        if (APP_OPEN_INTERSTITIAL_ONCE_PER_SESSION.equals(runtimeConfig.appOpenInterstitialFrequency) && appOpenShownThisProcess) {
            return;
        }

        if (APP_OPEN_INTERSTITIAL_EVERY_OPEN.equals(runtimeConfig.appOpenInterstitialFrequency) && appOpenShownThisForeground) {
            return;
        }

        if (activityResumed
            && interstitialAd != null
            && interstitialAd.isAdReady()
            && !interstitialShowing
            && !appOpenShownThisForeground) {
            Log.d(TAG, "Showing LevelPlay app-open interstitial after " + reason);
            interstitialAd.showAd(this);
        }
    }

    private void retryBannerLoad() {
        if (!nativeAdsEnabled || bannerRetryCount >= MAX_BANNER_RETRIES) {
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
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
            syncRaveWarModeFromUrl(webView.getUrl());
        }
        if (!pausedForInterstitial) {
            appOpenShownThisForeground = false;
        }
        pausedForInterstitial = false;
        fetchMobileConfig(false);
        mainHandler.removeCallbacks(configRefreshRunnable);
        mainHandler.postDelayed(configRefreshRunnable, CONFIG_REFRESH_INTERVAL_MS);
        maybeShowAppOpenInterstitial("resume");

        if (nativeAdsEnabled && bannerAdView != null) {
            bannerAdView.resumeAutoRefresh();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        if (webView != null) {
            String nextUrl = resolveAppUrlFromIntent(intent);
            syncRaveWarModeFromUrl(nextUrl);
            webView.loadUrl(nextUrl);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback == null) {
                return;
            }

            Uri[] result = resultCode == RESULT_OK
                ? WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                : null;
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE
            && grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            initializeFirebaseMessaging(runtimeConfig);
        }
    }

    @Override
    protected void onPause() {
        pausedForInterstitial = interstitialShowing;

        if (bannerAdView != null) {
            bannerAdView.pauseAutoRefresh();
        }

        mainHandler.removeCallbacks(configRefreshRunnable);
        activityResumed = false;
        if (webView != null && !persistentAudioActive) {
            webView.onPause();
            webView.pauseTimers();
        }
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (raveWarModeActive) {
            setRaveWarMode(false);
            openInternalPath("/live");
            return;
        }

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
        final boolean appOpenInterstitialEnabled;
        final String appOpenInterstitialFrequency;
        final String appName;
        final boolean bannerAdsEnabled;
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
            boolean appOpenInterstitialEnabled,
            String appOpenInterstitialFrequency,
            String appName,
            boolean bannerAdsEnabled,
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
            this.appOpenInterstitialEnabled = appOpenInterstitialEnabled;
            this.appOpenInterstitialFrequency = appOpenInterstitialFrequency;
            this.appName = appName;
            this.bannerAdsEnabled = bannerAdsEnabled;
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
                true,
                APP_OPEN_INTERSTITIAL_EVERY_OPEN,
                "Bouncecore",
                true,
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
            JSONObject behavior = ads != null ? ads.optJSONObject("behavior") : null;
            JSONObject levelPlay = ads != null ? ads.optJSONObject("levelPlay") : null;
            JSONObject maintenance = json.optJSONObject("maintenance");
            JSONObject push = json.optJSONObject("push");
            JSONObject firebaseAndroid = push != null ? push.optJSONObject("firebaseAndroid") : null;
            JSONObject version = json.optJSONObject("version");
            boolean adsEnabled = ads != null && ads.optBoolean("enabled", false);
            String appKey = jsonString(levelPlay, "appKey", "");
            String bannerId = jsonString(levelPlay, "bannerAdUnitId", "");
            String interstitialId = jsonString(levelPlay, "interstitialAdUnitId", "");
            boolean bannerEnabled = behavior == null || behavior.optBoolean("bannerEnabled", true);
            String appOpenFrequency = normalizedAppOpenInterstitialFrequency(
                jsonString(behavior, "appOpenInterstitialFrequency", APP_OPEN_INTERSTITIAL_EVERY_OPEN)
            );
            boolean appOpenEnabled = (behavior == null || behavior.optBoolean("appOpenInterstitialEnabled", true))
                && !APP_OPEN_INTERSTITIAL_DISABLED.equals(appOpenFrequency);
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
                adsEnabled
                    && !TextUtils.isEmpty(appKey)
                    && ((bannerEnabled && !TextUtils.isEmpty(bannerId)) || (appOpenEnabled && !TextUtils.isEmpty(interstitialId))),
                appOpenEnabled,
                appOpenFrequency,
                json.optString("app", "Bouncecore"),
                bannerEnabled,
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

        private static String normalizedAppOpenInterstitialFrequency(String value) {
            if (APP_OPEN_INTERSTITIAL_ONCE_PER_SESSION.equals(value) || APP_OPEN_INTERSTITIAL_DISABLED.equals(value)) {
                return value;
            }

            return APP_OPEN_INTERSTITIAL_EVERY_OPEN;
        }
    }
}
