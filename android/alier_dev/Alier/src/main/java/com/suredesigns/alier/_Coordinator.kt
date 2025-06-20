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
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.RequiresApi
import androidx.core.net.toUri

abstract class _Coordinator(
      private val _activity: Activity
): WebViewClient() {

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
}
class _CoordinatorForApiLv1 (
      activity: Activity
): _Coordinator(activity) {
    @Deprecated("Deprecated in Java")
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        launchOtherApp(url!!)
        return true
    }
}

@RequiresApi(Build.VERSION_CODES.N)
class _CoordinatorForApiLv24 (
      activity: Activity
): _Coordinator(activity) {
    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
        launchOtherApp(request.url)
        return true
    }
}

fun makeCoordinator(activity: Activity): _Coordinator {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        _CoordinatorForApiLv24(activity)
    } else {
        _CoordinatorForApiLv1(activity)
    }
}
