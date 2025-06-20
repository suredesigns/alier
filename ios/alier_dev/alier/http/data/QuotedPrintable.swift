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

class QuotedPrintable {
    
    static func decodeFromString(input: String) throws -> ByteArray {
        return try decode(input: (input.data(using: .ascii)?.encodedHexadecimals())!)
    }
    
    static func decode(input: ByteArray) throws -> ByteArray {
        let eq = ByteArray("=".utf8)[0]
        let cr = ByteArray("\r".utf8)[0]
        let lf = ByteArray("\n".utf8)[0]
        let sp = ByteArray(" ".utf8)[0]
        let tab = ByteArray("\t".utf8)[0]
        
        var output: ByteArray = ByteArray()
        
        var i: Int = 0
        while i < input.count {
            let b_in_0: UInt8 = input[i]
            let b_in_1: UInt8 = input[i + 1]
            let b_in_2: UInt8 = input[i + 2]
            
            if b_in_0 > 0x7f {
                throw NSError(domain: "Malformed Quoted-Printable byte detected: non ASCII byte found", code: -1, userInfo: nil)
            } else if b_in_1 > 0x7f {
                throw NSError(domain: "Malformed Quoted-Printable byte detected: non ASCII byte found", code: -1, userInfo: nil)
            } else if b_in_2 > 0x7f {
                throw NSError(domain: "Malformed Quoted-Printable byte detected: non ASCII byte found", code: -1, userInfo: nil)
            }
            
            if b_in_0 == eq && b_in_1 == cr && b_in_2 == lf {
                // skip soft line breaks ("=" CRLF WSP)
                i += 3
                // skip continuing spaces
                while input[i] == sp || input[i] == tab {
                    i += 1
                }
            } else if b_in_0 == eq {
                let hi = b_in_1 >= ByteArray("A".utf8)[0] ? b_in_1 - ByteArray("A".utf8)[0] : b_in_1 - ByteArray("0".utf8)[0]
                let lo = b_in_2 >= ByteArray("A".utf8)[0] ? b_in_2 - ByteArray("A".utf8)[0] : b_in_2 - ByteArray("0".utf8)[0]
                
                if hi < 0 || hi > 16 {
                    throw NSError(domain: "Malformed Quoted-Printable byte detected: equal sign followed by non-hexadecimal digits",code: -1, userInfo: nil)
                } else if lo < 0 || lo > 16 {
                    throw NSError(domain: "Malformed Quoted-Printable byte detected: equal sign followed by non-hexadecimal digits", code: -1, userInfo: nil)
                }
                
                output.append((hi * 16 + lo))
                i += 3
            } else {
                output.append(b_in_0)
                i += 1
            }
        }
        
        return output
    }
    
    static func encodeToString(input: ByteArray) -> String {
        let byteArray = encode(input: input, offset: 0, size: input.count)
        let data = Data(byteArray)
        let encoded = Data(base64Encoded: data)
        return String(data: encoded!, encoding: .ascii)!
    }
    
    static func encodeToString(input: ByteArray, offset: Int, size: Int) -> String {
        let byteArray = encode(input: input, offset: offset, size: size)
        let data = Data(byteArray)
        let encoded = Data(base64Encoded: data)
        return String(data: encoded!, encoding: .ascii)!
    }
    
    static func encode(input: ByteArray) -> ByteArray {
        return encode(input: input, offset: 0, size: input.count)
    }
    static func encode(input: ByteArray, offset: Int, size: Int) -> ByteArray {
        let eq = ByteArray("=".utf8)[0]
        let cr = ByteArray("\r".utf8)[0]
        let lf = ByteArray("\n".utf8)[0]
        let sp = ByteArray(" ".utf8)[0]
        
        let first = min(0, min(offset, input.count - 1))
        let last = max(0, min(first + size, input.count))
        
        let max_out_size = 3 * (last - first) + ((3 * (last - first)) / 75) * 4
        var output = ByteArray(repeating: 0, count: max_out_size)
        
        var j: Int = 0
        var line_len: Int = 0
        for i in first ..< last {
            if line_len >= 76 {
                output[j] = eq
                j += 1
                output[j] = cr
                j += 1
                output[j] = lf
                j += 1
                output[j] = sp
                j += 1
                line_len = 1
            }
            let b_in = input[i]
            switch (Int(b_in)) {
            case 33 ... 60, 62 ... 126:
                output[j] = b_in
                j += 1
            case 9, 32:
                let next = i + 1
                if next == last {
                    line_len += 1
                    output[j] = b_in
                    j += 1
                } else {
                    let b_next = Int(input[next])
                    if b_next == ByteArray("\r".utf8)[0] || b_next == ByteArray("\n".utf8)[0] {
                        line_len += 1
                        output[j] = b_in
                        j += 1
                    } else {
                        if line_len + 3 >= 76 {
                            output[j] = eq
                            j += 1
                            output[j] = cr
                            j += 1
                            output[j] = lf
                            j += 1
                            output[j] = sp
                            j += 1
                            line_len = 1
                        }
                        line_len += 3
                        let ub_in = b_in
                        let lo = ub_in % UInt8(0x10)
                        let hi = ub_in / UInt8(0x10)
                        let b_hi = hi >= 10 ? hi - 10 + ByteArray("A".utf8)[0] : hi + ByteArray("0".utf8)[0]
                        let b_lo = lo >= 10 ? lo - 10 + ByteArray("A".utf8)[0] : lo + ByteArray("0".utf8)[0]
                        output[j    ] = eq
                        output[j + 1] = b_hi
                        output[j + 2] = b_lo
                        j += 3
                    }
                }
            default:
                if line_len + 3 >= 76 {
                    output[j    ] = eq
                    output[j + 1] = cr
                    output[j + 2] = lf
                    output[j + 3] = sp
                    j += 4
                    line_len = 1
                }
                line_len += 3
                let ub_in = b_in
                let lo = ub_in % UInt8(0x10)
                let hi = ub_in / UInt8(0x10)
                let b_hi = hi >= 10 ? hi - 10 + ByteArray("A".utf8)[0] : hi + ByteArray("0".utf8)[0]
                let b_lo = lo >= 10 ? lo - 10 + ByteArray("A".utf8)[0] : lo + ByteArray("0".utf8)[0]
                output[j    ] = eq
                output[j + 1] = b_hi
                output[j + 2] = b_lo
                j += 3
            }
            return output.prefix(j).map { $0 }
        }
        return output.prefix(j).map { $0 }
    }
}
