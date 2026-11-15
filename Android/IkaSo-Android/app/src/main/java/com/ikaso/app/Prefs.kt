package com.ikaso.app

import android.content.Context

/** Réglages locaux de l'application (privés à l'application). */
object Prefs {
    private fun sp(c: Context) = c.getSharedPreferences("ikaso", Context.MODE_PRIVATE)
    fun lockEnabled(c: Context) = sp(c).getBoolean("lock", false)      // désactivé par défaut ; activable dans les réglages
    fun setLock(c: Context, v: Boolean) = sp(c).edit().putBoolean("lock", v).apply()
}
