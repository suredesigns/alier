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
import java.nio.charset.Charset


enum class BinaryEncoding {
    Base64,
    QuotedPrintable,
}

sealed class Body {
    abstract fun toByteArray(): ByteArray
}

class NoContent: Body() {
    override fun equals(other: Any?): Boolean {
        return this === other || other is NoContent
    }

    override fun hashCode(): Int {
        return javaClass.hashCode()
    }

    override fun toByteArray(): ByteArray {
        return ByteArray(0)
    }
}

data class Text(val body: String): Body() {
    override fun toString(): String {
        return body
    }

    override fun toByteArray(): ByteArray {
        return body.toByteArray(Charsets.UTF_8)
    }
    fun toByteArray(charset: Charset): ByteArray {
        return body.toByteArray(charset)
    }
}

data class Binary(val body: ByteArray): Body() {
    companion object {
        fun fromString(s: String): Binary {
            return Binary(if (s.startsWith("data:")) {
                val encoding_pos = s.indexOf(";base64,", 5)
                if (encoding_pos < 0) {
                    Base64.decode(s.substring(encoding_pos + ";base64,".length), Base64.NO_WRAP or Base64.URL_SAFE)
                } else {
                    s.substring(5).toByteArray()
                }
            } else {
                s.toByteArray()
            })
        }
    }
    constructor(body: String): this(fromString(body).body)

    override fun toString(): String {
        return toString(BinaryEncoding.Base64)
    }
    fun toString(encoding: BinaryEncoding): String {
        return when (encoding) {
            BinaryEncoding.Base64 -> Base64.encodeToString(body, Base64.NO_WRAP or Base64.URL_SAFE)
            BinaryEncoding.QuotedPrintable -> QuotedPrintable.encodeToString(body)
        }
    }

    override fun toByteArray(): ByteArray {
        return body
    }
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Binary) return false

        return body.contentEquals(other.body)
    }

    override fun hashCode(): Int {
        return body.contentHashCode()
    }
}

data class NestedEnvelopes(val body: Array<Envelope>, val contentType: String, val boundary: String): Body() {
    override fun toByteArray(): ByteArray {
        val delimiter = "--${boundary}".toByteArray(Charsets.US_ASCII)
        val crlf = "\r\n".toByteArray(Charsets.US_ASCII)
        val chunks = NaiveByteBuffer(delimiter.size * 2)

        for (envelope in body) {
            chunks
                .add(delimiter)
                .add(crlf)
                .add(envelope.toByteArray())
        }
        chunks
            .add(delimiter)
            .add("--".toByteArray(Charsets.US_ASCII))
            .add(crlf)

        return chunks.toByteArray()
    }
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is NestedEnvelopes) return false

        return body.contentEquals(other.body)
    }

    override fun hashCode(): Int {
        return body.contentHashCode()
    }
}
data class NestedEnvelope(val body: Envelope, val boundary: String): Body() {
    override fun toByteArray(): ByteArray {
        val delimiter = "--${boundary}".toByteArray(Charsets.US_ASCII)
        val crlf = "\r\n".toByteArray(Charsets.US_ASCII)
        val chunks = NaiveByteBuffer(delimiter.size * 2)

        chunks
            .add(delimiter)
            .add(crlf)
            .add(body.toByteArray())
            .add(delimiter)
            .add("--".toByteArray(Charsets.US_ASCII))
            .add(crlf)

        return chunks.toByteArray()
    }
}


data class Envelope(val headers: Headers, val body: Body) {
    fun toByteArray(): ByteArray {
        val crlf = "\r\n".toByteArray(Charsets.US_ASCII)
        val chunks = NaiveByteBuffer()

        chunks
            .add(headers.toByteArray())
            .add(crlf)
            .add(body.toByteArray())

        return chunks.toByteArray()
    }
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Envelope) return false
        if (headers != other.headers) return false
        if (body != other.body) return false

        return true
    }

    override fun hashCode(): Int {
        var result = headers.hashCode()
        result = 31 * result + body.hashCode()
        return result
    }

}
