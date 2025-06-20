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

enum BinaryEncoding {
    case Base64
    case QuotedPrintable
}

protocol HTTPBody {
    func toByteArray() -> ByteArray
    func equals(other: Any?) -> Bool
}

class NoContent: HTTPBody {
    func equals(other: Any?) -> Bool {
        if (other == nil) { return false }
        return self === other as! NoContent || other is NoContent
    }

    func toByteArray() -> ByteArray {
        return ByteArray("".utf8)
    }
}

class Text: HTTPBody {
    private var body: String
    init(body: String) {
        self.body = body
    }
    func toString() -> String {
        return self.body
    }

    func toByteArray() -> ByteArray {
        return ByteArray(self.body.utf8)
    }
    
    func equals(other: Any?) -> Bool {
        if other is Text {
            return self.body == (other as! Text).body
        }
        return false
    }
}

class Binary: HTTPBody {
    private var body: ByteArray
    init(body: ByteArray) {
        self.body = body
    }
    
    static func fromString(s: String) -> Binary {
        if (s.hasPrefix("data:")) {
            let range = s.range(of: ";base64,")
            if range == nil {
                let startIndex = s.index(s.startIndex, offsetBy: 13)
                let data = s[startIndex..<s.endIndex].data(using: .utf8)
                return Binary(body: (data?.encodedHexadecimals())!)
            } else {
                let index = s.index(s.startIndex, offsetBy: 5)
                return Binary(body: ByteArray(s[index].utf8))
            }
        } else {
            return Binary(body: ByteArray(s.utf8))
        }
    }

    func toString() -> String {
        return toString(encoding: BinaryEncoding.Base64)
    }
    func toString(encoding: BinaryEncoding) -> String {
        switch (encoding) {
        case BinaryEncoding.Base64:
            let data = Data(body)
            let encoded = Data(base64Encoded: data)
            return String(data: encoded!, encoding: .utf8)!
        case BinaryEncoding.QuotedPrintable:
            return QuotedPrintable.encodeToString(input: body)
        }
    }

    func toByteArray() -> ByteArray {
        return self.body
    }
    func equals(other: Any?) -> Bool {
        if self === other as! Binary { return true }
        if other is Binary {
            return self.body == (other as! Binary).body
        } else {
            return false
        }
    }
}

class NestedEnvelopes: HTTPBody {
    private var body: Array<Envelope>
    private var contentType: String
    private var boundary: String
    
    init(body: Array<Envelope>, contentType: String, boundary: String) {
        self.body = body
        self.contentType = contentType
        self.boundary = boundary
    }
    
    func toByteArray() -> ByteArray {
        let delimiter = "--\(self.boundary)".data(using: .ascii)?.encodedHexadecimals()
        let crlf = "\r\n".data(using: .ascii)?.encodedHexadecimals()
        let chunks: NaiveByteBuffer = NaiveByteBuffer(initialCapacity: delimiter!.count * 2)

        for envelope in self.body {
            chunks
                .add(chunk: delimiter!)
                .add(chunk: crlf!)
                .add(chunk: envelope.toByteArray())
        }
        chunks
            .add(chunk: delimiter!)
            .add(chunk: ("--".data(using: .ascii)?.encodedHexadecimals())!)
            .add(chunk: crlf!)

        return chunks.toByteArray()
    }
    
    func equals(other: Any?) -> Bool {
        if self === other as! NestedEnvelopes { return true }
        if other is NestedEnvelopes {
            let otherBody = (other as! NestedEnvelopes).body
            var res = true;
            for i in 0 ..< self.body.count {
                res = self.body[i].equals(other: otherBody[i])
                if !res { break; }
            }
            return res
        } else {
            return false
        }
    }
}

class NestedEnvelope: HTTPBody {
    private var body: Envelope
    private var boundary: String
    
    init(body: Envelope, boundary: String) {
        self.body = body
        self.boundary = boundary
    }
    
    func toByteArray() -> ByteArray {
        let delimiter = "--\(self.boundary)".data(using: .ascii)?.encodedHexadecimals()
        let crlf = "\r\n".data(using: .ascii)?.encodedHexadecimals()
        let chunks: NaiveByteBuffer = NaiveByteBuffer(initialCapacity: delimiter!.count * 2)

        chunks
            .add(chunk: delimiter!)
            .add(chunk: crlf!)
            .add(chunk: self.body.toByteArray())
            .add(chunk: delimiter!)
            .add(chunk: ("--".data(using: .ascii)?.encodedHexadecimals())!)
            .add(chunk: crlf!)

        return chunks.toByteArray()
    }
    
    func equals(other: Any?) -> Bool {
        if other is Envelope {
            return self.body.equals(other: (other as! NestedEnvelope).body)
        }
        return false
    }
}


class Envelope {
    var headers: Headers
    var body: HTTPBody
    
    init(headers: Headers, body: HTTPBody) {
        self.headers = headers
        self.body = body
    }
    
    func toByteArray() -> ByteArray {
        let crlf = "\r\n".data(using: .ascii)?.encodedHexadecimals()
        let chunks: NaiveByteBuffer = NaiveByteBuffer()

        chunks
            .add(chunk: self.headers.toByteArray())
            .add(chunk: crlf!)
            .add(chunk: self.body.toByteArray())

        return chunks.toByteArray()
    }
    
    func equals(other: Any?) -> Bool {
        if self === other as! Envelope { return true }
        if other is Envelope {
            if !self.headers.equals(other: (other as! Envelope).headers) { return false }
            return self.body.equals(other: (other as! Envelope).body)
        } else {
            return false
        }
    }
}
