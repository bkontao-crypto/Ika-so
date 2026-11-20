package com.ikaso.app

import android.app.Activity
import android.webkit.CookieManager
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Connexion Google dans l'application : sélecteur de compte Android (sans navigateur).
 * Le jeton Google est vérifié par le serveur (POST /api/auth/google/native), qui renvoie le cookie de session.
 */
object NativeGoogleSignIn {
    const val CANCELLED = "annule"

    private class Exchange(val error: String?, val cookies: List<String>)

    /** null = connecté (session posée dans la WebView) ; CANCELLED = annulé ; sinon message à afficher. */
    suspend fun signIn(activity: Activity, terms: Boolean, dataConsent: String = "essential"): String? {
        val clientId = BuildConfig.GOOGLE_WEB_CLIENT_ID
        if (clientId.isBlank()) return "Connexion Google non configurée dans cette version de l'application."
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(GetSignInWithGoogleOption.Builder(clientId).build())
            .build()
        val idToken = try {
            val result = CredentialManager.create(activity).getCredential(activity, request)
            GoogleIdTokenCredential.createFrom(result.credential.data).idToken
        } catch (e: GetCredentialCancellationException) {
            return CANCELLED
        } catch (e: GetCredentialException) {
            return "Aucun compte Google utilisable sur ce téléphone."
        } catch (e: GoogleIdTokenParsingException) {
            return "La connexion Google a échoué. Réessayez."
        }
        val result = withContext(Dispatchers.IO) { exchange(idToken, terms, dataConsent) }
        if (result.error == null) {
            // Retour sur le thread principal : c'est là que la session est posée dans la WebView.
            val cookies = CookieManager.getInstance()
            result.cookies.forEach { cookies.setCookie(BuildConfig.BASE_URL, it) }
            cookies.flush()
        }
        return result.error
    }

    private fun exchange(idToken: String, terms: Boolean, dataConsent: String): Exchange {
        val conn = URL(BuildConfig.BASE_URL + "api/auth/google/native").openConnection() as HttpURLConnection
        return try {
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.connectTimeout = 15_000
            conn.readTimeout = 15_000
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")
            val body = JSONObject().put("idToken", idToken).put("terms", terms).put("dataConsent", dataConsent).toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = conn.responseCode
            if (status in 200..299) {
                val cookies = conn.headerFields
                    .filterKeys { it?.equals("Set-Cookie", ignoreCase = true) == true }
                    .values.flatten()
                Exchange(null, cookies)
            } else {
                val text = conn.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                val message = runCatching { JSONObject(text).optString("error") }.getOrNull()
                Exchange(message?.takeIf { it.isNotBlank() } ?: "La connexion Google a échoué. Réessayez.", emptyList())
            }
        } catch (e: Exception) {
            Exchange("Connexion impossible. Vérifiez votre réseau.", emptyList())
        } finally {
            conn.disconnect()
        }
    }
}
