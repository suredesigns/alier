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

struct TimeoutSettings {
    var read: Int
    var connect: Int
    init(read: Int, connect: Int) {
        self.read = read
        self.connect = connect
    }
    
    mutating func update(other: TimeoutSettings) {
        self.read    = other.read
        self.connect = other.connect
    }
}

struct ConnectionSettings {
    var timeout: TimeoutSettings
    var useCaches: Bool
    init(timeout: TimeoutSettings, useCaches: Bool) {
        self.timeout = timeout
        self.useCaches = useCaches
    }
    
    mutating func update(other: ConnectionSettings) {
        self.useCaches = other.useCaches
        self.timeout.update(other: other.timeout)
    }
}


class URLConnection {
    
    var _url: URL
    var _config: URLSessionConfiguration = URLSessionConfiguration.default
    
    private var _settings    = ConnectionSettings(timeout: TimeoutSettings(read: 0, connect: 0), useCaches: true)
    private var _method     = HttpMethod.GET
    private var _headers    = Headers()
    private var _body: ByteArray? = nil
    
    private var _outHeaders    = Headers()
    private var _outBody: ByteArray? = nil
    private var _status: Int = -1
    private var _status_text: String = ""

    var method: String {
        get {
            return self._method.rawValue
        }
    }
    
    var headers: Headers {
        get {
            return self._headers
        }
    }
    
    var body: ByteArray? {
        get {
            return self._body
        }
    }
    
    var outHeaders: Headers {
        get {
            return self._outHeaders
        }
    }
    
    var outBody: ByteArray? {
        get {
            return self._outBody
        }
    }
    
    var status: Int {
        get {
            return self._status
        }
    }
    
    var statusText: String {
        get {
            return self._status_text
        }
    }
    
    var responseData: ResponseData {
        get {
            return ResponseData(
                status: self._status,
                statusText: self._status_text,
                headers: self._outHeaders,
                body: self._outBody
            )
        }
    }
    
    static func open(url: URL) -> URLConnection {
        switch (url.scheme) {
        case "http": return HttpConnection(url: url)
        case "https": return HttpsConnection(url: url)
        default: return HttpsConnection(url: url)
        }
    }
    
    init(url: URL) {
        self._url = url
    }
    
    @discardableResult
    func noCache() -> URLConnection {
        self._settings.useCaches = false
        return self
    }
    
    @discardableResult
    func useCache() -> URLConnection {
        self._settings.useCaches = true
        return self
    }
    
    private func useMethod(method: HttpMethod) -> URLConnection {
        _method = method
        return self
    }
    
    @discardableResult
    func useMethod(method: String) -> URLConnection {
        guard let m = HttpMethod.get(method) else { return self }
        return m == self._method ? self : useMethod(method: m)
    }

    @discardableResult
    func readTimeout(duration: Int) -> URLConnection {
        self._settings.timeout.read = duration
        return self
    }
    
    @discardableResult
    func connectTimeout(duration: Int) -> URLConnection {
        self._settings.timeout.connect = duration
        return self
    }

    @discardableResult
    func settings(newSettings: ConnectionSettings) -> URLConnection {
        self._settings.update(other: newSettings)
        return self
    }

    @discardableResult
    func body(data: ByteArray) -> URLConnection {
        self._body = data
        return self
    }
    
    @discardableResult
    func body(data: String, encoding: String.Encoding) -> URLConnection {
        if encoding == .utf8 {
            return body(data: ByteArray(data.utf8))
        }
        let data_ = data.data(using: encoding)
        let body_ = data_?.encodedHexadecimals()
        if body_ == nil {
            return body(data: ByteArray("".utf8))
        }
        return body(data: body_!)
    }

    @discardableResult
    func setHeader(headerName: String, headerValue: String) -> URLConnection {
        self._headers.set(key: headerName, value: headerValue)
        return self
    }

    @discardableResult
    func setHeaders(headers: Dictionary<String, String>) -> URLConnection {
        self._headers.set(from: headers)
        return self
    }
    
    @discardableResult
    func setHeaders(headers: Headers) -> URLConnection {
        self._headers.set(other: headers)
        return self
    }
    
    @discardableResult
    func addHeader(headerName: String, headerValue: String) -> URLConnection {
        self._headers.add(key: headerName, value: headerValue)
        return self
    }
    
    @discardableResult
    func addHeaders(headers: Dictionary<String, String>) -> URLConnection {
        self._headers.add(from: headers)
        return self
    }
    
    @discardableResult
    func addHeaders(headers: Headers) -> URLConnection {
        self._headers.add(other: headers)
        return self
    }
    
