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

class Headers(map: Map<String, String>)  {
    private val _headers = map.toMutableMap()

    constructor(): this(mutableMapOf())

    fun toMap(): Map<String, String> {
        return _headers.toMap()
    }

    fun toList(): List<Pair<String, String>> {
        return _headers.toList()
    }

    fun toMutableMap(): MutableMap<String, String> {
        return  _headers.toMutableMap()
    }
    fun remove(key: String): String? {
        return _headers.remove(key.trim().lowercase())
    }

    fun add(key: String, value: String): Headers {
        val k = key.trim().lowercase()
        val v = value.trim()
        val u = _headers[k]
        if (u == null) {
            _headers[k] = v
        } else {
            _headers[k] += ", $v"
        }
        return this
    }

    fun add(from: Map<out String, String>): Headers {
        for ((key, value) in from) {
            add(key, value)
        }
        return this
    }

    fun add(other: Headers): Headers {
        return add(other._headers)
    }

    fun set(key: String, value: String): Headers {
        _headers[key.trim().lowercase()] = value.trim()
        return this
    }

    fun set(from: Map<out String, String>): Headers {
        for ((key, value) in from) {
            set(key, value)
        }
        return this
    }

    fun set(other: Headers): Headers {
        return set(other._headers)
    }

    operator fun get(key: String): String? {
        return _headers[key.trim().lowercase()]
    }

    fun containsValue(value: String): Boolean {
        return _headers.containsValue(value)
    }

    fun containsKey(key: String): Boolean {
        return _headers.containsKey(key.trim().lowercase())
    }

    fun toByteArray(): ByteArray {
        val chunks = NaiveByteBuffer()
        for ((key, value) in _headers) {
            val line = "$key:$value\r\n"
            chunks.add(line.toByteArray())
        }
        return chunks.toByteArray()
    }

}