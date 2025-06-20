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

/*
 ・Replaced Android source with the structure intact

 ・Temporary support
 　hashCode() cannot be used
 　Processing to get default port from URL
 　HttpMethod determination
 　NativeByteBuffer's ByteArray copy processing (there should be a more efficient copy)
 　ByteArray does not exist in Swift, so Array<UInt8> is used, but it may be better to use Data type or UnsafePointer

 ・Not started/not supported
 　Base64-related processing
 　Rewriting HttpURLConnection to URLSession
 　Rewriting AutoCloseable
 　Error handling for fetch in BaseMainActivity
 */

import Foundation
public typealias ByteArray = [UInt8]

extension Data {
    func encodedHexadecimals() -> ByteArray? {
        let responseValues = self.withUnsafeBytes({ (pointer: UnsafeRawBufferPointer) -> ByteArray in
            let unsafeBufferPointer = pointer.bindMemory(to: UInt8.self)
            let unsafePointer = unsafeBufferPointer.baseAddress!
            return ByteArray(UnsafeBufferPointer(start: unsafePointer, count: self.count))
        })
        return responseValues
    }
}

class FetchApi {
    private func originOf(url: URL) -> String {
        let port = url.port ?? getDefaultPort(url: url)
        
        return "\(url.scheme!)://\(url.path):\(port)"
    }

    func fetch(request: FetchRequest) -> ResponseData {
        let conn = URLConnection.open(url: URL(string: request.url)!)
        switch (conn) {
        case is HttpsConnection: return fetchWithHttps(conn: conn as! HttpsConnection, request: request)
        case is HttpConnection: return fetchWithHttp(conn: conn as! HttpConnection, request: request)
        default:
            return ResponseData(status: 0, statusText: "", headers: Headers(), body: ByteArray("".utf8))
        }
    }
    func fetch(method: String, url: URL, body: HTTPBody, headers: Headers) -> ResponseData {
        return fetch(request: FetchRequest(method: method, url: url.absoluteString, body: body, headers: headers.toDict()))
    }

    private func fetchWithHttp(conn: HttpConnection, request: FetchRequest) -> ResponseData {
        initConnection(conn: conn, request: request)
        
        let semaphore = DispatchSemaphore(value: 0)
        conn.dataTask(completion: { result in
            switch result {
            case .success:
                break
            case .failure(let error):
                AlierLog.e(id: 0, message: error.localizedDescription)
                break
            }
            semaphore.signal()
        })
        semaphore.wait()
        
        return conn.responseData
    }

    private func fetchWithHttps(conn: HttpsConnection, request: FetchRequest) -> ResponseData {
        initConnection(conn: conn, request: request)
        
        let semaphore = DispatchSemaphore(value: 0)
        conn.dataTask(completion: { result in
            switch result {
            case .success:
                break
            case .failure(let error):
                AlierLog.e(id: 0, message: error.localizedDescription)
                break
            }
            semaphore.signal()
        })
        semaphore.wait()
        
        return conn.responseData
    }

    private func initConnection(conn: URLConnection, request: FetchRequest) {
        conn
            .useMethod(method: request.method)
            .addHeaders(headers: request.headers)
            .connectTimeout(duration: 1000)
            .readTimeout(duration: 0)

        if (conn.method == "PUT" || conn.method == "POST" || conn.method == "PATCH") {
            conn.body(data: request.body.toByteArray())
        }
    }
    
    private func getDefaultPort(url: URL) -> Int {
        switch url.scheme {
        case "http://": return 80
        case "https://": return 443
        case "ftp://": return 20
        case "ssh://": return 22
        default: return -1
        }
    }
}
