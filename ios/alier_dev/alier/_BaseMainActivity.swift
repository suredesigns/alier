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
import SwiftUI
import WebKit

enum MainActivityError: Error {
    case invalidArgument(message: String)
}

public final class BaseMainActivity {
    public struct Config {
        var debug_mode_enabled  : Bool
        var scroll_enabled      : Bool
        var url_sync_list_access: String
        var url_download_base   : String
        var sync_session_config : URLSessionConfiguration
        var web_config          : WKWebViewConfiguration
        public init(
            debugModeEnabled  : Bool = false,
            scrollEnabled     : Bool = true,
            urlSyncListAccess : String = "",
            urlDownloadBase   : String = "",
            syncSessionConfig : URLSessionConfiguration = .ephemeral,
            webConfig         : WKWebViewConfiguration = WKWebViewConfiguration()
        ) {
            // this is needed due to the default initializer's access level is "internal" and not "public".
            self.debug_mode_enabled = debugModeEnabled
            self.scroll_enabled = scrollEnabled
            self.url_sync_list_access = urlSyncListAccess
            self.url_download_base = urlDownloadBase
            self.sync_session_config = syncSessionConfig
            self.web_config = webConfig
        }
    }
    internal static let instance = BaseMainActivity()
    private init() {
        self._alier_db = _AlierDB()
    }
    public lazy var config = Config()
    fileprivate var _fileop: _FileOperation? = nil
    fileprivate var _path_registry: _PathRegistry? = nil
    fileprivate var _internal_coordinator: _Coordinator = _Coordinator()
    fileprivate var _webView: WKWebView? = nil
    fileprivate var _native_function_interface: _NativeFunctionInterface? = nil
    fileprivate var _fetch_api = FetchApi()
    public var eventHandler: EventHandler? = nil
    public var scriptMediator: ScriptMediator {
        get {
            return self._native_function_interface! as ScriptMediator
        }
    }
    fileprivate var _launch_manager: LaunchManager = LaunchManager()
    fileprivate var launchManager: LaunchManager {
        get {
            return self._launch_manager
        }
    }
    fileprivate var _alier_db: _AlierDB? = nil
    public var alierDB: _AlierDB {
        get {
            return self._alier_db! as _AlierDB
        }
    }
    
    public var webView: WKWebView {
        get {
            return self._webView!
        }
    }
    //use local push notification: Used to launch from a notification during a cold start.
    fileprivate var coldStartFromNotification : Bool = false
    fileprivate var notificationInfo: Dictionary<String,Any>? = nil
}

/* Notes on lifecycle of SwiftUI:
 * 
 * Any UIViewRepresentable will have the following functions:
 *
 * -  makeCoordinator
 *    is called before invoking makeUIView to create a user-defined coordinator.
 * -  makeUIView
 *    is called when creating UIView for the first time.
 * -  updateUIView
 *    is called when app state changes after makeUIView is called.
 * -  dismantleUIView
 *    is called when discarding UIView. 
 *
 * Implementations of makeCoordinator and dismantleUIView are provided by UIViewRepresentable,
 * so you are not needed to implement them just for adopting the protocol requirement.
 * However, there is no default implementation for makeUIView and updateUIView,
 * Implementor of UIViewRepresentable must provide implementation of those functions.
 *
 * MainActivityDelegate provides makeUIView and updateUIView for convenience
 * and hence implementor of it shouldn't override them.
 *
 */

public protocol MainActivityDelegate: UIViewRepresentable where UIViewType == WKWebView {
    /**
     * Overrides default behavior of `updateUIView()` implemented in `MainActivityDelegate` extension.
     *
     * This method will be called from the default implementation of `updateUIView()`.
     * So, if you want to keep the default behavior,
     * you need to define a method overriding this rather than overriding `updateUIView()` directly.
     */
    func updateUIViewOverride(_ uiView: WKWebView, context: Context)
    func onInitNativeInterface(context: Context)
    func onReturningFromMainFunction(context: Context)
    func webViewConfig(context:Context, webView: WKWebView)
    func breakPoint()
}

