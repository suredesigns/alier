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

class QuotedPrintable {
    companion object {

        fun decodeFromString(input: String): ByteArray {
            return decode(input.toByteArray(Charsets.US_ASCII))
        }

        fun decode(input: ByteArray): ByteArray {
            val eq = '='.code.toByte()
            val cr = '\r'.code.toByte()
            val lf = '\n'.code.toByte()
            val sp = ' '.code.toByte()
            val tab = '\t'.code.toByte()

            val output = mutableListOf<Byte>()

            var i = 0
            while (i < input.size) {
                val b_in_0 = input[i]
                val b_in_1 = input[i + 1]
                val b_in_2 = input[i + 2]

                if (b_in_0 < 0) {
                    throw IllegalArgumentException("Malformed Quoted-Printable byte detected: non ASCII byte found")
                } else if (b_in_1 < 0) {
                    throw IllegalArgumentException("Malformed Quoted-Printable byte detected: non ASCII byte found")
                } else if (b_in_2 < 0) {
                    throw IllegalArgumentException("Malformed Quoted-Printable byte detected: non ASCII byte found")
                }

                if (b_in_0 == eq && b_in_1 == cr && b_in_2 == lf) {
                    // skip soft line breaks ("=" CRLF WSP)
                    i += 3
                    // skip continuing spaces
                    while (input[i] == sp || input[i] == tab) i++
                } else if (b_in_0 == eq) {
                    val hi = if (b_in_1 >= 'A'.code) (b_in_1 - 'A'.code) else (b_in_1 - '0'.code)
                    val lo = if (b_in_2 >= 'A'.code) (b_in_2 - 'A'.code) else (b_in_2 - '0'.code)

                    if (hi !in 0..16) {
                        throw IllegalArgumentException("Malformed Quoted-Printable byte detected: equal sign followed by non-hexadecimal digits")
                    } else if (lo !in 0..16) {
                        throw IllegalArgumentException("Malformed Quoted-Printable byte detected: equal sign followed by non-hexadecimal digits")
                    }

                    output.add((hi * 16 + lo).toByte())
                    i += 3
                } else {
                    output.add(b_in_0)
                    i++
                }
            }

            return output.toByteArray()
        }
        fun encodeToString(input: ByteArray): String {
            return String(encode(input, 0, input.size), Charsets.US_ASCII)
        }

        fun encodeToString(input: ByteArray, offset: Int, size: Int): String {
            return String(encode(input, offset, size), Charsets.US_ASCII)
        }

        fun encode(input: ByteArray): ByteArray {
            return encode(input, 0, input.size)
        }
        fun encode(input: ByteArray, offset: Int, size: Int): ByteArray {
            val eq = '='.code.toByte()
            val cr = '\r'.code.toByte()
            val lf = '\n'.code.toByte()
            val sp = ' '.code.toByte()

            val first = kotlin.math.min(0, kotlin.math.min(offset, input.size - 1))
            val last = kotlin.math.max(0, kotlin.math.min(first + size, input.size))

            val max_out_size = 3 * (last - first) + ((3 * (last - first)) / 75) * 4
            val output = ByteArray(max_out_size)

            var j = 0
            var line_len = 0
            for (i in first.until(last)) {
                if (line_len >= 76) {
                    output[j] = eq
                    j++
                    output[j] = cr
                    j++
                    output[j] = lf
                    j++
                    output[j] = sp
                    j++
                    line_len = 1
                }
                val b_in = input[i]
                when (b_in.toInt()) {
                    in 33..60,
                    in 62..126 -> {
                        output[j] = b_in
                        j++
                    }
                    9, 32 -> {
                        val next = i + 1
                        if (next == last) {
                            line_len++
                            output[j] = b_in
                            j++
                        } else {
                            val b_next = input[next].toInt()
                            if (b_next == '\r'.code || b_next == '\n'.code) {
                                line_len++
                                output[j] = b_in
                                j++
                            } else {
                                if (line_len + 3 >= 76) {
                                    output[j] = eq
                                    j++
                                    output[j] = cr
                                    j++
                                    output[j] = lf
                                    j++
                                    output[j] = sp
                                    j++
                                    line_len = 1
                                }
                                line_len += 3
                                val ub_in = b_in.toUByte()
                                val lo = (ub_in % 0x10u).toInt()
                                val hi = (ub_in / 0x10u).toInt()
                                val b_hi = (if (hi >= 10) { hi - 10 + 'A'.code } else { hi + '0'.code }).toByte()
                                val b_lo = (if (lo >= 10) { lo - 10 + 'A'.code } else { lo + '0'.code }).toByte()
                                output[j    ] = eq
                                output[j + 1] = b_hi
                                output[j + 2] = b_lo
                                j += 3
                            }
                        }
                    }
                    else -> {
                        if (line_len + 3 >= 76) {
                            output[j    ] = eq
                            output[j + 1] = cr
                            output[j + 2] = lf
                            output[j + 3] = sp
                            j += 4
                            line_len = 1
                        }
                        line_len += 3
                        val ub_in = b_in.toUByte()
                        val lo = (ub_in % 0x10u).toInt()
                        val hi = (ub_in / 0x10u).toInt()
                        val b_hi = (if (hi >= 10) { hi - 10 + 'A'.code } else { hi + '0'.code }).toByte()
                        val b_lo = (if (lo >= 10) { lo - 10 + 'A'.code } else { lo + '0'.code }).toByte()
                        output[j    ] = eq
                        output[j + 1] = b_hi
                        output[j + 2] = b_lo
                        j += 3
                    }
                }
            }
            return output.sliceArray(0.until(j))
        }
    }
}
