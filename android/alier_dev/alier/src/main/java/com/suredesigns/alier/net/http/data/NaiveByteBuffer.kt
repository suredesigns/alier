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

operator fun NaiveByteBuffer.plusAssign(chunk: ByteArray) {
    add(chunk)
}
class NaiveByteBuffer(initialCapacity: Int = 8, doubleUntil: Int = -1) {
    private var _size = 0
    private var _bytes = ByteArray(initialCapacity)
    private val _double_until = doubleUntil

    val size: Int
        get() = _size

    val capacity: Int
        get() = _bytes.size

    fun add(chunk: ByteArray): NaiveByteBuffer {
        return add(chunk, chunk.indices)
    }
    fun add(chunk: ByteArray, n: Int): NaiveByteBuffer {
        return add(chunk, 0.until(n))
    }
    fun add(chunk: ByteArray, range: IntRange): NaiveByteBuffer {

        val range_size = range.last - range.first + 1
        val remain = _bytes.size - _size

        if (range_size > remain) {
            val required_capacity = size + range_size
            val extended_capacity = if ((0 <= _double_until) and (_bytes.size < _double_until)) {
                _bytes.size * 2
            } else {
                _bytes.size + (_bytes.size - range_size) / 2 + range_size
            }
            val new_capacity = if (extended_capacity > required_capacity) extended_capacity else required_capacity

            val new_buf = ByteArray(new_capacity)
            System.arraycopy(_bytes, 0, new_buf, 0, _size)
            _bytes = new_buf
        }

        System.arraycopy(chunk, range.first, _bytes, _size, range_size)
        _size += range_size

        return this
    }

    fun realloc(n: Int): NaiveByteBuffer {
        if (n < 0) return realloc(0)
        val new_buf = ByteArray(n)
        val new_size = if (_size <= n) _size else n
        System.arraycopy(_bytes, 0, new_buf, 0, new_size)
        _bytes = new_buf
        _size = new_size
        return this
    }

    fun compact(): NaiveByteBuffer {
        return if (_size == _bytes.size) this else realloc(_size)
    }
    fun toByteArray(): ByteArray {
        return compact()._bytes
    }

    fun move(): ByteArray {
        val bytes = _bytes
        realloc(0)
        return bytes
    }
}
