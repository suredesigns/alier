package com.suredesigns.alier.extensions

import android.webkit.WebResourceResponse
/**
 * Updates the target's response headers.
 */
@Suppress("UsePropertyAccessSyntax")
fun WebResourceResponse.updateResponseHeader(key: String, value: String) {
    var headers = getResponseHeaders()
    if (headers == null) {
        headers = mutableMapOf<String, String>()
        headers[key] = value
        this.setResponseHeaders(headers)
    } else {
        headers[key] = value
    }
}

/**
 * Gets the value of the specified header field from the target's response headers.
 * @return
 * the value of the specified header field if the header exists, `null` otherwise.
 */
@Suppress("UsePropertyAccessSyntax")
fun WebResourceResponse.getResponseHeaderOrNull(key: String): String? = getResponseHeaders()?.get(key)
