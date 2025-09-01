/*
Copyright 2024 Suredesigns Corp.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package com.suredesigns.alier

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.RequiresApi
import androidx.core.net.toUri
import androidx.webkit.WebViewAssetLoader
import com.suredesigns.alier.extensions.updateResponseHeader

abstract class _Coordinator(
    activity: Activity,
    assetLoader: WebViewAssetLoader,
    appScheme: String,
    appDomain: String
): WebViewClient() {
    private val _activity = activity
    private val _asset_loader = assetLoader
    private val _app_scheme = appScheme
    private val _app_domain = appDomain
    private val _custom_scheme_used = !Regex("""http(s)""", RegexOption.IGNORE_CASE).matches(appScheme)
    private val _app_origin = if (_custom_scheme_used) {
        "$appScheme://"
    } else {
        "$appScheme://$appDomain"
    }

    // Called when the page starts loading.
    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
    }

    // Function to start other applications
    @SuppressLint("QueryPermissionsNeeded")
    fun launchOtherApp(url: Uri) {
        val intent = Intent(Intent.ACTION_VIEW, url)
        if (intent.resolveActivity(_activity.packageManager) != null) {
            _activity.startActivity(intent)
        }
    }
    fun launchOtherApp(url_str: String) {
        launchOtherApp(url_str.toUri())
    }

    private fun _replaceAppSpecificUrl(url: Uri): Pair<Uri, Boolean> {
        if (!_custom_scheme_used || _app_scheme.isEmpty() || _app_domain.isEmpty()) {
            return url to false
        }
        val encoded_url = url.toString()
        return if (encoded_url.startsWith(_app_origin, ignoreCase = true)) {
            encoded_url.replaceFirst(_app_origin, "https://$_app_domain").toUri() to true
        } else {
            url to false
        }
    }

    protected fun _shouldInterceptRequestImpl(url: String?) = _shouldInterceptRequestImpl(url?.toUri())
    protected fun _shouldInterceptRequestImpl(request: WebResourceRequest?) = _shouldInterceptRequestImpl(request?.url)

    /**
     * Makes an alternative `WebResourceResponse` from the given URL.
     * The alternative is made if a request to the given URL should be intercepted.
     *
     * @param url
     * The requested URL.
     *
     * If the URL has the custom scheme that is supported by the `_Coordinator`,
     * the scheme part is replace by the document origin
     * (e.g., let the custom scheme be `alier:` and the document origin be
     * `https://your.app.domain.example`, the given URL `alier://app.local/foo/bar` is treated as
     * the same as the URL "https://your.app.domain.example/foo/bar").
     *
     * For avoiding to cause CORS policy violation, `Access-Control-Allow-Origin` response header
     * is added to the alternative response when intercepting a request to the custom scheme URL.
     *
     * @return
     * `WebResourceResponse` if a request to the given URL should be intercepted,
     * `null` otherwise.
     */
    protected fun _shouldInterceptRequestImpl(url: Uri?): WebResourceResponse? {
        if (url == null) {
            return null
        }

        val (url_, modified) = _replaceAppSpecificUrl(url)

        val response = _asset_loader.shouldInterceptRequest(url_) ?: return null

        if (_custom_scheme_used && !modified) {
            //  For avoiding to cause CORS policy violation,
            //  add Access-Control-Allow-Origin response header with the app origin.
            response.updateResponseHeader("Access-Control-Allow-Origin", _app_origin)
        }

        return response
    }
}
class _CoordinatorForApiLv1 (
    activity: Activity,
    assetLoader: WebViewAssetLoader,
    appScheme: String,
    appDomain: String
): _Coordinator(activity, assetLoader, appScheme, appDomain) {
    @Deprecated("Deprecated in Java")
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        launchOtherApp(url!!)
        return true
    }

    @Deprecated("Deprecated in Java")
    override fun shouldInterceptRequest(
        view: WebView?,
        url: String?
    ): WebResourceResponse? = _shouldInterceptRequestImpl(url)
}

@RequiresApi(Build.VERSION_CODES.N)
class _CoordinatorForApiLv24 (
      activity: Activity,
      assetLoader: WebViewAssetLoader,
      appScheme: String,
      appDomain: String
): _Coordinator(activity, assetLoader, appScheme, appDomain) {
    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
        launchOtherApp(request.url)
        return true
    }

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?
    ): WebResourceResponse? = _shouldInterceptRequestImpl(request)
}

fun makeCoordinator(
    activity: Activity,
    assetLoader: WebViewAssetLoader,
    appScheme: String,
    appDomain: String
): _Coordinator {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        _CoordinatorForApiLv24(activity, assetLoader, appScheme, appDomain)
    } else {
        _CoordinatorForApiLv1(activity, assetLoader, appScheme, appDomain)
    }
}
