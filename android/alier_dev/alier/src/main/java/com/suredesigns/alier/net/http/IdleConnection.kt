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

package com.suredesigns.alier.net.http

import com.suredesigns.alier.AlierLog
import com.suredesigns.alier.net.http.data.Headers
import com.suredesigns.alier.net.http.fetch.HttpMethod
import java.io.BufferedOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.Charset

data class TimeoutSettings(var read: Int, var connect: Int) {
    fun update(other: TimeoutSettings) {
        read    = other.read
        connect = other.connect
    }
}

data class ConnectionSettings(val timeout: TimeoutSettings, var useCaches: Boolean) {
    fun update(other: ConnectionSettings) {
        useCaches = other.useCaches
        timeout.update(other.timeout)
    }
}

sealed class IdleConnection(val url: URL) {
    private val _connection: HttpURLConnection = url.openConnection() as HttpURLConnection
    companion object {
        fun open(url: URL): IdleConnection {
            return when(url.protocol) {
                "http"  -> HttpIdleConnection(url)
                "https" -> HttpsIdleConnection(url)
                else    -> HttpsIdleConnection(url)
            }
        }
    }
    private val _settings   = ConnectionSettings(TimeoutSettings(0, 0), true)
    private var _method     = HttpMethod.GET
    private var _headers    = Headers()
    private var _body: ByteArray? = null

    fun noCache(): IdleConnection {
        _settings.useCaches = false
        return this
    }
    fun useCache(): IdleConnection {
        _settings.useCaches = true
        return this
    }
    private fun useMethod(method: HttpMethod): IdleConnection {
        _method = method
        return this
    }
    fun useMethod(method: String): IdleConnection {
        val m = HttpMethod.get(method) ?: return this
        return if (m === _method) { this } else { useMethod(m) }
    }

    fun readTimeout(duration: Int): IdleConnection {
        _settings.timeout.read = duration
        return this
    }
    fun connectTimeout(duration: Int): IdleConnection {
        _settings.timeout.connect = duration
        return this
    }

    fun settings(newSettings: ConnectionSettings): IdleConnection {
        _settings.update(newSettings)
        return this
    }

    fun body(data: ByteArray): IdleConnection {
        _body = data.copyOf()
        return this
    }
    fun body(data: String, charset: Charset = Charsets.UTF_8): IdleConnection {
        return body(data.toByteArray(charset))
    }

    fun setHeader(headerName: String, headerValue: String): IdleConnection {
        _headers.set(headerName, headerValue)
        return this
    }

    fun setHeaders(headers: Map<String, String>): IdleConnection {
        _headers.set(headers)
        return this
    }

    fun setHeaders(headers: Headers): IdleConnection {
        _headers.set(headers)
        return  this
    }
    fun addHeader(headerName: String, headerValue: String): IdleConnection {
        _headers.add(headerName, headerValue)
        return this
    }
    fun addHeaders(headers: Map<String, String>): IdleConnection {
        _headers.add(headers)
        return this
    }
    fun addHeaders(headers: Headers): IdleConnection {
        _headers.add(headers)
        return this
    }

    val body: ByteArray?
        get() = _body?.copyOf()

    val headers: Map<String, String>
        get() = _headers.toMap()

    val method: String
        get() = _method.name


    abstract fun makeConnection(connection: HttpURLConnection): ActiveConnection

    fun connect(): ActiveConnection {

        initConnection()

        _connection.connect()
        return makeConnection(_connection)
    }

    private fun initConnection() {
        val data = _body
        _connection.doInput              = _method.usesResponseBody
        _connection.doOutput             = _method.usesRequestBody or (data != null && data.isNotEmpty())
        _connection.requestMethod        = _method.name
        _connection.allowUserInteraction = false
        _connection.useCaches            = _method.mayBeCacheable and _settings.useCaches

        //  set and validate readTimeout
        _connection.readTimeout = if (_settings.timeout.read < 0) {
            AlierLog.w(
                0,
                "${javaClass.name}::makeConnection(): given read timeout is negative (timeout.read = ${_settings.timeout.read}). Fall back on 1 [ms]."
            )
            1
        } else {
            _settings.timeout.read
        }

        val read_timeout = _connection.readTimeout
        if (read_timeout != _settings.timeout.read) {
            AlierLog.w(
                0,
                "${javaClass.name}::makeConnection(): read timeout was not updated from $read_timeout [ms] to ${_settings.timeout.read} [ms]"
            )
        }

        //  set and validate connectTimeout
        _connection.connectTimeout = _settings.timeout.connect
        _connection.connectTimeout = if (_settings.timeout.connect < 0) {
            AlierLog.w(
                0,
                "${javaClass.name}::makeConnection(): given connect timeout is negative (timeout.connect = ${_settings.timeout.connect}). Fall back on 1 [ms]."
            )
            1
        } else {
            _settings.timeout.connect
        }

        val connect_timeout = _connection.connectTimeout
        if (connect_timeout != _settings.timeout.connect) {
            AlierLog.w(
                0,
                "${javaClass.name}::makeConnection(): connect timeout was not updated from $connect_timeout [ms] to ${_settings.timeout.connect} [ms]"
            )
        }
        //  set headers
        for ((header_name, header_value) in _headers.toMap()) {
            _connection.addRequestProperty(header_name, header_value)
        }

        //  set body
        if (_connection.doOutput && data != null && data.isNotEmpty()) {
            _connection.setFixedLengthStreamingMode(data.size)
            BufferedOutputStream(_connection.outputStream).use {
                it.write(data)
            }
        }
    }
}
