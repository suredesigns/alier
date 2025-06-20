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

class ResponseData {
    var status: Int
    var statusText: String
    var headers: Headers
    var body: ByteArray
    
    init(status: Int, statusText: String, headers: Headers, body: ByteArray?) {
        self.status = status
        self.statusText = statusText
        self.headers = headers
        self.body = body == nil ? ByteArray("".utf8) : body!
    }
    
    func equals(other: Any?) -> Bool {
        if self === other as! ResponseData { return true }
        if other is ResponseData {
            let otherData = other as! ResponseData
            if self.status != otherData.status { return false }
            if self.statusText != otherData.statusText { return false }
            if !self.headers.equals(other: otherData.headers)  { return false }
            if self.body.isEmpty || otherData.body.isEmpty  { return self.body == otherData.body }

            return self.body == otherData.body
        } else {
            return false
        }
    }

    func toDict() -> Dictionary<String, Any?> {
        let content_type = (self.headers.get(key: "content-type") != nil) ? self.headers.get(key: "content-type") : "application/octet-stream"
        let encStrBody: String?
        if self.body.isEmpty {
            encStrBody = nil
        } else {
            let data = Data(self.body)
            let encoded = data.base64EncodedString()
            encStrBody = "data:\(content_type!);base64,\(encoded)"
        }
        let dict : [String: Any?] = [
            "status"     : self.status,
            "statusText" : self.statusText,
            "body"       : encStrBody,
            "headers"    : self.headers.toDict()
        ]
        return dict
    }
}
