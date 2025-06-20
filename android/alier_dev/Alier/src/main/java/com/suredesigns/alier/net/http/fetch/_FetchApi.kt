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

import com.suredesigns.alier.net.http.HttpIdleConnection
import com.suredesigns.alier.net.http.HttpsIdleConnection
import com.suredesigns.alier.net.http.IdleConnection
import com.suredesigns.alier.net.http.data.Body
import com.suredesigns.alier.net.http.data.Headers
import com.suredesigns.alier.net.http.data.ResponseData
import java.net.URL

class FetchApi {
    private fun originOf(url: URL): String {
        val port = if (url.port < 0) url.defaultPort else url.port
        return "${url.protocol}://${url.path}:${port}"
    }

    fun fetch(request: FetchRequest): ResponseData {
        return when(val conn = IdleConnection.open(request.url)) {
            is HttpsIdleConnection -> fetchWithHttps(conn, request)
            is HttpIdleConnection -> fetchWithHttp(conn, request)
        }
    }
    fun fetch(method: String, url: URL, body: Body, headers: Headers): ResponseData {
        return fetch(FetchRequest(method, url, body, headers))
    }

    private fun fetchWithHttp(conn: HttpIdleConnection, request: FetchRequest): ResponseData {
        initConnection(conn, request)


        return conn.connect().use {
            it.responseData
        }
    }

    private fun fetchWithHttps(conn: HttpsIdleConnection, request: FetchRequest): ResponseData {
        initConnection(conn, request)

        return conn.connect().use {
            it.responseData
        }
    }

    private fun initConnection(conn: IdleConnection, request: FetchRequest) {
        conn
            .useMethod(request.method)
            .addHeaders(request.headers)
            .connectTimeout(1000)
            .readTimeout(0)

        if (conn.method == "PUT" || conn.method == "POST" || conn.method == "PATCH") {
            conn
                .body(request.body.toByteArray())
        }
    }
}