public extension MainActivityDelegate {
    var activity: BaseMainActivity {
        get {
            return BaseMainActivity.instance
        }
    }
    var config: BaseMainActivity.Config {
        get {
            return BaseMainActivity.instance.config
        }
    }
    
    // Create a View object and set its initial state
    func makeUIView(context: Context) -> WKWebView {
        let update_needed = true
        activity._fileop = _FileOperation(update_needed: update_needed)
        activity._path_registry = _PathRegistry()
        syncViaNetwork()
        let webView = initWebView(context: context)
        initJavaScriptInterface(webView: webView)
        let ni = activity._native_function_interface!
        loadContent(webView: webView)
        AlierLog.d(id: 0, message: "makeUIView(): wait for FUNCTION_REGISTRATION_AVAILABLE")
        ni._wait("FUNCTION_REGISTRATION_AVAILABLE") {
            onInitNativeInterfaceInternal(context: context)
            
            AlierLog.d(id: 0, message: "makeUIView(): notify FUNCTION_REGISTRATION_COMPLETE")
            activity._native_function_interface!._sendstat("FUNCTION_REGISTRATION_COMPLETE")
            
            AlierLog.d(id: 0, message: "makeUIView(): wait for MAIN_FUNCTION_COMPLETE")
            activity._native_function_interface!._wait("MAIN_FUNCTION_COMPLETE") {
                AlierLog.d(id: 0, message: "makeUIView(): MAIN_FUNCTION_COMPLETE notified")
                onReturningFromMainFunctionInternal(context: context)
                //at ColdStart: The launch route when the app is started from the notification banner.
                if(BaseMainActivity.instance.coldStartFromNotification){
                    do{
                        try activity.eventHandler?.post(category: "notified", message: BaseMainActivity.instance.notificationInfo)
                        BaseMainActivity.instance.coldStartFromNotification = false
                        BaseMainActivity.instance.notificationInfo = nil
                    }catch{}
                }
            }
        }
        return webView
    }
    
    private func syncViaNetwork() {
    }
    
