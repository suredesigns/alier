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

import Foundation

extension NaiveByteBuffer {
    static func += (lhs: NaiveByteBuffer, rhs: ByteArray) {
        lhs.add(chunk: rhs)
    }
}

class NaiveByteBuffer {
    private var _size = 0
    private var _bytes: ByteArray
    private var _double_until: Int
    
    var initialCapacity: Int
    var doubleUntil: Int
    
    init(initialCapacity: Int = 8, doubleUntil: Int = -1) {
        self.initialCapacity = initialCapacity
        self.doubleUntil = doubleUntil
        _bytes = Array<UInt8>(repeating: 0, count: initialCapacity)
        _double_until = doubleUntil
    }

    var size: Int {
        get {
            return self._size
        }
    }

    var capacity: Int {
        get {
            return _bytes.count
        }
    }

    @discardableResult
    func add(chunk: ByteArray) -> NaiveByteBuffer {
        return self.add(chunk: chunk, n: chunk.count)
    }
    
    @discardableResult
    func add(chunk: ByteArray, n: Int) -> NaiveByteBuffer {
        return self.add(chunk: chunk, range: 0..<n)
    }
    
    @discardableResult
    func add(chunk: ByteArray, range: CountableRange<Int>) -> NaiveByteBuffer {
        let range_size = range.count
        let remain = _bytes.count - _size

        if range_size > remain {
            let required_capacity = size + range_size
            let extended_capacity: Int
            if 0 <= _double_until && _bytes.count < _double_until {
                extended_capacity = _bytes.count * 2
            } else {
                extended_capacity = _bytes.count + (_bytes.count - range_size) / 2 + range_size
            }
            let new_capacity = extended_capacity > required_capacity ? extended_capacity : required_capacity

            var new_buf = Array<UInt8>(repeating: 0, count: new_capacity)
            copyByteArray(src: _bytes, srcOffset: 0, dst: &new_buf, dstOffset: 0, size: _size)
            _bytes = new_buf
        }

        copyByteArray(src: chunk, srcOffset: range.lowerBound, dst: &_bytes, dstOffset: _size, size: range_size)
        _size += range_size

        return self
    }

    @discardableResult
    func realloc(n: Int) -> NaiveByteBuffer {
        if n < 0 { return realloc(n: 0) }
        var new_buf = ByteArray(repeating: 0, count: n)
        let new_size = _size <= n ? _size : n
        copyByteArray(src: _bytes, srcOffset: 0, dst: &new_buf, dstOffset: 0, size: new_size)
        _bytes = new_buf
        _size = new_size
        return self
    }

    @discardableResult
    func compact() -> NaiveByteBuffer {
        if _size == _bytes.count {
            return self
        } else {
            return realloc(n: _size)
        }
    }
    
    func toByteArray() -> ByteArray {
        return compact()._bytes
    }

    func move() -> ByteArray {
        let bytes = _bytes
        realloc(n: 0)
        return bytes
    }
    
    // Temporary solution. There should be a more efficient way.
    func copyByteArray(src: ByteArray, srcOffset: Int, dst: inout ByteArray, dstOffset: Int, size: Int) {
        if srcOffset < 0 || srcOffset + size - 1 > src.count ||
            dstOffset < 0 || dstOffset + size - 1 > dst.count {
            return
        }
        for i in 0 ..< size {
            dst[i + dstOffset] = src[i + srcOffset]
        }
    }
}
