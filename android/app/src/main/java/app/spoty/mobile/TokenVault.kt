package app.spoty.mobile

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class TokenVault(context: Context) {
    fun account(token: String?): Long? = try {
        token?.let { org.json.JSONObject(String(Base64.decode(it.substringBefore('.'), Base64.URL_SAFE or Base64.NO_WRAP), Charsets.UTF_8)).getLong("tg_id") }
    } catch (_: Exception) { null }
    private val preferences = context.getSharedPreferences("session", Context.MODE_PRIVATE)
    @Synchronized private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey("spoty-session", null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("spoty-session", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Synchronized fun get(): String? = try {
        preferences.getString("encrypted", null)?.let {
            val parts = it.split(':')
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
            String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8)
        }
    } catch (_: Exception) { clear(); null }
    @Synchronized fun set(token: String) {
        require(token.length in 20..2048 && token.matches(Regex("[A-Za-z0-9_.-]+")))
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val value = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" +
            Base64.encodeToString(cipher.doFinal(token.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
        check(preferences.edit().putString("encrypted", value).commit())
    }
    @Synchronized fun clear() { preferences.edit().clear().commit() }
}
