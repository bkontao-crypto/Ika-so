package com.ikaso.app

import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.print.PrintManager
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import java.io.File

/** Pont JavaScript exposé au site sous le nom « AndroidBridge » (utilisé par les compléments injectés dans MainActivity). */
class AppBridge(private val a: MainActivity) {

    /** Enregistre le fichier dans Téléchargements/IKA SO puis propose de l'ouvrir. */
    @JavascriptInterface
    fun saveAndOpen(fileName: String, mime: String, base64: String) {
        try {
            val safe = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "fichier" }
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val type = if (mime.isBlank()) "application/octet-stream" else mime.substringBefore(';')
            val file = File(File(a.cacheDir, "exports").apply { mkdirs() }, safe).apply { writeBytes(bytes) }
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, safe); put(MediaStore.Downloads.MIME_TYPE, type)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/IKA SO")
            }
            a.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)?.let { u -> a.contentResolver.openOutputStream(u)?.use { it.write(bytes) } }
            val uri = FileProvider.getUriForFile(a, "${a.packageName}.fileprovider", file)
            val view = Intent(Intent.ACTION_VIEW).setDataAndType(uri, type).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            a.runOnUiThread {
                try { a.startActivity(Intent.createChooser(view, "Ouvrir avec").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                catch (e: ActivityNotFoundException) { a.toast("Fichier enregistré dans Téléchargements/IKA SO") }
            }
        } catch (e: Exception) { a.toast("Enregistrement impossible : ${e.message}") }
    }

    /** navigator.share (texte / lien) → feuille de partage Android (WhatsApp, SMS, e-mail…). */
    @JavascriptInterface
    fun shareText(title: String, text: String, url: String) = a.runOnUiThread {
        val body = listOf(text, url).filter { it.isNotBlank() }.joinToString("\n")
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, body)
        if (title.isNotBlank()) send.putExtra(Intent.EXTRA_SUBJECT, title)
        a.startActivity(Intent.createChooser(send, "Partager").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    @JavascriptInterface
    fun openExternal(url: String) = a.runOnUiThread { a.openExternal(Uri.parse(url)) }

    /** window.print() : fenêtre d'impression / « Enregistrer en PDF » d'Android. */
    @JavascriptInterface
    fun print(title: String) = a.runOnUiThread {
        (a.getSystemService(Context.PRINT_SERVICE) as PrintManager).print(title, a.web.createPrintDocumentAdapter(title), null)
    }

    /** Le site indique si un geste vers le bas ne doit PAS déclencher « tirer pour actualiser ». */
    @JavascriptInterface fun refreshBlocked(blocked: Boolean) { a.refreshBlocked = blocked }
    @JavascriptInterface fun isNativeApp(): Boolean = true
}
