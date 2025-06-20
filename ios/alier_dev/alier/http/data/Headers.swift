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

class Headers {
    private var headers: Dictionary<String, String>!
    
    convenience init(){ self.init(dict: Dictionary<String, String>()) }
    init(dict: Dictionary<String, String>) {
        self.headers = dict
    }

    func toDict() -> Dictionary<String, String> {
        return self.headers
    }
    
    @discardableResult
    func remove(key: String) -> String? {
        return self.headers.removeValue(forKey: key.trimmingCharacters(in: .whitespaces).lowercased())
    }

    @discardableResult
    func add(key: String, value: String) -> Headers {
        let k = key.trimmingCharacters(in: .whitespaces).lowercased()
        let v = value.trimmingCharacters(in: .whitespaces)
        if let u = self.headers[k] {
            self.headers[k] = "\(u), \(v)"
        } else {
            self.headers[k] = v
        }
        return self
    }

    @discardableResult
    func add(from: Dictionary<String, String>) -> Headers {
        for (key, value) in from {
            self.headers.updateValue(value, forKey: key)
        }
        return self
    }

    @discardableResult
    func add(other: Headers) -> Headers {
        return add(from: other.headers)
    }

    @discardableResult
    func set(key: String, value: String) -> Headers {
        self.headers[key.trimmingCharacters(in: .whitespaces).lowercased()] = value.trimmingCharacters(in: .whitespaces)
        return self
    }
    
    @discardableResult
    func set(from: Dictionary<String, String>) -> Headers {
        for (key, value) in from {
            self.headers.updateValue(value, forKey: key)
        }
        return self
    }

    @discardableResult
    func set(other: Headers) -> Headers {
        return set(from: other.headers)
    }

    func get(key: String) -> String? {
        return self.headers[key.trimmingCharacters(in: .whitespaces).lowercased()]
    }

    func containsValue(value: String) -> Bool {
        return self.headers.values.contains(value)
    }

    func containsKey(key: String) -> Bool {
        return self.headers.keys.contains(key.trimmingCharacters(in: .whitespaces).lowercased())
    }

    func toByteArray() -> ByteArray {
        var chunks = ""
        for (key, value) in self.headers {
            let line = "\(key):\(value)\r\n"
            chunks += line
        }
        return ByteArray(chunks.utf8)
    }
    
    func equals(other: Headers) -> Bool {
        return self.headers == other.headers
    }

}
