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

import SwiftUI
import WebKit
import UIKit
import SafariServices

open class _Coordinator :
    NSObject,
    WKNavigationDelegate,
    UIScrollViewDelegate,
    WKURLSchemeHandler
{
    public override init() {}
    
    
    private var _fileOp: _FileOperation? = nil
    internal var fileOp: _FileOperation?{
        get {
            if(self._fileOp != nil){
                return _fileOp!
            }else{
                return nil
            }
        }
        set(fileOp) {
            self._fileOp = fileOp
        }
    }
    
    public func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let request = urlSchemeTask.request.url?.absoluteString
        var fileName: String
        if #available(iOS 16.0, *) {
            fileName = urlSchemeTask.request.url!.path()
        } else {
            // Fallback on earlier versions
            fileName = urlSchemeTask.request.url!.path
        }
        var requestData: Data? = nil
        var headers: [String: String] = [
            // Allow access from custom schemes -> Relative paths can be used
            "Access-Control-Allow-Origin": "alier://"
        ]
        var statusCode = 200
        //Check if the extension is .js
        if(urlSchemeTask.request.url?.pathExtension != "js"){
            //Extract the resource URL in Budle from the file name
            var resourceURL: URL? = nil
            do{
                resourceURL = fileOp!.getBundleURL(fileName: fileName)
                requestData = try Data(contentsOf: resourceURL!)
            }catch{
                //When content (resource data) acquisition fails
                statusCode = 404
                requestData = "Not Found \(request ?? "")".data(using: .utf8)!
            }

            //TODO: Response Header Settings: Change in media data handling
            if(fileName.contains(".json")){
                headers.updateValue("application/json; charset=utf-8", forKey: "Content-Type")
            }
            else if(fileName.contains(".css")){
                headers.updateValue("text/css; charset=utf-8", forKey: "Content-Type")
            }
            else if(fileName.contains(".html")){
                headers.updateValue("text/html; charset=utf-8", forKey: "Content-Type")
            }
            else if(fileName.contains(".gif")){
                headers.updateValue("image/gif;", forKey: "Content-Type")
            }
            else if(fileName.contains(".jpeg")){
                headers.updateValue("image/jpeg;", forKey: "Content-Type")
            }
            else if(fileName.contains(".png")){
                headers.updateValue("image/png;", forKey: "Content-Type")
            }
            else if(fileName.contains(".mp3")){
                //audio/mpeg <- mp3
                headers.updateValue("image/mpeg;", forKey: "Content-Type")
            }
            else if(fileName.contains(".aac")){
                headers.updateValue("audio/aac;", forKey: "Content-Type")
            }
            else if(fileName.contains(".wav")){
                headers.updateValue("audio/wav;", forKey: "Content-Type")
            }
            else if(fileName.contains(".mp4")){
                headers.updateValue("video/mpeg;", forKey: "Content-Type")
            }
            else{
                headers.updateValue("text/plain; charset=utf-8", forKey: "Content-Type")
            }
        }
        else{
            var path = ""
            if #available(iOS 16.0, *) {
                path = urlSchemeTask.request.url!.path()
            } else {
                path = urlSchemeTask.request.url!.path
            }
            var _contents:String? = nil
            _contents = fileOp?.loadText(src: path)
            if(_contents == nil){
                //When content (resource data) acquisition fails
                statusCode = 404
                requestData = "Not Found \(fileName)".data(using: .utf8)!
            }else{
                requestData = _contents!.data(using: .utf8)
            }
            // Response Header Settings: Content-Type to be recognized as a JavaScript module
            headers.updateValue("application/javascript; charset=utf-8", forKey: "Content-Type")
        }
        let httpURLResponse = HTTPURLResponse(
            url:  urlSchemeTask.request.url!,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        )
        urlSchemeTask.didReceive(httpURLResponse!)
        urlSchemeTask.didReceive(requestData!)
        urlSchemeTask.didFinish()
    }
    
    public func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
    
    // access control
    open func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
       
        /*
         * Processing when a specific link in WebView is tapped
         * If this is not set, the app will crash
         * .allow  : Allow loading
         * .cancel : Cancel loading
         */
        let url = navigationAction.request.url
        // This is called between tapping a link and loading a page, so for example, you can check the URL and perform branching processing.
        
        #warning("ToDo: If there is a future process for displaying web pages in Sheet or identifying paths to pass through.")
        
        
        // Same method as Android
        /**On the Android side, for the time being, we suppress page loading in WebView and call a function that only has the function of launching the app.**/
        decisionHandler(.allow)

    }
    
    //Launch other applications. If it is a site link, launch the browser app.
    open func launchOtherApp(url: String ){
        UIApplication.shared.open(URL(string: url)!, options: [:])
    }
}

