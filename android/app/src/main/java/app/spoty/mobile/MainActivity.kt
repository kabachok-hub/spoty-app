package app.spoty.mobile

import android.Manifest
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.view.WindowInsets
import android.widget.FrameLayout
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executor

@UnstableApi
class MainActivity : ComponentActivity() {
    private val updater by lazy { AppUpdater(this) }
    private lateinit var web: WebView
    private var connection: ListenableFuture<MediaController>? = null
    private var stream: JavaScriptReplyProxy? = null
    private var files: ValueCallback<Array<Uri>>? = null
    private var alive = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("!window.dispatchEvent(new Event('spoty-back',{cancelable:true}))") { handled ->
                    if (handled != "true") moveTaskToBack(true)
                }
            }
        })
        web = WebView(this)
        web.setBackgroundColor(Color.rgb(18, 18, 18))
        web.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true
            allowFileAccess = false; allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // React's background videos are muted; music remains owned by Media3 and starts paused.
            mediaPlaybackRequiresUserGesture = false
            setSupportMultipleWindows(false)
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val container = FrameLayout(this).apply { setBackgroundColor(Color.rgb(18, 18, 18)) }
        container.setOnApplyWindowInsetsListener { view, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val safe = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            } else {
                @Suppress("DEPRECATION")
                view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            insets
        }
        val assets = WebViewAssetLoader.Builder().addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        web.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                if (request.url.host == "appassets.androidplatform.net" &&
                    (request.url.path?.startsWith("/uploads/") == true || request.url.path?.startsWith("/videos/") == true)) {
                    return try {
                        val remote = URL(BuildConfig.SERVER_ORIGIN + request.url.encodedPath).openConnection() as HttpURLConnection
                        remote.connectTimeout = 10000; remote.readTimeout = 15000; remote.instanceFollowRedirects = false
                        request.requestHeaders.entries.firstOrNull { it.key.equals("Range", true) }?.value?.let { remote.setRequestProperty("Range", it) }
                        val status = remote.responseCode
                        if (status !in 200..299) { remote.disconnect(); throw IllegalStateException() }
                        val mime = remote.contentType?.substringBefore(';') ?: "application/octet-stream"
                        val headers = mutableMapOf<String, String>()
                        for (key in listOf("Content-Length", "Content-Range", "Accept-Ranges", "Cache-Control", "ETag")) remote.getHeaderField(key)?.let { headers[key] = it }
                        val input = object : java.io.FilterInputStream(remote.inputStream) {
                            override fun close() { try { super.close() } finally { remote.disconnect() } }
                        }
                        WebResourceResponse(mime, null, status, if (status == 206) "Partial Content" else "OK", headers, input)
                    } catch (_: Exception) { WebResourceResponse("text/plain", "UTF-8", 404, "Not found", emptyMap(), "".byteInputStream()) }
                }
                return assets.shouldInterceptRequest(request.url)
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.scheme == "https" && request.url.host == "appassets.androidplatform.net")
                    return request.isForMainFrame && request.url.path !in listOf("/", "/index.html")
                if (request.isForMainFrame && request.hasGesture()) openExternal(request.url.toString())
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                files?.onReceiveValue(null); files = callback
                return try { startActivityForResult(params.createIntent(), 7); true }
                catch (_: Exception) { files = null; callback.onReceiveValue(null); false }
            }
        }
        check(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) { "Update Android System WebView" }
        WebViewCompat.addWebMessageListener(web, "SpotyAndroid", setOf("https://appassets.androidplatform.net")) { _, message, source, mainFrame, reply ->
            if (!mainFrame || source.toString().trimEnd('/') != "https://appassets.androidplatform.net") return@addWebMessageListener
            val raw = message.data ?: return@addWebMessageListener
            if (raw.length > 2 * 1024 * 1024) return@addWebMessageListener
            val request = try { JSONObject(raw) } catch (_: Exception) { return@addWebMessageListener }
            fun respond(result: JSONObject? = null, failed: Boolean = false) {
                if (!alive) return
                try { reply.postMessage(JSONObject().put("id", request.optLong("id"))
                    .put("result", result ?: JSONObject()).put("error", failed).toString()) } catch (_: Exception) { /* UI may have closed. */ }
            }
            try {
                val data = request.optJSONObject("data") ?: JSONObject()
                val vault = TokenVault(this)
                when (request.getString("command")) {
                    "updateStart" -> respond(updater.start(data.getString("version")))
                    "updateStatus" -> respond(updater.status())
                    "updateInstall" -> respond(updater.install())
                    "vaultGet" -> respond(JSONObject().put("token", vault.get() ?: JSONObject.NULL))
                    "vaultSet" -> {
                        val previous = vault.get(); val token = data.getString("token")
                        val changed = previous != null && vault.account(previous) != vault.account(token)
                        vault.set(token); if (changed) PlaybackService.instance?.logout()
                        respond(JSONObject().put("accountChanged", changed))
                    }
                    "vaultClear" -> { vault.clear(); PlaybackService.instance?.logout(); respond() }
                    "openExternal" -> { openExternal(data.getString("url")); respond() }
                    "subscribe", "sync" -> {
                        val pending = connection ?: throw IllegalStateException()
                        pending.addListener({
                            if (!alive) return@addListener
                            try {
                                pending.get()
                                val service = PlaybackService.instance ?: throw IllegalStateException()
                                if (request.getString("command") == "subscribe") {
                                    stream = reply
                                    service.observer = { state ->
                                        if (alive) try { stream?.postMessage(JSONObject().put("event", "state").put("state", state).toString()) } catch (_: Exception) { }
                                    }
                                    respond(service.snapshot(true))
                                } else respond(service.sync(data))
                            } catch (_: Exception) { respond(failed = true) }
                        }, Executor { runOnUiThread(it) })
                    }
                    else -> respond(failed = true)
                }
            } catch (_: Exception) { respond(failed = true) }
        }
        connection = MediaController.Builder(this, SessionToken(this, ComponentName(this, PlaybackService::class.java))).buildAsync()
        container.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(container)
        web.loadUrl("https://appassets.androidplatform.net/index.html")
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
    }
    private fun openExternal(value: String) {
        val uri = Uri.parse(value)
        require(uri.scheme == "https" && uri.userInfo == null)
        startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
    }
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 7) { files?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data)); files = null }
    }
    private fun visibility(hidden: Boolean) {
        try { stream?.postMessage(JSONObject().put("event", "visibility").put("hidden", hidden).toString()) } catch (_: Exception) { }
    }
    override fun onPause() { visibility(true); web.onPause(); super.onPause() }
    override fun onResume() { super.onResume(); web.onResume(); visibility(false) }
    override fun onDestroy() {
        alive = false; PlaybackService.instance?.observer = null; stream = null
        connection?.let(MediaController::releaseFuture); connection = null
        files?.onReceiveValue(null); web.destroy(); super.onDestroy()
    }
}
