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

enum SafeListedRequestHeader: String {
    case Accept          = "Accept"
    case AcceptLanguage  = "Accept-Language"
    case ContentLanguage = "Content-Language"
    case ContentType     = "Content-Type"
    case Range           = "Range"
}

enum HttpMethod: String {
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-get">RFC9110 - HTTP Semantics: 9.3.1 GET</a>
     */
    case CONNECT = "CONNECT"
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-get">RFC9110 - HTTP Semantics: 9.3.1 GET</a>
     */
    case DELETE = "DELETE"
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-get">RFC9110 - HTTP Semantics: 9.3.1 GET</a>
     */
    case GET = "GET"
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-get">RFC9110 - HTTP Semantics: 9.3.1 GET</a>
     */
    case HEAD = "HEAD"
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-get">RFC9110 - HTTP Semantics: 9.3.1 GET</a>
     */
    case OPTIONS = "OPTIONS"
    /**
     *
     * @see <a href="https://www.rfc-editor.org/rfc/rfc5789.html">
     *      RFC5789 - PATCH Method for HTTP
     *      </a>
     */
    case PATCH = "PATCH"
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-post">
     *      RFC9110 - HTTP Semantics: POST
     *      </a>
     */
    case POST = "POST"
    /**
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-put">
     *      RFC9110 - HTTP Semantics: PUT
     *      </a>
     */
    case PUT = "PUT"
    /**
     * The request method used for loop-back testing.
     *
     * This method is idempotent which means that a request with this method always cause the same effect in semantics.
     * Hence a request with this method is guaranteed that the client can automatically retry the request until the client reads its response successfully.
     *
     * This is a forbidden method, i.e.,
     * in context of the fetch standard, a request with this method will cause an `TypeError` on JavaScript.
     *
     * @see <a href="https://www.rfc-editor.org/rfc/rfc9110.html#name-trace">
     *      RFC9110 - HTTP Semantics: TRACE
     *      </a>
     * @see <a href="https://fetch.spec.whatwg.org/#forbidden-method">
     *      Fetch Standard - forbidden method
     *      </a>
     */
    case TRACE = "TRACE"
    /**
     * Non standard request method used to echo a request body for debugging purposes.
     * Although the `TRACK` is not defined in any RFCs, it is specified as one of the forbidden methods in the Fetch Standard.
     *
     * This is a forbidden method, i.e.,
     * in context of the fetch standard, a request with this method will cause an `TypeError` on JavaScript.
     *
     * @see <a href="https://www.kb.cert.org/vuls/id/288308">
     *      VU#288308 Microsoft Internet Information Server (IIS) vulnerable to cross-site scripting via HTTP TRACK method
     *      </a>
     * @see <a href="https://fetch.spec.whatwg.org/#forbidden-method">
     *      Fetch Standard - forbidden method
     *      </a>
     */
    case TRACK = "TRACK"

    init?(isSafe: Bool = false,
        usesRequestBody: Bool = false,
        usesResponseBody: Bool = false,
        isIdempotent: Bool = false,
        mayBeCacheable: Bool = false,
        isForbidden: Bool = false
    ) {
        if isForbidden {
            if usesResponseBody {
                if usesRequestBody {
                    self = .TRACK
                } else {
                    self = .CONNECT
                }
            } else if isIdempotent {
                self = .TRACE
            }
        }
        if isIdempotent {
            if usesRequestBody {
                if usesResponseBody {
                    self = .DELETE
                } else {
                    self = .PUT
                }
            }
            if isSafe {
                if mayBeCacheable && usesResponseBody {
                    self = .GET
                } else if mayBeCacheable {
                    self = .HEAD
                } else if usesResponseBody {
                    self = .OPTIONS
                }
            }
        }
        if mayBeCacheable && usesRequestBody && usesResponseBody {
            self = .PATCH
        }
        if mayBeCacheable && usesRequestBody && usesResponseBody {
            self = .POST
        }
        return nil
    }
    
    static private var _methods: [String] = [HttpMethod.CONNECT.rawValue,
                                             HttpMethod.DELETE.rawValue,
                                             HttpMethod.GET.rawValue,
                                             HttpMethod.HEAD.rawValue,
                                             HttpMethod.OPTIONS.rawValue,
                                             HttpMethod.PATCH.rawValue,
                                             HttpMethod.POST.rawValue,
                                             HttpMethod.PUT.rawValue,
                                             HttpMethod.TRACE.rawValue,
                                             HttpMethod.TRACK.rawValue
                                            ]
    static private func isMethod(_ s: String) -> Bool {
        return _methods.contains(s.uppercased())
    }
    static func get(_ s: String) -> HttpMethod? {
        let s_norm = s.uppercased()
        if HttpMethod.isMethod(s_norm) {
            return HttpMethod(rawValue: s_norm)
        } else {
            return nil
        }
    }
    
    func isSafe() -> Bool {
        return self == .GET || self == .HEAD || self == .OPTIONS
    }
    
    func usesRequestBody() -> Bool {
        return self == .DELETE || self == .PATCH || self == .PUT || self == .POST || self == .TRACK
    }
    
    func usesResponseBody() -> Bool {
        return self == .CONNECT || self == .DELETE || self == .GET || self == .OPTIONS || self == .PATCH || self == .POST || self == .TRACK
    }
    
    func isIdempotent() -> Bool {
        return self == .DELETE || self == .GET || self == .HEAD || self == .OPTIONS || self == .PUT || self == .TRACE
    }
    
    func mayBeCacheable() -> Bool {
        return self == .GET || self == .HEAD || self == .PATCH || self == .POST
    }
    
    func isForbidden() -> Bool {
        return self == .CONNECT || self == .TRACE || self == .TRACK
    }
}

struct FetchRequest {
    var method: String
    var url: String
    var body: HTTPBody
    var headers: Headers
    
    init(
        method: String,
        url: String,
        body: HTTPBody,
        headers: Dictionary<String, String>
    ) {
        self.method = method
        self.url = url
        self.body = body
        self.headers = Headers(dict: headers)
    }
}
