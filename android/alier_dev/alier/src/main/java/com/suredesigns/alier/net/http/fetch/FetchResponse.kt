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
import com.suredesigns.alier.net.http.data.FetchData
import java.net.URL

enum class SafeListedResponseHeader(value: String) {
    CacheControl("Cache-Control"),
    ContentLanguage("Content-Language"),
    ContentLength("Content-Length"),
    ContentType("Content-Type"),
    Expires("Expires"),
    LastModified("Last-Modified"),
    Pragma("Pragma")
}

class FetchResponse(
    url: URL,
    body: Body,
    headers: Map<String, String>
) {
    val fetch_data = FetchData(url, body, headers)
}
