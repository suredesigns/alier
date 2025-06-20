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
    UIScrollViewDelegate
{
    public override init() {}
    
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
