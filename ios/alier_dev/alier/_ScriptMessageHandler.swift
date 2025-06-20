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

//
//  ScriptMessageHandler.swift
//  TestLocalView (iOS)
//


import Foundation
import WebKit

public final class _ScriptMessageHandler: NSObject,WKScriptMessageHandler {
    
    // public weak var webView: WKWebView?
    
    public override init() {}
    
    /**JSと双方向通信を行う関数*/
    public final func userContentController(_ userContentController: WKUserContentController, didReceive message:WKScriptMessage) {
    //     let nativeFunctionAgent = _NativeFunctionAgent()
    //     //JSからの情報を受け渡し
    //     nativeFunctionAgent.message.parseMessage(didReceiveMessage: message)
    //     //ネイティブ側の関数の呼び出し
    //     let responseDate = nativeFunctionAgent.callNativeFunction()
    //    //JSに関数の結果を返す
    //     responseToJavaScript(responseDate,nativeFunctionAgent.getResolveId() )
    }

    /**JSにあるメソッドを呼び出す(これで、レスポンスを返している)Swift->JS*/
    public final func responseToJavaScript(_ resultData: String, _ id: Int) {
        // if resultData != "" {
        //     webView?.evaluateJavaScript("callbackReceiver(\([resultData]),\(id));", completionHandler: {(object, error) -> Void in
        //         print("responseState:\(String(describing: object))")
        //     })
        // } else {
        //     webView?.evaluateJavaScript("callbackReceiver(\"null\",\(id));", completionHandler: {(object, error) -> Void in
        //         print("responseState:\(String(describing: object))")
        //     })
        // }
    }
}
