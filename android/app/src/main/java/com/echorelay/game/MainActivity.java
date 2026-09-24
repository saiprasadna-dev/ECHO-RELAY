package com.echorelay.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String OFFLINE_URL = "https://appassets.androidplatform.net/?practice=1";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable loadTimeout = () -> showConnectionError();
    private WebView web;
    private WebViewAssetLoader assets;
    private SharedPreferences preferences;
    private FrameLayout webContainer;
    private EditText serverInput;
    private String currentUrl;
    private boolean offline;
    private View errorPanel;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        preferences = getSharedPreferences("relay", MODE_PRIVATE);
        webContainer = findViewById(R.id.web_container);
        serverInput = findViewById(R.id.server_url);
        String selectedServer = ServerAddress.initialServer(preferences.getString("server", null),
                BuildConfig.DEFAULT_SERVER_URL, preferences.getString("default_server", null), BuildConfig.DEBUG);
        preferences.edit().putString("server", selectedServer)
                .putString("default_server", ServerAddress.normalize(BuildConfig.DEFAULT_SERVER_URL, BuildConfig.DEBUG)).apply();
        serverInput.setText(selectedServer);
        if (selectedServer.startsWith("https:")) {
            ((TextView) findViewById(R.id.server_note)).setText(R.string.internet_note);
            serverInput.setHint("https://your-game.workers.dev");
        }
        View root = findViewById(R.id.root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        root.requestApplyInsets();
        try (InputStream image = getAssets().open("assets/garden-bridge.webp")) {
            ((ImageView) findViewById(R.id.hero_image)).setImageDrawable(Drawable.createFromStream(image, null));
        } catch (IOException ignored) { /* The dark background remains readable. */ }

        WebViewAssetLoader.AssetsPathHandler packaged = new WebViewAssetLoader.AssetsPathHandler(this);
        assets = new WebViewAssetLoader.Builder().addPathHandler("/", path -> {
            if (path.startsWith("api/")) return blocked("Offline practice does not connect to a game server.");
            WebResourceResponse result = packaged.handle(path.isEmpty() ? "index.html" : path);
            return result != null ? result : blocked("Resource not found.");
        }).build();
        findViewById(R.id.offline_button).setOnClickListener(v -> openGame(OFFLINE_URL, true));
        findViewById(R.id.connect_button).setOnClickListener(v -> connect());
        findViewById(R.id.menu_button).setOnClickListener(v -> requestMenu());
        serverInput.setOnEditorActionListener((v, action, event) -> {
            if (action == EditorInfo.IME_ACTION_GO) { connect(); return true; }
            return false;
        });
        if (Build.VERSION.SDK_INT >= 33)
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        if (savedInstanceState != null && savedInstanceState.getString("gameUrl") != null) {
            String restored = savedInstanceState.getString("gameUrl");
            boolean wasOffline = savedInstanceState.getBoolean("offline");
            try { openGame(wasOffline ? OFFLINE_URL : ServerAddress.normalize(restored, BuildConfig.DEBUG), wasOffline); }
            catch (IllegalArgumentException ignored) { /* Fall back to server selection. */ }
        }
    }

    private void connect() {
        try {
            String url = ServerAddress.normalize(serverInput.getText().toString(), BuildConfig.DEBUG);
            serverInput.setError(null);
            preferences.edit().putString("server", url).apply();
            openGame(url, false);
        } catch (IllegalArgumentException error) { serverInput.setError(error.getMessage()); }
    }

    @SuppressLint("SetJavaScriptEnabled") // The packaged game requires JS; no native JS interface is exposed.
    private void openGame(String url, boolean localPractice) {
        destroyWeb();
        offline = localPractice;
        currentUrl = url;
        InputMethodManager keyboard = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        keyboard.hideSoftInputFromWindow(serverInput.getWindowToken(), 0);
        findViewById(R.id.launcher).setVisibility(View.GONE);
        findViewById(R.id.game_container).setVisibility(View.VISIBLE);
        ((TextView) findViewById(R.id.mode_label)).setText(offline ? R.string.practice_mode : R.string.online_mode);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16, 29, 32));
        webContainer.addView(web, new FrameLayout.LayoutParams(-1, -1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " EchoRelayAndroid/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setWebChromeClient(new WebChromeClient()); // Includes the game's hint/reset confirmation dialogs.
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!ServerAddress.sameOrigin(url, request.getUrl().toString())) return blocked("External resource blocked.");
                return localPractice ? assets.shouldInterceptRequest(request.getUrl()) : null;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !ServerAddress.sameOrigin(url, request.getUrl().toString());
            }
            @Override public void onPageFinished(WebView view, String finishedUrl) {
                handler.removeCallbacks(loadTimeout);
                findViewById(R.id.loading).setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showConnectionError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) showConnectionError();
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                showMenu();
                Toast.makeText(MainActivity.this, "The game screen closed. Open the relay again to continue.", Toast.LENGTH_LONG).show();
                return true;
            }
        });
        findViewById(R.id.loading).setVisibility(View.VISIBLE);
        handler.postDelayed(loadTimeout, 20000);
        web.loadUrl(url);
    }

    private static WebResourceResponse blocked(String message) {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", Collections.singletonMap("Cache-Control", "no-store"),
                new ByteArrayInputStream(message.getBytes(StandardCharsets.UTF_8)));
    }

    private void showConnectionError() {
        if (web == null || errorPanel != null) return;
        handler.removeCallbacks(loadTimeout);
        findViewById(R.id.loading).setVisibility(View.GONE);
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        int space = (int) (28 * getResources().getDisplayMetrics().density);
        panel.setPadding(space, space, space, space);
        panel.setBackgroundColor(Color.rgb(16, 29, 32));
        TextView heading = new TextView(this);
        heading.setText(R.string.connection_error); heading.setTextColor(Color.WHITE); heading.setTextSize(24);
        panel.addView(heading);
        TextView help = new TextView(this);
        help.setText(offline ? "The bundled game could not open. Try again or reinstall the app."
                : getString(currentUrl.startsWith("http:") ? R.string.connection_help : R.string.internet_help));
        help.setTextColor(Color.LTGRAY); help.setTextSize(16); help.setPadding(0, space, 0, space);
        panel.addView(help);
        Button retry = new Button(this); retry.setText(R.string.retry);
        retry.setOnClickListener(v -> openGame(currentUrl, offline)); panel.addView(retry);
        Button menu = new Button(this); menu.setText(R.string.return_menu);
        menu.setOnClickListener(v -> showMenu()); panel.addView(menu);
        errorPanel = panel; webContainer.addView(panel, new FrameLayout.LayoutParams(-1, -1));
    }

    private void requestMenu() {
        new AlertDialog.Builder(this).setTitle(R.string.leave_title)
                .setMessage(offline ? R.string.leave_offline : R.string.leave_online)
                .setNegativeButton(R.string.stay, null)
                .setPositiveButton(R.string.return_menu, (dialog, which) -> showMenu()).show();
    }
    private void handleBack() { if (web != null) requestMenu(); else finish(); }
    // Legacy Android 8–12 dispatch only. Android 13+ uses the platform callback registered in onCreate.
    @SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { handleBack(); }
    private void showMenu() {
        destroyWeb();
        findViewById(R.id.game_container).setVisibility(View.GONE);
        findViewById(R.id.launcher).setVisibility(View.VISIBLE);
    }
    private void destroyWeb() {
        handler.removeCallbacks(loadTimeout);
        if (web != null) {
            web.stopLoading(); webContainer.removeView(web); web.destroy(); web = null;
        }
        if (errorPanel != null) { webContainer.removeView(errorPanel); errorPanel = null; }
    }
    @Override protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) { outState.putString("gameUrl", web.getUrl() == null ? currentUrl : web.getUrl()); outState.putBoolean("offline", offline); }
    }
    @Override protected void onPause() { if (web != null) { web.onPause(); CookieManager.getInstance().flush(); } super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { destroyWeb(); super.onDestroy(); }
}
