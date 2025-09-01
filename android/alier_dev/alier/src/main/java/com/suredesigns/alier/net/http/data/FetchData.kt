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

import java.net.URL

data class FetchData(
    val url: URL,
    val body: Body,
    val headers: Map<String, String>
) {
    constructor(
        url: String,
        body: Body,
        headers: Map<String, String>
    ): this(URL(url), body, headers)

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        val o = other as? FetchData ?: return false
        if (url.toString() != o.url.toString()) return false
        if (body != o.body) return false
        if (headers.size != o.headers.size) return false
        for ((k, v) in headers) {
            val ov = o.headers[k] ?: return false
            if (v != ov) return false
        }
        return true
    }

    override fun hashCode(): Int {
        var result = url.toString().hashCode()
        result = 31 * result + body.hashCode()
        for ((k, v) in headers) {
            result = 31 * result + k.hashCode()
            result = 31 * result + v.hashCode()
        }
        return result
    }
}
