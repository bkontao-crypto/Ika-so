package com.ikaso.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.view.View
import android.webkit.*
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.materialswitch.MaterialSwitch
import com.google.android.material.snackbar.Snackbar
import com.ikaso.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var ui: ActivityMainBinding
    val web: WebView get() = ui.web
    private val handler = Handler(Looper.getMainLooper())
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermissionRequest: PermissionRequest? = null
    private var pendingGeo: Pair<String, GeolocationPermissions.Callback>? = null
    private var lastBackPress = 0L
    private var failed = false
    private var netCallback: ConnectivityManager.NetworkCallback? = null
    private var backgroundedAt = 0L
    private var locked = false
    private var keepPage = false                  // lien reçu (paiement, partage) : ne pas renvoyer à l'accueil
    @Volatile var refreshBlocked = false          // renseigné par le site au toucher (voir INJECT_JS)
    private val host: String = BuildConfig.SITE_HOST

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data)); fileCallback = null
    }
    private val cameraPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        pendingPermissionRequest?.let { if (ok) it.grant(it.resources) else it.deny() }; pendingPermissionRequest = null
    }
    private val locPermission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        pendingGeo?.let { (o, cb) -> cb.invoke(o, r.values.any { it }, false) }; pendingGeo = null
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        ui = ActivityMainBinding.inflate(layoutInflater)
        setContentView(ui.root)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        ViewCompat.setOnApplyWindowInsetsListener(ui.root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom)); WindowInsetsCompat.CONSUMED
        }
        WindowCompat.getInsetsController(window, ui.root).apply { isAppearanceLightNavigationBars = true; isAppearanceLightStatusBars = true }

        with(ui.web.settings) {
            javaScriptEnabled = true; domStorageEnabled = true; databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true; loadWithOverviewMode = false
            setSupportZoom(true); builtInZoomControls = true; displayZoomControls = false
            textZoom = 100
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false; allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)      // target="_blank" (WhatsApp…) intercepté dans onCreateWindow
            userAgentString = "$userAgentString IkaSoApp/${BuildConfig.VERSION_NAME}"
        }
        ui.web.setBackgroundColor(ContextCompat.getColor(this, R.color.surface))
        CookieManager.getInstance().apply { setAcceptCookie(true); setAcceptThirdPartyCookies(ui.web, false) }   // session du site = cookie
        ui.web.addJavascriptInterface(AppBridge(this), "AndroidBridge")

        ui.web.webViewClient = object : WebViewClient() {
            override fun onPageStarted(v: WebView, url: String, favicon: Bitmap?) {
                failed = false; ui.progress.visibility = View.VISIBLE
                v.scrollTo(0, 0)      // l'accueil s'affiche toujours en haut (jamais une position de défilement restaurée)
                handler.removeCallbacks(wakingHint); handler.postDelayed(wakingHint, 8000)
            }
            override fun onPageFinished(v: WebView, url: String) {
                handler.removeCallbacks(wakingHint); ui.waking.visibility = View.GONE
                ui.progress.visibility = View.GONE; ui.swipe.isRefreshing = false
                if (!failed) { ui.offline.visibility = View.GONE; v.evaluateJavascript(INJECT_JS, null) }
                CookieManager.getInstance().flush()
            }
            override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
                val u = req.url
                // Connexion Google : Google refuse les WebViews. Elle se fait dans le navigateur du téléphone, puis revient ici par ticket.
                if (u.scheme == "https" && u.host == host && u.path == "/api/auth/google") {
                    openInBrowser(u.buildUpon().appendQueryParameter("app", "1").build()); return true
                }
                if (u.scheme == "https" && u.host == host) return false
                openExternal(u); return true          // WhatsApp, appel, e-mail, page de paiement, autres sites
            }
            override fun onPageCommitVisible(v: WebView, url: String) { v.scrollTo(0, 0) }   // la page s'affiche toujours en haut, y compris après « tirer pour actualiser »
            override fun onReceivedError(v: WebView, req: WebResourceRequest, err: WebResourceError) {
                if (req.isForMainFrame) { failed = true; ui.offline.visibility = View.VISIBLE }
            }
            override fun onReceivedHttpError(v: WebView, req: WebResourceRequest, resp: WebResourceResponse) {
                if (req.isForMainFrame && resp.statusCode >= 500) { failed = true; ui.offline.visibility = View.VISIBLE }
            }
            override fun onRenderProcessGone(v: WebView, detail: RenderProcessGoneDetail): Boolean { v.reload(); return true }
        }
        ui.web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(v: WebView, p: Int) { ui.progress.setProgressCompat(p, true) }
            // Photos des annonces, pièces justificatives…
            override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null); fileCallback = cb
                return try { filePicker.launch(p.createIntent()); true } catch (e: ActivityNotFoundException) { fileCallback = null; false }
            }
            // Géolocalisation (« près de moi », carte) : uniquement pour le site de l'application
            override fun onGeolocationPermissionsShowPrompt(origin: String, cb: GeolocationPermissions.Callback) {
                val granted = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                when {
                    Uri.parse(origin).host != host -> cb.invoke(origin, false, false)
                    granted -> cb.invoke(origin, true, false)
                    else -> { pendingGeo = origin to cb; locPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }
                }
            }
            override fun onPermissionRequest(req: PermissionRequest) {
                if (req.origin.host == host && req.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                    pendingPermissionRequest = req; cameraPermission.launch(Manifest.permission.CAMERA)
                } else req.deny()
            }
            // target="_blank" : même site → dans l'application (avec la session) ; sinon application externe (WhatsApp, e-mail…)
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                val temp = WebView(view.context)
                temp.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                        if (r.url.scheme == "https" && r.url.host == host) view.loadUrl(r.url.toString()) else openExternal(r.url)
                        v.destroy(); return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = temp; resultMsg.sendToTarget(); return true
            }
        }
        ui.web.setDownloadListener { url, ua, disposition, mime, _ -> download(url, ua, disposition, mime) }

        ui.swipe.setColorSchemeResources(R.color.brand)
        ui.swipe.setOnRefreshListener {
            // garde-fou : si des données saisies ne sont pas enregistrées, demander avant de recharger la page
            ui.web.evaluateJavascript(DIRTY_JS) { r ->
                if (r == "true") {
                    ui.swipe.isRefreshing = false
                    MaterialAlertDialogBuilder(this).setTitle("Actualiser la page ?").setMessage("Les données saisies et non enregistrées seront perdues.")
                        .setPositiveButton("Actualiser") { _, _ -> ui.web.reload() }.setNegativeButton("Annuler", null).show()
                } else ui.web.reload()
            }
        }
        ui.swipe.setOnChildScrollUpCallback { _, _ -> ui.web.scrollY > 0 || refreshBlocked }
        ui.retry.setOnClickListener { ui.offline.visibility = View.GONE; failed = false; ui.web.loadUrl(BuildConfig.BASE_URL) }
        ui.unlock.setOnClickListener { promptUnlock() }
        ui.quit.setOnClickListener { finishAffinity() }

        netCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(n: Network) { if (failed) runOnUiThread { ui.retry.performClick() } }
        }
        (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).registerDefaultNetworkCallback(netCallback!!)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (locked) { finishAffinity(); return }
                if (ui.web.canGoBack()) ui.web.goBack()
                else {
                    val now = System.currentTimeMillis()
                    if (now - lastBackPress < 2000) finish() else { lastBackPress = now; toast(getString(R.string.press_again)) }
                }
            }
        })

        val start = loginUrl(intent?.data) ?: intent?.data?.takeIf { it.host == host }?.toString() ?: BuildConfig.BASE_URL
        // Mémoire de 30 secondes : au-delà, l'application s'ouvre sur l'accueil (jamais sur une ancienne page ou position).
        val away = savedInstanceState?.getLong("bg", 0L)?.takeIf { it > 0 }?.let { System.currentTimeMillis() - it } ?: 0L
        if (savedInstanceState == null || away > MEMORY_MS) ui.web.loadUrl(start) else ui.web.restoreState(savedInstanceState)
        if (intent?.action == ACTION_SETTINGS) ui.web.post { showSettings() }
        lockIfNeeded()
    }

    private val wakingHint = Runnable { ui.waking.visibility = View.VISIBLE }

    // ---------- Verrouillage empreinte / code ----------
    private fun lockIfNeeded() {
        if (!Prefs.lockEnabled(this) || locked) return
        val can = BiometricManager.from(this).canAuthenticate(BIOMETRIC_WEAK or DEVICE_CREDENTIAL)
        if (can != BiometricManager.BIOMETRIC_SUCCESS) return      // aucun verrouillage d'écran sur le téléphone : rien à demander
        locked = true; ui.lock.visibility = View.VISIBLE; promptUnlock()
    }
    private fun promptUnlock() {
        val info = BiometricPrompt.PromptInfo.Builder().setTitle(getString(R.string.app_name)).setSubtitle("Déverrouillez pour continuer")
            .setAllowedAuthenticators(BIOMETRIC_WEAK or DEVICE_CREDENTIAL).build()
        BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { locked = false; ui.lock.visibility = View.GONE }
        }).authenticate(info)
    }
    override fun onStop() { backgroundedAt = System.currentTimeMillis(); super.onStop() }
    override fun onStart() {
        super.onStart()
        val away = if (backgroundedAt > 0) System.currentTimeMillis() - backgroundedAt else 0L
        if (away > MEMORY_MS && !keepPage) { ui.web.loadUrl(BuildConfig.BASE_URL); ui.web.scrollTo(0, 0) }   // retour après plus de 30 s : accueil
        keepPage = false
        if (away > 60_000) lockIfNeeded()   // reverrouillage après 1 min en arrière-plan   // reverrouillage après 1 min en arrière-plan
    }

    // ---------- Réglages natifs (appui long sur l'icône ▸ Réglages de l'application) ----------
    fun showSettings() {
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(48, 24, 48, 0) }
        col.addView(MaterialSwitch(this).apply { text = "Verrouillage empreinte / code"; isChecked = Prefs.lockEnabled(this@MainActivity); setOnCheckedChangeListener { _, v -> Prefs.setLock(this@MainActivity, v) } })
        MaterialAlertDialogBuilder(this).setTitle(R.string.settings).setView(col).setPositiveButton("Fermer", null).show()
    }

    // ---------- Divers ----------
    fun toast(msg: String) = runOnUiThread { Toast.makeText(this, msg, Toast.LENGTH_LONG).show() }
    /** ikaso://login?ticket=… (renvoyé par le site après la connexion Google) → échange du ticket dans la WebView. */
    private fun loginUrl(uri: Uri?): String? {
        if (uri?.scheme != "ikaso" || uri.host != "login") return null
        val ticket = uri.getQueryParameter("ticket")?.takeIf { it.isNotBlank() && it.length < 200 } ?: return null
        return BuildConfig.BASE_URL + "api/auth/app-handoff?ticket=" + Uri.encode(ticket)
    }

    /** Ouvre le site dans le navigateur par défaut, sans passer par cette application (sinon la boucle reviendrait ici). */
    private fun openInBrowser(uri: Uri) {
        val probe = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com"))
        val browser = packageManager.resolveActivity(probe, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
        if (browser == null || browser == packageName) { openExternal(uri); return }
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE).setPackage(browser))
        } catch (e: ActivityNotFoundException) { toast("Aucun navigateur installé pour la connexion Google") }
    }

    fun openExternal(uri: Uri) {
        try {
            val u = if (uri.scheme == "intent") Uri.parse(Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME).dataString) else uri
            startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) { toast("Application introuvable (WhatsApp installé ?)") }
        catch (e: Exception) { toast("Impossible d'ouvrir ce lien") }
    }
    private fun download(url: String, ua: String?, disposition: String?, mime: String?) {
        if (url.startsWith("blob:") || !url.startsWith("https")) return   // les blob: passent par AndroidBridge.saveAndOpen (voir INJECT_JS)
        val name = URLUtil.guessFileName(url, disposition, mime)
        val req = DownloadManager.Request(Uri.parse(url)).apply {
            setMimeType(mime); addRequestHeader("User-Agent", ua)
            CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "IKA SO/$name")
        }
        (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
        Snackbar.make(ui.root, R.string.file_saved, Snackbar.LENGTH_SHORT).show()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.action == ACTION_SETTINGS) ui.web.post { showSettings() }
        loginUrl(intent.data)?.let { keepPage = true; ui.web.loadUrl(it) }   // retour de la connexion Google (ticket)
        intent.data?.takeIf { it.host == host }?.let { keepPage = true; ui.web.loadUrl(it.toString()) }     // retour de paiement, liens partagés
    }
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); ui.web.saveState(outState); outState.putLong("bg", backgroundedAt) }
    override fun onPause() { ui.web.onPause(); CookieManager.getInstance().flush(); super.onPause() }
    override fun onResume() { super.onResume(); ui.web.onResume() }
    override fun onDestroy() {
        netCallback?.let { (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).unregisterNetworkCallback(it) }
        ui.web.apply { stopLoading(); destroy() }; super.onDestroy()
    }

    companion object {
        const val MEMORY_MS = 30_000L
        const val ACTION_SETTINGS = "com.ikaso.app.OPEN_SETTINGS"
        /** Vrai si un champ de saisie a été modifié depuis le chargement (données non enregistrées). */
        private const val DIRTY_JS = """
        (function(){var n=document.querySelectorAll('input:not([type=hidden]):not([type=file]),textarea,select');
          for(var i=0;i<n.length;i++){var e=n[i];
            if(e.tagName==='SELECT'){for(var j=0;j<e.options.length;j++){if(e.options[j].selected!==e.options[j].defaultSelected)return true}}
            else if(e.type==='checkbox'||e.type==='radio'){if(e.checked!==e.defaultChecked)return true}
            else if(e.value!==e.defaultValue)return true}
          return false})()"""
        /** Injecté après chaque chargement : zoom autorisé, images/tableaux contenus, et trois fonctions absentes de la WebView
         *  (impression, partage, ouverture de fichiers blob:) branchées sur Android. */
        private const val INJECT_JS = """
        (function(){
          if(window.__ikaInjected)return;window.__ikaInjected=true;
          var m=document.querySelector('meta[name=viewport]');
          if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m)}
          m.content='width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover';
          var s=document.createElement('style');
          s.textContent='html{-webkit-text-size-adjust:100%;overscroll-behavior-y:contain}*{-webkit-tap-highlight-color:transparent}img,video{max-width:100%}table{max-width:100%}';
          document.head.appendChild(s);
          /* anti-actualisation accidentelle : pas de « tirer pour actualiser » dans un formulaire, un champ actif ou une zone déjà défilée */
          document.addEventListener('touchstart',function(e){var b=false;try{
            var m=document.getElementById('m');if(m&&m.innerHTML&&getComputedStyle(m).display!=='none')b=true;
            var a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)${'$'}/.test(a.tagName))b=true;
            for(var el=e.target;el&&el!==document.body&&!b;el=el.parentElement){if(el.scrollTop>0)b=true}
          }catch(x){}try{AndroidBridge.refreshBlocked(b)}catch(x){}},{capture:true,passive:true});
          window.print=function(){try{AndroidBridge.print(document.title||'Document')}catch(e){}};
          if(!navigator.share)navigator.share=function(d){try{AndroidBridge.shareText((d&&d.title)||'',(d&&d.text)||'',(d&&d.url)||'');return Promise.resolve()}catch(e){return Promise.reject(e)}};
          var wo=window.open;
          window.open=function(u,n,f){
            if(typeof u==='string'&&u.indexOf('blob:')===0){
              fetch(u).then(function(r){return r.blob()}).then(function(b){var fr=new FileReader();fr.onload=function(){
                var t=String(fr.result),i=t.indexOf(',');var ext=(b.type.split('/')[1]||'bin').split(';')[0].replace('jpeg','jpg');
                AndroidBridge.saveAndOpen('document.'+ext,b.type||'application/octet-stream',t.slice(i+1));};fr.readAsDataURL(b)});
              return null;
            }
            return wo.call(window,u,n,f);
          };
        })();"""
    }
}
