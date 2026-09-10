package com.nightwave.app

import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var loadingContainer: LinearLayout
    private lateinit var serverConfigPanel: LinearLayout
    private lateinit var serverUrlInput: EditText
    private lateinit var connectButton: Button
    private var retryIndex = 0
    private val retryUrls = mutableListOf<String>()
    private val timeoutHandler = Handler(Looper.getMainLooper())
    private val timeoutRunnable = Runnable { showOfflineMessage() }
    private val defaultServerUrl = "https://musica.seudominio.com"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

        loadingContainer = findViewById(R.id.loadingContainer)
        serverConfigPanel = findViewById(R.id.serverConfigPanel)
        serverUrlInput = findViewById(R.id.serverUrlInput)
        connectButton = findViewById(R.id.connectButton)
        webView = findViewById(R.id.webView)
        webView.setBackgroundColor(Color.parseColor("#0b0d12"))

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.webViewClient = object : WebViewClient() {
           override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
               if (url == null) return false
               return !(url.startsWith("http://") || url.startsWith("https://"))
            }

           override fun onPageFinished(view: WebView?, url: String?) {
               timeoutHandler.removeCallbacks(timeoutRunnable)
               loadingContainer.visibility = View.GONE
           }

           override fun onReceivedError(view: WebView?, request: android.webkit.WebResourceRequest?, error: android.webkit.WebResourceError?) {
               retryNextUrl()
           }

           override fun onReceivedHttpError(
               view: WebView?,
               request: android.webkit.WebResourceRequest?,
               errorResponse: android.webkit.WebResourceResponse?
           ) {
               retryNextUrl()
           }
        }
        webView.webChromeClient = WebChromeClient()
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        connectButton.setOnClickListener {
           val customUrl = serverUrlInput.text?.toString()?.trim()
           if (!customUrl.isNullOrBlank()) {
               retryUrls.clear()
               retryUrls.add(normalizeUrl(customUrl))
               retryIndex = 0
               serverConfigPanel.visibility = View.GONE
               loadingContainer.visibility = View.VISIBLE
               tryLoadNextUrl()
           }
        }

        serverConfigPanel.visibility = View.GONE
        val explicitUrl = intent.getStringExtra("SERVER_URL")
        retryUrls.clear()
        if (!explicitUrl.isNullOrBlank()) {
           retryUrls.add(normalizeUrl(explicitUrl))
        }
        retryUrls.add(defaultServerUrl)
        retryUrls.add("https://www.${defaultServerUrl.removePrefix("https://")}/")

        serverUrlInput.setText(retryUrls.firstOrNull() ?: defaultServerUrl)
        tryLoadNextUrl()
    }

    private fun normalizeUrl(rawUrl: String): String {
        val sanitized = rawUrl.trim()
        return if (sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
           if (sanitized.endsWith("/")) sanitized else "$sanitized/"
        } else {
           "http://$sanitized/"
        }
    }

    private fun tryLoadNextUrl() {
        if (retryIndex >= retryUrls.size) {
           showOfflineMessage()
           return
        }

        timeoutHandler.removeCallbacks(timeoutRunnable)
        timeoutHandler.postDelayed(timeoutRunnable, 14000)
        val url = retryUrls[retryIndex]
        retryIndex += 1
        serverUrlInput.setText(url)
        webView.loadUrl(url)
    }

    private fun retryNextUrl() {
        tryLoadNextUrl()
    }

    private fun showOfflineMessage() {
        timeoutHandler.removeCallbacks(timeoutRunnable)
        loadingContainer.visibility = View.GONE
        serverConfigPanel.visibility = View.GONE
        val html = """
            <html><head>
                <meta charset="UTF-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <style>
                    body{margin:0;background:radial-gradient(circle at top,#1e172d 0%,#0b0d12 45%,#090b11 100%);color:#f3f4f6;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px;}
                    .box{max-width:420px;padding:28px 22px;border-radius:22px;background:rgba(20,25,35,0.96);border:1px solid rgba(183,148,244,0.35);box-shadow:0 16px 40px rgba(0,0,0,.45)}
                    .logo{width:78px;height:78px;border-radius:20px;margin:0 auto 18px;background:linear-gradient(135deg,#b794f4,#7c3aed);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:28px}
                    h1{font-size:24px;margin:0 0 10px;color:#f3f4f6}
                    p{margin:8px 0;color:#d6d9df;line-height:1.5;font-size:15px}
                    .accent{color:#b794f4;font-weight:700}
                </style>
            </head><body>
                <div class='box'>
                    <div class='logo'>N</div>
                    <h1>NightWave</h1>
                    <p class='accent'>Servidor offline</p>
                    <p>O app abriu normalmente, mas ainda não conseguiu conectar ao servidor.</p>
                    <p>Quando o backend estiver online, o app tenta conectar automaticamente.</p>
                </div>
            </body></html>
        """.trimIndent()
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
           webView.goBack()
        } else {
           super.onBackPressed()
        }
    }

    override fun onDestroy() {
        timeoutHandler.removeCallbacks(timeoutRunnable)
        super.onDestroy()
    }
}