    private func createSession() -> URLSession {
        
        let readTimeout = validateReadTimeout()
        let connectTimeout = validateConnectTimeout()
        
        // Setting general properties
        //_config.identifier
        //_config.httpAdditionalHeaders
        //_config.networkServiceType = .default
        //_config.allowsCellularAccess = true
        //_config.timeoutIntervalForRequest
        //_config.timeoutIntervalForResource
        //_config.sharedContainerIdentifier
        //_config.waitsForConnectivity = true
        
        // Setting cookie policies
        //_config.httpCookieAcceptPolicy
        //_config.httpShouldSetCookies
        //_config.httpCookieStorage
        
        // Setting security policies
        //_config.tlsMinimumSupportedProtocolVersion
        //_config.tlsMaximumSupportedProtocolVersion
        //_config.urlCredentialStorage
        
        // Setting caching policies
        //_config.urlCache
        //_config.requestCachePolicy
        
        // Supporting background transfers
        //_config.sessionSendsLaunchEvents
        //_config.isDiscretionary = false
        //_config.shouldUseExtendedBackgroundIdleMode
        
        // Supporting custom protocols
        //_config.protocolClasses
        
        // Supporting Multipath TCP
        //_config.multipathServiceType
        
        // Settings HTTP policy and proxy properties
        //_config.httpMaximumConnectionsPerHost
        //_config.httpShouldUsePipelining
        //_config.proxyConfiguration
        //_config.connectionProxyDictionary
        
        // Supporting limited modes
        //_config.allowsConstrainedNetworkAccess = false
        //_config.allowsExpensiveNetworkAccess = false
        
        // Instance Properties
        //_config.requiresDNSSECValidation
        
        return URLSession(configuration: _config)
    }
    
    private func createRequest() -> URLRequest {
        var request = URLRequest(url: self._url)
        request.httpMethod = self._method.rawValue
        
        //  set headers
        for (header_name, header_value) in self._headers.toDict() {
            request.allHTTPHeaderFields?.updateValue(header_value, forKey: header_name)
        }

        //  set body
        if self._method.usesRequestBody() && self._body != nil && !self._body!.isEmpty {
            request.httpBody = Data(self.body!)
        }
        return request
    }
    
    private func validateReadTimeout() -> Int {
        var readTimeout: Int
        if self._settings.timeout.read < 0 {
            AlierLog.w(
                id: 0,
                message: "\(NSStringFromClass(type(of: self)))::makeConnection(): given read timeout is negative (timeout.read = \(_settings.timeout.read)). Fall back on 1 [ms]."
            )
            readTimeout = 1
        } else {
            readTimeout = self._settings.timeout.read
        }
        if readTimeout != self._settings.timeout.read {
            AlierLog.w(
                id: 0,
                message: "\(NSStringFromClass(type(of: self)))::makeConnection(): read timeout was not updated from \(readTimeout) [ms] to \(_settings.timeout.read) [ms]"
            )
        }
        return readTimeout
    }
    
    private func validateConnectTimeout() -> Int {
        var connectTimeout: Int
        if self._settings.timeout.connect < 0 {
            AlierLog.w(
                id: 0,
                message: "\(NSStringFromClass(type(of: self)))::makeConnection(): given connect timeout is negative (timeout.connect = \(_settings.timeout.connect). Fall back on 1 [ms]."
            )
            connectTimeout = 1
        } else {
            connectTimeout = self._settings.timeout.connect
        }
        if connectTimeout != self._settings.timeout.connect {
            AlierLog.w(
                id: 0,
                message: "\(NSStringFromClass(type(of: self)))::makeConnection(): connect timeout was not updated from \(connectTimeout) [ms] to \(_settings.timeout.connect) [ms]"
            )
        }
        return connectTimeout
    }
    
    private func makeResponseData(data: Data, response: HTTPURLResponse, error: NSError? = nil) -> Bool {
        var body_: ByteArray = ByteArray("".utf8)
        if self._method.usesResponseBody() {
            body_ = ByteArray(data)
        }
        
        var result = true
        let status_ = response.statusCode
        var status_text_ = ""
        if status_ < 200 || status_ > 299 {
            result = false
            if error != nil {
                status_text_ = error!.description
            } else {
                status_text_ = "error."
            }
        }
        
        let headers_ = Headers()

        for elem in response.allHeaderFields {
            headers_.add(key: elem.key as! String, value: elem.value as! String)
        }

        _status = status_
        _status_text = status_text_
        _outHeaders = headers_
        _outBody = body_
        return result
    }
    
    struct URLConnectionError : Error { }
    
    func dataTask(completion: @escaping(Result<String, Error>) -> Void) {
        let session = self.createSession()
        let request = self.createRequest()
        
        let task = session.dataTask(with: request) { (data, response, error) in
            guard let data = data else {
                completion(.failure(URLConnectionError()))
                return
            }
            guard let res = response as? HTTPURLResponse else {
                completion(.failure(URLConnectionError()))
                return
            }

            let error = error as? NSError
            if self.makeResponseData(data: data, response: res, error: error) {
                completion(.success(""))
            } else {
                completion(.failure(URLConnectionError()))
            }
        }
        
        task.resume()
    }
    
    
    func data() async throws {
        let session = self.createSession()
        let request = self.createRequest()
        
        do {
            let (data, response) = try await session.data(for: request)
            guard let res = response as? HTTPURLResponse else {
                throw NSError(domain: "",code: -1, userInfo: nil)
            }
            if self.makeResponseData(data: data, response: res) {
                return
            } else {
                throw NSError(domain: "",code: -1, userInfo: nil)
            }
        } catch let e {
            AlierLog.e(id: 0, message: "URLConnectionError : \(e)")
            throw NSError(domain: "URLConnectionError", code: -1, userInfo: nil)
        }
    }
    
    func downloadTask(completion: @escaping(Result<String, Error>) -> Void) {
    }
    
    func download() async throws {
    }
    
    func uploadTask(completion: @escaping(Result<String, Error>) -> Void) {
    }
    
    func upload() async throws {
    }
}
