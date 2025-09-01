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

import com.suredesigns.alier.net.http.data.NaiveByteBuffer
import com.suredesigns.alier.net.http.data.Headers
import com.suredesigns.alier.net.http.data.ResponseData
import java.io.BufferedInputStream
import java.net.HttpURLConnection

sealed class ActiveConnection(protected val connection: HttpURLConnection) :
    AutoCloseable
{
    private var _status: Int
    private var _status_text: String
    private var _body: NaiveByteBuffer
    private var _headers: Headers

    val status: Int
        get() = _status

    val statusText: String
        get() = _status_text

    val headers: Headers
        get() = _headers

    val body: ByteArray
        get() = _body.toByteArray()

    init {
        //  Implicitly invoked getInputStream() here to read the first line.
        val status_ = connection.responseCode
        val status_text_ = connection.responseMessage

        val headers_ = Headers()
        var header_index = 0
        var header_name  = connection.getHeaderFieldKey(header_index)
        var header_value = connection.getHeaderField(header_index)
        if (header_name == null) {
            header_index++
            header_name  = connection.getHeaderFieldKey(header_index)
            header_value = connection.getHeaderField(header_index)
        }
        // TODO: handle Set-Cookie header properly
        while (header_name != null) {
            headers_.add(header_name, header_value)
            header_index++
            header_name  = connection.getHeaderFieldKey(header_index)
            header_value = connection.getHeaderField(header_index)
        }

        val content_length = headers_["content-length"]?.toInt() ?: -1

        // errorStream returns null if there is no error.
        val ist = connection.errorStream ?: if (connection.doInput) connection.inputStream else null

        var body_ = NaiveByteBuffer(0)

        if (ist != null) {
            body_ = if (content_length >= 0) {
                // Use the exact content size
                NaiveByteBuffer(content_length)
            } else {
                // Use default buffer size
                NaiveByteBuffer(8192)
            }
            val buf = ByteArray(8192)
            BufferedInputStream(ist).use {
                var n_read = it.read(buf)
                while (n_read >= 0) {
                    body_.add(buf, n_read)
                    n_read = it.read(buf)
                }
            }
            body_.compact()
        }

        _status = status_
        _status_text = status_text_
        _headers = headers_
        _body = body_
    }
    val responseData: ResponseData
        get() = ResponseData(
                status = _status,
                statusText = _status_text,
                body = _body.toByteArray(),
                headers = _headers
            )
    override fun close() {
        connection.disconnect()
    }
}
