package kr.walkerkein.futsal;

import android.Manifest;
import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * G풋살 안드로이드 앱.
 * - GitHub Pages의 웹앱을 그대로 띄움(고치면 앱도 자동으로 최신). 인터넷이 없으면 앱 안에 넣어 둔 사본을 띄움.
 * - 타이머가 작동 중일 때만: 다른 앱으로 가면 자동으로 '화면 속 화면(작은 창)', 화면이 꺼져도 소리 유지(진행 중 알림).
 *   웹앱이 window.FutsalApp.setRunning(true/false)로 작동 여부를 알려 줌.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://walkerkein.github.io/futsal/app/";
    static final String OFFLINE = "file:///android_asset/app/index.html";
    static final String HOST = "walkerkein.github.io";

    private WebView web;
    private volatile boolean running = false;
    private boolean usedOffline = false;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);

        // 상단 상태 표시줄·하단 내비게이션 바·키보드에 화면이 가리지 않도록 그만큼 안쪽으로 띄움
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((View v, WindowInsets ins) -> {
                android.graphics.Insets i = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(i.left, i.top, i.right, i.bottom);
                return WindowInsets.CONSUMED;
            });
        } else {
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.addJavascriptInterface(new Bridge(), "FutsalApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String scheme = u.getScheme();
                if ("file".equals(scheme) || HOST.equals(u.getHost())) return false;   // 앱 안에서 열기
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}  // 그 밖의 링크는 브라우저로
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                // 경기장에서 인터넷이 안 될 때: 앱 안의 사본으로
                if (req.isForMainFrame() && !usedOffline) { usedOffline = true; view.loadUrl(OFFLINE); }
            }
        });

        if (saved != null) web.restoreState(saved); else web.loadUrl(HOME);

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    /** 웹앱에서 부르는 기능 */
    private class Bridge {
        @JavascriptInterface
        public void setRunning(boolean on) {
            runOnUiThread(() -> {
                running = on;
                if (on) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    Intent i = new Intent(MainActivity.this, TimerService.class);
                    if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    stopService(new Intent(MainActivity.this, TimerService.class));
                }
                updatePip();
            });
        }

        @JavascriptInterface
        public void enterPip() { runOnUiThread(MainActivity.this::goPip); }

        /** 설치된 앱의 빌드 번호(업데이트 안내용) */
        @JavascriptInterface
        public int version() {
            try {
                android.content.pm.PackageInfo p = getPackageManager().getPackageInfo(getPackageName(), 0);
                return Build.VERSION.SDK_INT >= 28 ? (int) p.getLongVersionCode() : p.versionCode;
            } catch (Exception e) { return 0; }
        }
    }

    private PictureInPictureParams pipParams() {
        PictureInPictureParams.Builder b = new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 10));
        if (Build.VERSION.SDK_INT >= 31) b.setAutoEnterEnabled(running).setSeamlessResizeEnabled(true);
        return b.build();
    }

    /** 안드로이드 12 이상: 타이머 작동 중이면 홈 버튼·다른 앱 전환 시 자동으로 작은 창 */
    private void updatePip() {
        if (Build.VERSION.SDK_INT >= 26) {
            try { setPictureInPictureParams(pipParams()); } catch (Exception ignored) {}
        }
    }

    private void goPip() {
        if (Build.VERSION.SDK_INT >= 26) {
            try { enterPictureInPictureMode(pipParams()); } catch (Exception ignored) {}
        }
    }

    /** 안드로이드 8~11: 홈 버튼을 누르는 순간 작은 창으로 */
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (running && Build.VERSION.SDK_INT >= 26 && Build.VERSION.SDK_INT < 31) goPip();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, Configuration cfg) {
        super.onPictureInPictureModeChanged(inPip, cfg);
        // 작은 창에서는 웹앱이 화면 크기를 보고 '단계 + 경과 시간 + 경기 남은 시간'만 보여 줌
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    // 다른 앱으로 가도 웹앱(타이머·소리)이 멈추지 않도록 WebView를 일시정지하지 않음

    @Override
    protected void onDestroy() {
        stopService(new Intent(this, TimerService.class));
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
