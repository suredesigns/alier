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

package com.suredesigns.alier.net.http.fetch

import com.suredesigns.alier.net.http.data.Body
import com.suredesigns.alier.net.http.data.Headers
import java.net.URL

enum class SafeListedRequestHeader(value: String) {
    Accept("Accept"),
    AcceptLanguage("Accept-Language"),
    ContentLanguage("Content-Language"),
    ContentType("Content-Type"),
    Range("Range")
}

enum class HttpMethod(
    val isSafe: Boolean = false,
    val usesRequestBody: Boolean = false,
    val usesResponseBody: Boolean = false,
    val isIdempotent: Boolean = false,
    val mayBeCacheable: Boolean = false,
    val isForbidden: Boolean = false
) {
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-get">RFC9110 - HTTP Semantics: 9.3.1 GET</a>
     */
    CONNECT(isForbidden = true, usesResponseBody = true),
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-get">RFC9110 - HTTP Semantics: 9.3.1 GET</a>
     */
    DELETE(isIdempotent = true, usesRequestBody = true, usesResponseBody = true),
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-get">RFC9110 - HTTP Semantics: 9.3.1 GET</a>
     */
    GET(isSafe = true, isIdempotent = true, mayBeCacheable = true, usesResponseBody = true),
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-get">RFC9110 - HTTP Semantics: 9.3.1 GET</a>
     */
    HEAD(isSafe = true, isIdempotent = true, mayBeCacheable = true),
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-get">RFC9110 - HTTP Semantics: 9.3.1 GET</a>
     */
    OPTIONS(isSafe = true, isIdempotent = true, usesResponseBody = true),
    /**
     *
     * @see <a href="https://www.rfc-editor.org/rfc/rfc5789.html">
     *      RFC5789 - PATCH Method for HTTP
     *      </a>
     */
    PATCH(mayBeCacheable = true, usesRequestBody = true, usesResponseBody = true),
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-post">
     *      RFC9110 - HTTP Semantics: POST
     *      </a>
     */
    POST(mayBeCacheable = true, usesRequestBody = true, usesResponseBody = true),
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-put">
     *      RFC9110 - HTTP Semantics: PUT
     *      </a>
     */
    PUT(isIdempotent = true, usesRequestBody = true),
    /**
     * The request method used for loop-back testing.
     *
     * This method is idempotent which means that a request with this method always cause the same effect in semantics.
     * Hence a request with this method is guaranteed that the client can automatically retry the request until the client reads its response successfully.
     *
     * This is a forbidden method, i.e.,
     * in context of the fetch standard, a request with this method will cause an `TypeError` on JavaScript.
     *
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-trace">
     *      RFC9110 - HTTP Semantics: TRACE
     *      </a>
     * @see <a href="https://fetch.spec.whatwg.org/#forbidden-method">
     *      Fetch Standard - forbidden method
     *      </a>
     */
    TRACE(isForbidden = true, isIdempotent = true),
    /**
     * Non standard request method used to echo a request body for debugging purposes.
     * Although the `TRACK` is not defined in any RFCs, it is specified as one of the forbidden methods in the Fetch Standard.
     *
     * This is a forbidden method, i.e.,
     * in context of the fetch standard, a request with this method will cause an `TypeError` on JavaScript.
     *
     * @see <a href="https://www.kb.cert.org/vuls/id/288308">
     *      VU#288308 Microsoft Internet Information Server (IIS) vulnerable to cross-site scripting via HTTP TRACK method
     *      </a>
     * @see <a href="https://fetch.spec.whatwg.org/#forbidden-method">
     *      Fetch Standard - forbidden method
     *      </a>
     */
    TRACK(isForbidden = true, usesRequestBody = true, usesResponseBody = true),
    ;

    companion object {
        private val _methods = HttpMethod.values().map { m -> m.name }.toSet()
        private fun isMethod(s: String): Boolean {
            return _methods.contains(s.uppercase())
        }
        fun get(s: String): HttpMethod? {
            val s_norm = s.uppercase()
            return if (HttpMethod.isMethod(s_norm)) HttpMethod.valueOf(s_norm) else null
        }
    }
}

data class FetchRequest(
    val method: String,
    val url: URL,
    val body: Body,
    val headers: Headers
) {
    constructor(
        method: String,
        url: String,
        body: Body,
        headers: Map<String, String>
    ): this(method, URL(url), body, Headers(headers))

}