    private func initWebView(context: Context) -> WKWebView {
        let user_content_controller = WKUserContentController()
        activity._native_function_interface = _NativeFunctionInterface()
        
        /*
            Registering a Handler that works with Javascript
            *Note: Do this before instantiating a WebView!
         */
        let script_handler = activity._native_function_interface! as WKScriptMessageHandler
        user_content_controller.add(
            script_handler,
            name: _NativeFunctionInterface.ScriptMessageName.functionCallReceiver.rawValue
        )
        user_content_controller.add(
            script_handler,
            name: _NativeFunctionInterface.ScriptMessageName._recvstat.rawValue
        )
        config.web_config.userContentController = user_content_controller
        
        //Create an instance of WebView
        let webView = WKWebView(frame: .zero, configuration: config.web_config)
        webView.navigationDelegate = activity._internal_coordinator as WKNavigationDelegate
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.isScrollEnabled = true
        webView.scrollView.delegate = activity._internal_coordinator as UIScrollViewDelegate
        webView.scrollView.contentInsetAdjustmentBehavior = .scrollableAxes

        #if DEBUG
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
        #endif
        /**
         * Adapt the WebView display to the device screen
         */

        let script_viewport_settings = WKUserScript(
            source: """
            (function() {
                "use strict";
                var meta = document.createElement("meta");
                meta.name = "viewport";
                meta.content = "width=device-width, maximum-scale=1.0, user-scalable=no";
                document.head.appendChild(meta);
            })();
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        config.web_config.userContentController.addUserScript(script_viewport_settings)
        activity._webView = webView
        // Function to load the WebView settings added by the user
        webViewConfig(context: context, webView: webView)
        return webView
    }
    
    func webViewConfig(context: Context, webView: WKWebView) {}
    private func initJavaScriptInterface(webView: WKWebView) {
        let ni = activity._native_function_interface!
        ni.scriptEvaluator = JavaScriptEvaluator(webView: webView)
        webView.uiDelegate = ni as WKUIDelegate
    }
    
    /*
     * This function must be called after initWebView is done.
     */
    private func loadContent(webView: WKWebView) {
        let _path_registry = activity._path_registry!
        let base_html_url = _path_registry.getBaseHtmlPath()
        
        webView.loadFileURL(
            base_html_url,
            allowingReadAccessTo: _path_registry._alier_dir
        )
    }
    
    func onInitNativeInterface(context: Context) {}
    private func onInitNativeInterfaceInternal(context: Context) {
        AlierLog.d(id: -1, message: "onInitNativeInterface()")
        // registers special functions which may be used to start the framework up.
        let ni = activity._native_function_interface!
        activity.eventHandler = EventHandler(scriptMeditator: ni)
        
        initSetEnv()
        initRegisterFunction()

        breakPoint()
        onInitNativeInterface(context: context)
    }

    func onReturningFromMainFunction(context: Context) {}
    private func onReturningFromMainFunctionInternal(context: Context) {
        AlierLog.d(id: -1, message: "onReturningFromMainFunction()")
        onReturningFromMainFunction(context: context)
    }
    
    func updateUIViewOverride(_ uiView: WKWebView, context: Context) {}
    func updateUIView(_ uiView: WKWebView, context: Context) {
        updateUIViewOverride(uiView, context: context)
    }
    
    // A temporary function to set a breakPoint: override and use
    func breakPoint(){}

    func initSetEnv(){
        #if DEBUG
        try! activity.scriptMediator.callJavaScriptFunction(functionName: "setEnv", args : ["APP_BUILD", "DEBUG"], completionHandler: nil)
        #else
        try! activity.scriptMediator.callJavaScriptFunction(functionName: "setEnv", args : ["APP_BUILD", "RELEASE"], completionHandler: nil)
        #endif
        try! activity.scriptMediator.callJavaScriptFunction(functionName: "setEnv", args : ["APP_VER", Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as! String], completionHandler: nil)
        try! activity.scriptMediator.callJavaScriptFunction(functionName: "setEnv", args : ["ALIER_VER", "0.0.1"], completionHandler: nil)
        try! activity.scriptMediator.callJavaScriptFunction(functionName: "setEnv", args : ["OS_VER", UIDevice.current.systemVersion], completionHandler: nil)
        try! activity.scriptMediator.callJavaScriptFunction(functionName: "setEnv", args : ["OS_NAME", UIDevice.current.systemName], completionHandler: nil)
        try! activity.scriptMediator.callJavaScriptFunction(functionName: "setEnv", args : ["BROWSER_VER", UIDevice.current.systemVersion], completionHandler: nil)
        try! activity.scriptMediator.callJavaScriptFunction(functionName: "setEnv", args : ["PRODUCT_NAME", UIDevice.current.name], completionHandler: nil)
        try! activity.scriptMediator.callJavaScriptFunction(functionName: "setEnv", args : ["MODEL_NAME", UIDevice.current.model], completionHandler: nil)

    }

    func initRegisterFunction(){
        let ni = activity._native_function_interface!
        activity.eventHandler = EventHandler(scriptMeditator: ni)
        try! ni.registerFunction(functionName: "loadText", function: { args in
            activity._fileop!.loadText(src: args[0] as! String)
        }, completionHandler: nil)
        try! ni.registerFunction(functionName: "saveText", function: { args in
            let jsonString = args[1] as! String
            return try activity._fileop!.saveText(dst: args[0] as! String, text: jsonString, allow_overwrite: args[2] as! Bool)
        }, completionHandler: nil)
        try! ni.registerFunction(isSync: true, functionName: "loadTextSync", function: { args in
            activity._fileop!.loadText(src: args[0] as! String)
        }, completionHandler: nil)
        try! ni.registerFunction(isSync: true, functionName: "saveTextSync", function: { args in
            let jsonString = args[1] as! String
            return try activity._fileop!.saveText(dst: args[0] as! String, text: jsonString, allow_overwrite: args[2] as! Bool)
        }, completionHandler: nil)        
        try! ni.registerFunction(functionName: "fetch", function: { args in
            if (args[0] == nil) { return }
            let request  = args[0] as! Dictionary<String, Any>
            if !request.keys.contains("method") || !request.keys.contains("url") { return }
            let method   = request["method"] as! String
            let url_     = request["url"] as! String
            let body_op = request.keys.contains("body") ? request["body"] as? String : ""
            let body_ = body_op == nil ? "" : body_op!
            let headers_op = request.keys.contains("headers") ? request["headers"] as? Dictionary<String, Any> : Dictionary<String, Any>()
            let headers_ = headers_op == nil ? Dictionary<String, Any>() : headers_op!
            let url = URL(string: url_)
            let headers = Headers()
            for (key, value) in headers_ {
                if value is String {
                    headers.add(key: key, value: value as! String)
                } else {
                    do {
                        try headers.add(key: key, value: toJavaScriptValue(value))
                    } catch {
                        
                    }
                }
            }
            let content_type = headers.toDict()["content-type"]
            var body: HTTPBody
            if content_type == nil {
                body = NoContent()
            } else if ((content_type?.starts(with: "text/")) != nil){
                body = Text(body: body_)
            } else {
                body = Binary(body: ByteArray(body_.utf8))
            }
 
            return activity._fetch_api.fetch(method: method, url: url!, body: body, headers: headers).toDict()
        }, completionHandler: nil)
        try! ni.registerFunction(functionName: "setSystemEventListener", function: { args in
            let js_fn_handle = try HandleObject.from(dict: args[1] as! Dictionary<String, Any?>)
            activity.eventHandler!.addListener(category: args[0] as! String, javaScriptFunctionHandle: js_fn_handle)
            return nil
        }, completionHandler: nil)
        try! ni.registerFunction(isSync: true, functionName: "getStartupParams", function: { args in
            activity.launchManager.getStartupParams()
        }, completionHandler: nil)
        try! ni.registerFunction(isSync: true, functionName: "getLogFilter", function: { args in
            AlierLog.getLogFilter()
        }, completionHandler: nil)
        try! ni.registerFunction(isSync: true, functionName: "registerLaunchApp", function: { args in
            activity.launchManager.registerLaunchApp(name: args[0] as! String, uri: args[1] as! String)
        }, completionHandler: nil)
        try! ni.registerFunction(isSync: true, functionName: "launchOtherApp", function: { args in
            activity.launchManager.launchOtherApp(action: args[0] as! String, params: args[1] as! String)
        }, completionHandler: nil)
        try! ni.registerFunction(isSync: true, functionName: "logger", function: { args in
            if args.count < 2 { return nil }
            
            guard let log_level = args[0] as? String else { return nil }
            guard let message = args[1] as? String else { return nil }
            
            switch log_level {
            case "d":
                AlierLog.d(id: 0, message: message)
            case "i":
                AlierLog.i(id: 0, message: message)
            case "w":
                AlierLog.w(id: 0, message: message)
            case "e":
                AlierLog.e(id: 0, message: message)
            case "f":
                AlierLog.f(id: 0, message: message)
            default:
                break
            }
            return nil
        }, completionHandler: nil)
        if (activity.alierDB != nil) {
            try! ni.registerFunction(functionName: "addDB", function: { args in
                var index = 0
                guard let name = args.count > index ? args[index] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'name' is not provided")
                }
                index += 1
                guard let version_double = args.count > index ? args[index] as? Double : nil else {
                    throw MainActivityError.invalidArgument(message: "'version' is not provided")
                }
                let version = Int32(version_double)
                index += 1
                let on_configure_dict   = args.count > index ? args[index] as? [String: Any?] : nil
                let on_configure_handle = on_configure_dict == nil ? nil : try HandleObject.from(dict: on_configure_dict!)
                let on_configure: ((SQLiteDatabase) throws -> Void)? = on_configure_handle == nil ? nil : { sqlite in
                    try ni.callJavaScriptFunction(dispose: true, handle: on_configure_handle!, args: [], completionHandler: nil)
                }
                index += 1
                let on_create_dict      = args.count > index ? args[index] as? [String: Any?] : nil
                let on_create_handle    = on_create_dict    == nil ? nil : try HandleObject.from(dict: on_create_dict!   )
                let on_create: ((SQLiteDatabase) throws -> Void)? = on_create_handle == nil ? nil : { sqlite in
                    try ni.callJavaScriptFunction(dispose: true, handle: on_create_handle!, args: [], completionHandler: nil)
                }
                index += 1
                let on_upgrade_dict     = args.count > index ? args[index] as? [String: Any?] : nil
                let on_upgrade_handle   = on_upgrade_dict   == nil ? nil : try HandleObject.from(dict: on_upgrade_dict!  )
                let on_upgrade: ((SQLiteDatabase, Int32, Int32) throws -> Void)? = on_upgrade_handle == nil ? nil : { sqlite, old_version, new_version in
                    try ni.callJavaScriptFunction(dispose: true, handle: on_upgrade_handle!, args: [old_version, new_version], completionHandler: nil)
                }
                index += 1
                let on_downgrade_dict   = args.count > index ? args[index] as? [String: Any?] : nil
                let on_downgrade_handle = on_downgrade_dict == nil ? nil : try HandleObject.from(dict: on_downgrade_dict!)
                let on_downgrade: ((SQLiteDatabase, Int32, Int32) throws -> Void)? = on_downgrade_handle == nil ? nil : { sqlite, old_version, new_version in
                    try ni.callJavaScriptFunction(dispose: true, handle: on_upgrade_handle!, args: [old_version, new_version], completionHandler: nil)
                }
                index += 1
                let on_open_dict        = args.count > index ? args[index] as? [String: Any?] : nil
                let on_open_handle      = on_open_dict      == nil ? nil : try HandleObject.from(dict: on_open_dict!     )
                let on_open: ((SQLiteDatabase) throws -> Void)? = on_open_handle == nil ? nil : { sqlite in
                    try ni.callJavaScriptFunction(dispose: true, handle: on_open_handle!, args: [], completionHandler: nil)
                }

                try activity.alierDB.addDB(
                    name: name,
                    version: version,
                    onConfigure: on_configure,
                    onCreate: on_create,
                    onUpgrade: on_upgrade,
                    onDowngrade: on_downgrade,
                    onOpen: on_open
                )
                return
            }, completionHandler: nil)
            try! ni.registerFunction(functionName: "startTransaction", function: { args in
                var index = 0
                guard let name = args.count > index ? args[index] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'name' is not provided")
                }
                index += 1
                guard let mode = args.count > index ? args[index] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'mode' is not provided")
                }
                
                try activity.alierDB.startTransaction(name: name, mode: mode)
                return
            }, completionHandler: nil)
            try! ni.registerFunction(functionName: "commit", function: { args in
                guard let name = args.count >= 1 ? args[0] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'name' is not provided")
                }
                
                try activity.alierDB.commit(name: name)
                return
            }, completionHandler: nil)
            try! ni.registerFunction(functionName: "rollback", function: { args in
                guard let name = args.count >= 1 ? args[0] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'name' is not provided")
                }
                
                try activity.alierDB.rollback(name: name)
                return
            }, completionHandler: nil)
            try! ni.registerFunction(functionName: "putSavepoint", function: { args in
                var index = 0
                guard let name = args.count > index ? args[index] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'name' is not provided")
                }
                index += 1
                guard let savepoint = args.count > index ? args[index] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'savepoint' is not provided")
                }
                
                try activity.alierDB.putSavepoint(name: name, savepoint: savepoint)
                return
            }, completionHandler: nil)
            try! ni.registerFunction(functionName: "rollbackTo", function: { args in
                var index = 0
                guard let name = args.count > index ? args[index] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'name' is not provided")
                }
                index += 1
                guard let savepoint = args.count > index ? args[index] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'savepoint' is not provided")
                }
                
                try activity.alierDB.rollbackTo(name: name, savepoint: savepoint)
                return
            }, completionHandler: nil)
            try! ni.registerFunction(functionName: "execSQL", function: { args in
                var index = 0
                guard let name = args.count > index ? args[index] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'name' is not provided")
                }
                index += 1
                guard let statement = args.count > index ? args[index] as? String : nil else {
                    throw MainActivityError.invalidArgument(message: "'name' is not provided")
                }
                index += 1
                guard let params = args.count > index ? args[index] as? Array<Any?> : nil else {
                    throw MainActivityError.invalidArgument(message: "'params' is not provided")
                }
                
                let result = activity.alierDB.execute(name: name, statement: statement, params: params)
                
                return result.toDict()
            }, completionHandler: nil)
        }
        //Notification Relevance: SimpleNotification.
        //Register SimpleNotification.
        let simpleDefaultNotification = SimpleNotificationManager()
        try! ni.registerFunction(functionName: "createNotification", function: { args in
            let notificationId = simpleDefaultNotification.createNotification(payload: args[0] as! Dictionary<String,Any>, trigger: args[1] as! Dictionary<String,Any>)
            return notificationId
        }, completionHandler: nil)
   
        try! ni.registerFunction(functionName: "deleteNotification", function: { args in
            simpleDefaultNotification.deleteNotification(notificationId: args[0] as! String)
        }, completionHandler: nil)
        
        try! ni.registerFunction(functionName: "setBadgeNumber", function: { args in
            simpleDefaultNotification.setBadgeNumber(number: args[0] as! NSNumber)
        }, completionHandler: nil)
    }
}

enum LifecycleKind: Int {
    case onCreate
    case onAwake
    case onLeaveForeground
    case onEnterBackground
    case onEnterForeground
    case onActive
    case onDestroy
    
    func toDictionary() -> [String: Any?] {
        return [ "id": String(describing: self), "code": self.rawValue ]
    }
    func toDictionary(_ param: Any?) -> [String: Any?] {
        return [ "id": String(describing: self), "code": self.rawValue, "param": param ]
    }
}

/* Class for acquiring lifecycle events */
/**Detecting lifecycle events using UIApplication**/
public class LifeCycle_UIApplication: UIResponder, UIApplicationDelegate {
    public var param = "LifeCycle_UIApplication_class"
    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil
    ) -> Bool {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didFinishLaunchingNotification,
            object: nil,
            queue: .main
        ) { _ in
            if let eventHandler = BaseMainActivity.instance.eventHandler {
                try! eventHandler.post(
                    category: "lifeCycle",
                    message: LifecycleKind.onCreate.toDictionary()
                )
            }
            AlierLog.loadLogFilter()
        }
        // EventHandler nil -> Check existence when returning from back
        NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification,
            object: nil,
            queue: .main
        ) { _ in
            if let eventHandler = BaseMainActivity.instance.eventHandler {
                try! eventHandler.post(
                    category: "lifeCycle",
                    message: LifecycleKind.onEnterForeground.toDictionary()
                )
            }
        }
        // EventHandler nil -> Check existence when returning from back
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            if let eventHandler = BaseMainActivity.instance.eventHandler {
                try! eventHandler.post(
                    category: "lifeCycle",
                    message: LifecycleKind.onActive.toDictionary()
                )
            }
        }
        // Check EventHandler Check when moving background
        NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            if let eventHandler = BaseMainActivity.instance.eventHandler {
                try! eventHandler.post(
                    category: "lifeCycle",
                    message: LifecycleKind.onLeaveForeground.toDictionary()
                )
            }
        }
        
        // Check EventHandler Check when moving background
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { _ in
            if let eventHandler = BaseMainActivity.instance.eventHandler {
                try! eventHandler.post(
                    category: "lifeCycle",
                    message: LifecycleKind.onEnterBackground.toDictionary()
                )
            }
        }
        
        // Check if EventHandler exists
        NotificationCenter.default.addObserver(
            forName: UIApplication.willTerminateNotification,
            object: nil,
            queue: .main
        ) { _ in
            if let eventHandler = BaseMainActivity.instance.eventHandler {
                try! eventHandler.post(
                    category: "lifeCycle",
                    message: LifecycleKind.onDestroy.toDictionary()
                )
            }
        }
        return true
    }
    
    public func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        config.delegateClass = LifeCycle_UIScene.self
        return config
    }
}

/*Class Scene version to get lifecycle events*/
public class LifeCycle_UIScene: UIResponder, UIWindowSceneDelegate {
    public func scene(_ willConectTo: UIScene) {
        if let eventHandler = BaseMainActivity.instance.eventHandler {
            try! eventHandler.post(
                category: "lifeCycle",
                message: LifecycleKind.onCreate.toDictionary()
            )
        }
    }
    
    // Launch in task kill (shortcut)
    public func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let _ = (scene as? UIWindowScene) else { return }
        if let url = connectionOptions.userActivities.first?.webpageURL {
        }
        let activity = BaseMainActivity.instance
        if let eventHandler = activity.eventHandler {
            let shortcutItem = connectionOptions.shortcutItem
            activity.launchManager.loadStartupParams(shortcuts: shortcutItem, eventHandler: eventHandler)
        }
        
        //Process for tapping the notification banner while the app is not active.
        if let notifiedResponse = connectionOptions.notificationResponse{
            //Get notification information.
            let _userInfo = notifiedResponse.notification.request.content.userInfo
            var userInfo = _userInfo as? Dictionary<String, Any> ?? [:]
            let _data = MapAndJSONFormatter.jsonToMutableMap(jsonString: userInfo["data"] as! String)
            let data = _data["data"] as! Dictionary<String,Any>
            //Remove the trigger information as it is unnecessary.
            if(userInfo.keys.contains("trigger")){
                userInfo.removeValue(forKey: "trigger")
                userInfo["data"] = data["data"]
            }
            userInfo["data"] = data
            
            let message: Dictionary<String,Any> = ["id":"notified","param":userInfo]
            BaseMainActivity.instance.coldStartFromNotification = true
            BaseMainActivity.instance.notificationInfo = message
            //Release the persistently stored notification class information.
            if (UserDefaults.standard.string(forKey: userInfo["manageId"] as! String) != nil) {
                UserDefaults.standard.removeObject(forKey: userInfo["manageId"] as! String)
            }
        }
    }
    
    // A new app launch
    public func scene(_ scene: UIScene, didUpdate userActivity: NSUserActivity) {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb else { return }
        guard let url = userActivity.webpageURL else { return }
    }
    
    // Launch in URL (Including launch from widget)
    public func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let nsurl = URLContexts.first?.url {
            if let url = nsurl as URL? {
                let activity = BaseMainActivity.instance
                if let eventHandler = activity.eventHandler {
                    activity.launchManager.loadStartupParams(data: url, eventHandler: eventHandler)
                }
            }
        }
    }
    
    // Launch in shortcut (background)
    public func windowScene(
        _ windowScene: UIWindowScene,
        performActionFor shortcutItem: UIApplicationShortcutItem,
        completionHandler: @escaping (Bool) -> Void)
    {
        let activity = BaseMainActivity.instance
        if let eventHandler = activity.eventHandler {
            activity.launchManager.loadStartupParams(shortcuts: shortcutItem, eventHandler: eventHandler)
        }
    }
    

    
    // EventHandler nil -> Check existence when returning from back
    public func sceneWillEnterForeground(_ scene: UIScene) {
        if let eventHandler = BaseMainActivity.instance.eventHandler {
            try! eventHandler.post(
                category: "lifeCycle",
                message: LifecycleKind.onEnterForeground.toDictionary()
            )
        }
    }

    // EventHandler nil -> Check existence when returning from back
    public func sceneDidBecomeActive(_ scene: UIScene) {
        if let eventHandler = BaseMainActivity.instance.eventHandler {
            try! eventHandler.post(
                category: "lifeCycle",
                message: LifecycleKind.onActive.toDictionary()
            )
        }
    }
    
    // EventHandler exists: Check by going to the back of the app
    public func sceneWillResignActive(_ scene: UIScene) {
        if let eventHandler = BaseMainActivity.instance.eventHandler {
            try! eventHandler.post(
                category: "lifeCycle",
                message: LifecycleKind.onLeaveForeground.toDictionary()
            )
        }
    }

    // EventHandler check: Check when moving background
    public func sceneDidEnterBackground(_ scene: UIScene) {
        if let eventHandler = BaseMainActivity.instance.eventHandler {
            try! eventHandler.post(
                category: "lifeCycle",
                message: LifecycleKind.onEnterBackground.toDictionary()
            )
        }
    }
    
    public func sceneDidDisconnect(_ scene: UIScene) {
        if let eventHandler = BaseMainActivity.instance.eventHandler {
            try! eventHandler.post(
                category: "lifeCycle",
                message: LifecycleKind.onDestroy.toDictionary()
            )
        }
        if (BaseMainActivity.instance.alierDB != nil) {
            try! BaseMainActivity.instance.alierDB.close()
        }
    }
}
