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

package com.suredesigns.alier.net.http.data

import android.util.Base64

data class ResponseData(val status: Int, val statusText: String, val headers: Headers, val body: ByteArray?) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ResponseData) return false

        if (status != other.status) return false
        if (statusText != other.statusText) return false
        if (headers != other.headers) return false
        if ((body === null) or (other.body === null)) return body === other.body

        return body.contentEquals(other.body)
    }

    fun toMap(): Map<String, Any?> {
        val content_type = headers["content-type"] ?: "application/octet-stream"
        return mapOf(
            "status" to status,
            "statusText" to statusText,
            "body" to if (body == null || body.isEmpty()) null else {
                "data:${content_type};base64,${Base64.encodeToString(body, Base64.NO_WRAP + Base64.URL_SAFE)}"
            },
            "headers" to headers.toMap()
        )
    }

    override fun hashCode(): Int {
        var result = status
        result = 31 * result + statusText.hashCode()
        result = 31 * result + headers.hashCode()
        if (body != null) {
            result = 31 * result + body.contentHashCode()
        }
        return result
    }
}