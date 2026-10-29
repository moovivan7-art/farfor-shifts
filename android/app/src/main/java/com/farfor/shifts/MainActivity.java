package com.farfor.shifts;

import android.annotation.SuppressLint;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.app.Activity;
import android.graphics.Color;
import android.hardware.biometrics.BiometricPrompt;
import android.content.Context;

public class MainActivity extends Activity {
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#0B0C0F"));
        w.setNavigationBarColor(Color.parseColor("#121317"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0C0F"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        // мост для отпечатка пальца (Android 9+); на старых — вход по коду
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            web.addJavascriptInterface(new Bridge(), "Android");
        }
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    /** Вход по отпечатку: вызывается из JS, ответ приходит в window.__fpCb */
    private class Bridge {
        @JavascriptInterface
        public void authenticate(final String mode) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        BiometricPrompt prompt = new BiometricPrompt.Builder(MainActivity.this)
                                .setTitle("register".equals(mode) ? "Включить отпечаток" : "Обжиг")
                                .setSubtitle("Коснитесь датчика")
                                .setNegativeButton("Отмена", getMainExecutor(),
                                        (dialog, which) -> sendFp(false))
                                .build();
                        prompt.authenticate(new android.os.CancellationSignal(), getMainExecutor(),
                                new BiometricPrompt.AuthenticationCallback() {
                                    @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) { sendFp(true); }
                                    @Override public void onAuthenticationError(int code, CharSequence msg) { sendFp(false); }
                                    @Override public void onAuthenticationFailed() { /* ждём нормальный отпечаток */ }
                                });
                    } catch (Exception e) {
                        sendFp(false);
                    }
                }
            });
        }
    }

    private void sendFp(final boolean ok) {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                if (web == null) return;
                web.evaluateJavascript("window.__fpCb && window.__fpCb(" + ok + ");", null);
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
