package ir.guilan.samad

import android.app.Activity
import android.os.Bundle
import android.webkit.*
import android.view.View
import android.widget.*
import android.graphics.Color
import android.content.Context

class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var status: TextView
    private lateinit var interval: EditText
    private lateinit var prefs: android.content.SharedPreferences
    private var pendingJs = ""

    inner class Bridge {
        @JavascriptInterface fun report(text: String) { runOnUiThread { status.text = text } }
        @JavascriptInterface fun saveLock(value: String) { prefs.edit().putString("lock", value).apply() }
        @JavascriptInterface fun getLock(): String = prefs.getString("lock", "") ?: ""
        @JavascriptInterface fun clearLock() { prefs.edit().remove("lock").apply() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("samad_roo", Context.MODE_PRIVATE)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(245,247,248)) }
        val header = TextView(this).apply {
            text = "رزرویار سلف گیلان"; textSize = 20f; setTextColor(Color.rgb(20,55,48))
            setPadding(16,14,16,10)
        }
        root.addView(header)
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(8,4,8,4) }
        fun button(label: String, action: () -> Unit) {
            val b = Button(this).apply { text = label; isAllCaps = false; setOnClickListener { action() } }
            bar.addView(b, LinearLayout.LayoutParams(0, -2, 1f))
        }
        button("اسکن غذاها") { runJs("window.SAMAD_APP && SAMAD_APP.scan()") }
        button("شروع پایش") { 
            val ms = interval.text.toString().toLongOrNull()?.coerceAtLeast(3000) ?: 3000
            interval.setText(ms.toString()); runJs("window.SAMAD_APP && SAMAD_APP.start($ms)")
        }
        button("توقف") { runJs("window.SAMAD_APP && SAMAD_APP.stop()") }
        root.addView(bar)
        val config = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(12,0,12,6) }
        config.addView(TextView(this).apply { text = "فاصله رفرش (ms): "; setTextColor(Color.DKGRAY); gravity = android.view.Gravity.CENTER_VERTICAL })
        interval = EditText(this).apply { setText("5000"); inputType = 2; singleLine = true }
        config.addView(interval, LinearLayout.LayoutParams(150, -2))
        val clear = Button(this).apply {
            text = "پاک‌کردن قفل"; isAllCaps = false
            setOnClickListener {
                if (android.app.AlertDialog.Builder(this@MainActivity).setMessage("فقط پس از بررسی نتیجه رزرو، قفل را پاک کنید. ادامه می‌دهید؟")
                    .setNegativeButton("انصراف", null).setPositiveButton("پاک شود") { _, _ ->
                        prefs.edit().remove("lock").apply(); runJs("window.SAMAD_APP && SAMAD_APP.clearLock()")
                    }.show().isShowing) {}
            }
        }
        config.addView(clear)
        root.addView(config)
        status = TextView(this).apply { text = "برای شروع، وارد حساب سلف شوید و صفحه منوی غذا را باز کنید."; setTextColor(Color.DKGRAY); setPadding(12,8,12,8) }
        root.addView(status)
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            addJavascriptInterface(Bridge(), "SamadBridge")
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    if (url.startsWith("https://") && (url.contains("guilan.ac.ir"))) inject()
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val u = request.url
                    return !(u.scheme == "https" && (u.host == "guilan.ac.ir" || (u.host?.endsWith(".guilan.ac.ir") == true)))
                }
            }
            loadUrl("https://food.guilan.ac.ir/")
        }
        root.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
    }
    private fun runJs(code: String) { if (::web.isInitialized) web.evaluateJavascript(code, null) }
    private fun inject() {
        val js = assets.open("samad.js").bufferedReader().use { it.readText() }
        web.evaluateJavascript(js, null)
    }
    override fun onBackPressed() { if (::web.isInitialized && web.canGoBack()) web.goBack() else super.onBackPressed() }
}
