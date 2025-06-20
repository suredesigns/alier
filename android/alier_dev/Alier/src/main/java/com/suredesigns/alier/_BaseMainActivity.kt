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

package com.suredesigns.alier

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.suredesigns.alier.net.http.data.Binary
import com.suredesigns.alier.net.http.data.Headers
import com.suredesigns.alier.net.http.data.NoContent
import com.suredesigns.alier.net.http.data.ResponseData
import com.suredesigns.alier.net.http.data.Text
import com.suredesigns.alier.net.http.fetch.FetchApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import java.io.InputStream
import java.net.URL
import java.util.Properties

open class BaseMainActivity (
    @Suppress("MemberVisibilityCanBePrivate")
    val config: Config = Config()
): AppCompatActivity() {
    companion object {
        private val _ni = _NativeFunctionInterface()
        private val _event_handler = EventHandler(_ni)
        @Suppress("SpellCheckingInspection")
        private lateinit var _fileop: _FileOperation
        private lateinit var _path_registry: _PathRegistry
        @SuppressLint("StaticFieldLeak")
        private var _webview: WebView? = null
        private var _launch_manager = _LaunchManager()
        private lateinit var _alier_db: _AlierDB
        private val _fetch_api = FetchApi()
        internal val eventHandler = _event_handler
    }

    @Suppress("EnumEntryName")
    enum class LifecycleKind {
        onCreate,
        onAwake,
        onLeaveForeground,
        onEnterBackground,
        onEnterForeground,
        onActive,
        onDestroy,
        ;
        fun toMap(): Map<String, Any?> =
            mapOf("id" to name, "code" to ordinal.toString())
        fun toMap(param: Any?): Map<String, Any?> =
            mapOf("id" to name, "code" to ordinal.toString(), "param" to param)
    }
    @Suppress("EnumEntryName")
    enum class HardwareKind {
        onBackPressed,
        ;
        fun toMap(): Map<String, Any?> =
            mapOf("id" to name, "code" to ordinal.toString())
        fun toMap(param: Any?): Map<String, Any?> =
            mapOf("id" to name, "code" to ordinal.toString(), "param" to param)
    }

    data class Config(
        val debugModeEnabled: Boolean = false,
        val scrollAllowed: Boolean = true,
        val urlSyncListAccess: String = ""
    )

    private val _scope = CoroutineScope(Dispatchers.Default)
    private var _internal_coordinator: _Coordinator? = null

    lateinit private var simpleDefaultNotification: SimpleNotificationManager

    @Suppress("unused")
    val eventHandler: EventHandler
        get() {
            return _event_handler
        }

    val scriptMediator: ScriptMediator
        get() {
            return _ni
        }

    @Suppress("unused")
    val webClient: _Coordinator?
        get() {
            return _internal_coordinator
        }

    @Suppress("unused")
    val webSettings: WebSettings
        get() {
            return _webview!!.settings
        }

    @Suppress("unused")
    val launchManager: _LaunchManager
        get() {
            return _launch_manager
        }
    val alierDB: _AlierDB
        get() {
            return _alier_db
        }

    init {
        WebView.setWebContentsDebuggingEnabled(config.debugModeEnabled)
    }

    /**
     * Opens the specified file as an [InputStream].
     *
     * @param filePath
     * A string representing the file path.
     * The path is relative to the root of the app specific directory named `app_res`.
     *
     * @return
     * An [InputStream] or `null` if the specified file does not exist.
     */
    fun openFile(filePath: String): InputStream? {
        val file = _path_registry.getFilePath(filePath) ?: return null

        return file.inputStream()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val initialized = _webview != null

        handleIntent(this.intent, initialized)

        if (initialized) {
            setContentView(_webview)
            _launch_manager.loadStartupParams(intent, _event_handler)
            return
        }

        AlierLog.loadLogFilter(assets)
        AlierLog.d(0, "onCreate")

        // TODO: This to be calculated from difference between the current version and the previous version.
        val update_needed = true
        _fileop = _FileOperation(this.applicationContext, update_needed)

        _path_registry = _PathRegistry(this.applicationContext)

        syncViaNetwork()

        initWebView()
        _webview!!.loadUrl(_path_registry.getBaseHtmlPath().path)

        _scope.launch {
            async {
                _ni.wait("FUNCTION_REGISTRATION_AVAILABLE")
            }.await()
            async {
                initSetEnv()
                initRegisterFunction()
            }.await()
            onInitNativeInterface()
            _ni.sendstat("FUNCTION_REGISTRATION_COMPLETE")
            async { _ni.wait("MAIN_FUNCTION_COMPLETE") }.await()
            _event_handler.post(
                category = "lifeCycle",
                message = LifecycleKind.onCreate.toMap()
            )
            _event_handler.post(
                category = "lifeCycle",
                message = LifecycleKind.onAwake.toMap(_launch_manager.getStartupParams())
            )

            val callback: OnBackPressedCallback = object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    _event_handler.post(
                        category = "hardware",
                        message = HardwareKind.onBackPressed.toMap()
                    )
                }
            }
            onBackPressedDispatcher.addCallback(callback)

            onReturningFromMainFunction()

            // Check if the Intent came from a notification trigger.
            val notificationIntent = intent.getStringExtra("notification")
            if(notificationIntent != null && notificationIntent == "received"){
                val className = intent.getStringExtra("class_name")
                val notificationData = intent.getStringExtra("manage_id")
                var classInfo = NotificationBase::class.java
                if(className != null){
                    classInfo = Class.forName(className) as Class<NotificationBase>
                }
                val notificationIntent = Intent(baseContext, classInfo).apply {
                    action = "com.example.NOTIFICATION_CLICKED"
                }
                notificationIntent.putExtra("manage_id",notificationData)
                //Launch BroadcastReceiver of NotificationIntent
                sendBroadcast(notificationIntent)
            }


        }

        // TODO: use db check
        if (true) {
            _alier_db = _AlierDB(this)
        }

        _launch_manager.loadStartupParams(intent, _event_handler)
    }

    /**
     * Callback invoked before executing the main function defined in the main module script.
     *
     * You can override this if you need for registering JavaScript interfaces of your native functions
     * which to be used in the main function or after executing it.
     *
     * To register a function, use [ScriptMediator.registerFunction].
     *
     * @see [ScriptMediator.registerFunction]
     */
    open fun onInitNativeInterface() {
        AlierLog.d(0, "onInitNativeInterface()")
    }

    /**
     * Callback invoked after returning from the main function defined in the main module script.
     *
     * You can override this if you need to do some additional works
     * just after invocation of the main function is complete.
     */
    open fun onReturningFromMainFunction() {
        AlierLog.d(0, "onReturningFromMainFunction()")
    }

    /**
     * Synchronize resources via HTTP connection if the HTTP URL locating the list of resources to be sync'ed.
     *
     * TODO: Implement this.
     */
    private fun syncViaNetwork() {
        AlierLog.d(0, "syncViaNetwork")
        // Implementation is likely to be the following:
        // 1.  Test whether or not the URL is given
        //     and then test whether or not the URL is a valid HTTP(S) URL.
        // 2.  If a valid HTTP(S) URL was given,
        //     then make a HTTP connection and get the resource from the URL.
        // 3.  Check whether the resource list exists in the App-specific storage or not.
        //     And if the list exists, do synchronize each of listed resources.
        //
        // Note that, in generally speaking, to reduce network traffic,
        // the app must keep each of etags lastly received from the Server if etag is available.
        // Here we encounter the question that who is responsible for such communication?
        // App developer must implement server-side application in this case,
        // so how the server respond is completely depending on the App developer and not the framework.

    }

    /**
     * Initialize [WebView].
     */
    @SuppressLint("ClickableViewAccessibility", "SetJavaScriptEnabled")
    private fun initWebView(): WebView {
        AlierLog.d(0, "initWebView")

        val webview = WebView(this)
        setContentView(webview)

        val settings = webview.settings

        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.builtInZoomControls = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.javaScriptCanOpenWindowsAutomatically = true
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true

        val client: _Coordinator = makeCoordinator(this)

        webview.webViewClient = client

        // Disable if `scroll_enabled` flag is false by preventing default handler when ACTION_MOVE is fired.
        if (!config.scrollAllowed) {
            // This will cause the "ClickableViewAccessibility" warning which points out that
            // View.performClick not overridden.
            // However it can be ignored because the custom touch event listener defined below
            // will consume only ACTION_MOVE and ACTION_MOVE will not cause click event by default.
            // So it is considered safe to suppress the warning.
            webview.setOnTouchListener { _: View, event: MotionEvent ->
                when (event.action) {
                    MotionEvent.ACTION_MOVE -> true
                    else -> false
                }
            }
        }

        _ni.scriptEvaluator = JavaScriptEvaluator(webview)
        webview.addJavascriptInterface(_ni, "Android")

        _internal_coordinator = client
        _webview = webview

        return webview
    }

    private fun handleIntent(intent: Intent, initialized: Boolean) {
        // Get startup parameters when launched by URL and other apps and push notification
        val data: Uri? = intent.data
        if (data != null) {
            AlierLog.d(5000, "Intent param = ${data.schemeSpecificPart}")
        }
    }

    // Called when the closed app is reopened, and post onStart message to JS side.
    override fun onStart() {
        super.onStart()
        _event_handler.post(
            category = "lifeCycle",
            message = LifecycleKind.onEnterForeground.toMap()
        )
    }

    // Called when the closed app is reopened, and post onResume message to JS side.
    override fun onResume() {
        super.onResume()
        _event_handler.post(
            category = "lifeCycle",
            message = LifecycleKind.onActive.toMap()
        )
    }

    // Called when the screen is closed, and post onPause message to JS side.
    override fun onPause() {
        super.onPause()
        _event_handler.post(
            category = "lifeCycle",
            message = LifecycleKind.onLeaveForeground.toMap()
        )
    }

    // Called when the screen is closed, and post onStop message to JS side.
    override fun onStop() {
        super.onStop()
        _event_handler.post(
            category = "lifeCycle",
            message = LifecycleKind.onEnterBackground.toMap()
        )
    }

    // this function doesn't post destroy message to JS side.
    override fun onDestroy() {
        super.onDestroy()
        _event_handler.post(
            category = "lifeCycle",
            message = LifecycleKind.onDestroy.toMap()
        )
        val webview = _webview
        if (webview != null) {
            (webview.parent as ViewGroup).removeView(webview)
        }

        // TODO: isInitialized cannot be used
        if (_alier_db != null) {
            _alier_db.close()
        }
    }

    // Register environment variables
    private fun initSetEnv() {
        val ni = _ni

        val build = if (Build.VERSION.CODENAME != "REL") { "DEBUG" } else { "RELEASE" }

        val meta_inf = Properties()
        val meta_inf_res = BaseMainActivity::class.java.classLoader?.getResourceAsStream("META-INF/alier.properties")
        if (meta_inf_res != null) {
            meta_inf.load(meta_inf_res)
        }
        val alier_version_name = meta_inf.getProperty("versionName", "0.0.0")
        val alier_version_code = meta_inf.getProperty("versionCode", "0")

        val context = this.applicationContext
        val app_info = context.packageManager.getPackageInfo(context.packageName, 0)
        val app_version_name = app_info.versionName

        _scope.launch {
            ni.callJavaScriptFunction(functionName = "setEnv", args = arrayOf("APP_BUILD" , build))
            ni.callJavaScriptFunction(functionName = "setEnv", args = arrayOf("ALIER_VER" , alier_version_name))
            ni.callJavaScriptFunction(functionName = "setEnv", args = arrayOf("ALIER_VER_CODE", alier_version_code))
            ni.callJavaScriptFunction(functionName = "setEnv", args = arrayOf("OS_VER" , Build.VERSION.RELEASE))
            ni.callJavaScriptFunction(functionName = "setEnv", args = arrayOf("OS_NAME" , "Android"))
            ni.callJavaScriptFunction(functionName = "setEnv", args = arrayOf("MODEL_NAME" , Build.MODEL))
            ni.callJavaScriptFunction(functionName = "setEnv", args = arrayOf("PRODUCT_NAME" , Build.PRODUCT))
            ni.callJavaScriptFunction(functionName = "setEnv", args = arrayOf("APP_VER" , app_version_name))
        }
    }

    //Register native functions
    private suspend fun initRegisterFunction() {
        val activity = this

        _ni.registerFunction(functionName = "saveText", function = { args ->
            _fileop.saveText(args[0].toString(), args[1].toString(), args[2] as Boolean)
        })
        _ni.registerFunction(functionName = "loadText", function = { args ->
            _fileop.loadText(args[0] as String)
        })
        _ni.registerFunction(isSync = true, functionName = "saveTextSync", function = { args ->
            _fileop.saveText(args[0].toString(), args[1].toString(), args[2] as Boolean)
        })
        _ni.registerFunction(isSync = true, functionName = "loadTextSync", function = { args ->
            _fileop.loadText(args[0] as String)
        })
        _ni.registerFunction(functionName = "fetch", function = { args ->
            val request  = args[0] as? Map<*, *> ?: return@registerFunction null
            val method   = request["method"] as? String ?: return@registerFunction null
            val url_     = request["url"] as? String ?: return@registerFunction null
            val body_    = request["body"] as? String ?: ""
            val headers_ = request["headers"] as? Map<*, *> ?: mapOf<String, String>()
            val url = URL(url_)
            val headers = Headers()
            for ((key, value) in headers_) {
                if (key is String) {
                    if (value is String) {
                        headers.add(key, value)
                    } else {
                        headers.add(key, toJavaScriptValue(value))
                    }
                }
            }
            val content_type = headers["content-type"]

            val body = if (content_type == null) {
                NoContent()
            } else if (content_type.startsWith("text/")) {
                Text(body_)
            } else {
                Binary(body_)
            }
            try {
                return@registerFunction _fetch_api.fetch(method, url, body, headers).toMap()
            } catch (e: Exception) {
                AlierLog.e(0, e.stackTraceToString())
                val error_headers = Headers()
                    .add("content-type", "application/json")
                val error_body = """{"error":{"message":"Unexpected Error"}}""".encodeToByteArray()
                return@registerFunction ResponseData(400, "Unexpected Error", error_headers, error_body).toMap()
            }
        })
        _ni.registerFunction(
            isSync = true,
            functionName = "getStartupParams",
            function = { _launch_manager.getStartupParams() }
        )
        _ni.registerFunction(
            isSync = true,
            functionName = "getUriHost",
            function = { _launch_manager.getUriHost() }
        )
        _ni.registerFunction(
            isSync = true,
            functionName = "registerLaunchApp",
            function = { args ->
                _launch_manager.registerLaunchApp(args[0] as String, args[1] as String)
            }
        )
        _ni.registerFunction(
            isSync = true,
            functionName = "launchOtherApp",
            function = { args ->
                _launch_manager.launchOtherApp(activity, args[0] as String, args[1] as String)
            }
        )
        _ni.registerFunction(
            isSync = true,
            functionName = "getLogFilter",
            function = { AlierLog.getLogFilter() }
        )
        // Register a function to receive events on the Alier side, such as lifecycle.
        _ni.registerFunction(
            functionName = "setSystemEventListener",
            function = { args ->
                val js_fn_handle = HandleObject.from(map = args[1] as Map<String, Any?>)

                _event_handler.addListener(
                    category = args[0].toString(),
                    javaScriptFunctionHandle = js_fn_handle
                )
            }
        )
        _ni.registerFunction(
            isSync = true,
            functionName = "logger",
            function = { args ->
                if (args.size < 2) { return@registerFunction null }
                val log_level = args[0] as? String ?: return@registerFunction  null
                val message = args[1] as? String ?: return@registerFunction  null

                when (log_level) {
                    "d" -> { AlierLog.d(0, message) }
                    "i" -> { AlierLog.i(0, message) }
                    "w" -> { AlierLog.w(0, message) }
                    "e" -> { AlierLog.e(0, message) }
                    "f" -> { AlierLog.f(0, message) }
                }

                return@registerFunction null
            }
        )
        if (_alier_db != null) {
            _ni.registerFunction(
                functionName = "addDB",
                function = { args ->
                    val name    = args[0] as String
                    val version = (args[1] as Number).toInt()
                    val on_configure = if (args.size > 2 && args[2] != null) {
                        val handle = HandleObject.from(args[2] as Map<String, Any?>)
                        OnConfigure {
                            _ni.callJavaScriptFunction(
                                dispose = true,
                                handle = handle,
                                args = arrayOf(),
                                completionHandler = null
                            )
                        }
                    } else {
                        null
                    }
                    val on_create    = if (args.size > 3 && args[3] != null) {
                        val handle = HandleObject.from(args[3] as Map<String, Any?>)
                        OnCreate {
                            _ni.callJavaScriptFunction(
                                dispose = true,
                                handle = handle,
                                args = arrayOf(),
                                completionHandler = null
                            )
                        }
                    } else {
                        null
                    }
                    val on_upgrade   = if (args.size > 4 && args[4] != null) {
                        val handle = HandleObject.from(args[4] as Map<String, Any?>)
                        OnUpgrade { _, old_version, new_version ->
                            _ni.callJavaScriptFunction(
                                dispose = true,
                                handle = handle,
                                args = arrayOf(old_version, new_version),
                                completionHandler = null
                            )
                        }
                    } else {
                        null
                    }
                    val on_downgrade = if (args.size > 5 && args[5] != null) {
                        val handle = HandleObject.from(args[5] as Map<String, Any?>)
                        OnDowngrade { _, old_version, new_version ->
                            _ni.callJavaScriptFunction(
                                dispose = true,
                                handle = handle,
                                args = arrayOf(old_version, new_version),
                                completionHandler = null
                            )
                        }
                    } else {
                        null
                    }
                    val on_open      = if (args.size > 6 && args[6] != null) {
                        val handle = HandleObject.from(args[6] as Map<String, Any?>)
                        OnOpen { _ ->
                            _ni.callJavaScriptFunction(
                                dispose = true,
                                handle = handle,
                                args = arrayOf(),
                                completionHandler = null
                            )
                        }
                    } else {
                        null
                    }
                    _alier_db.addDB(
                        name,
                        version,
                        onConfigure = on_configure,
                        onCreate = on_create,
                        onUpgrade = on_upgrade,
                        onDowngrade = on_downgrade,
                        onOpen = on_open
                    )
                }
            )
            _ni.registerFunction(
                functionName = "startTransaction",
                function = { args ->
                    val name = args[0] as String
                    val mode = args[1] as String

                    alierDB.startTransaction(name, mode)
                }
            )
            _ni.registerFunction(
                functionName = "commit",
                function = { args ->
                    val name = args[0] as String

                    alierDB.commit(name)
                }
            )
            _ni.registerFunction(
                functionName = "rollback",
                function = { args ->
                    val db_name = args[0] as String

                    alierDB.rollback(db_name)
                }
            )
            _ni.registerFunction(
                functionName = "putSavepoint",
                function = { args ->
                    val name      = args[0] as String
                    val savepoint = args[1] as String

                    alierDB.putSavepoint(name, savepoint)
                }
            )
            _ni.registerFunction(
                functionName = "rollbackTo",
                function = { args ->
                    val name      = args[0] as String
                    val savepoint = args[1] as String

                    alierDB.rollbackTo(name, savepoint)
                }
            )
            _ni.registerFunction(
                functionName = "execSQL",
                function = { args ->
                    val name      = args[0] as String
                    val statement = args[1] as String
                    val params    = args[2] as Array<Any?>

                    alierDB.execute(name, statement, params).toMap()
                }
            )
            _ni.registerFunction(
                functionName = "insertRecords",
                function = { args ->
                    val name       = args[0] as String
                    val table      = args[1] as String
                    val batch_size = (args[2] as Number).toInt()
                    val records    = args[3] as Array<Array<Any?>>

                    alierDB.insert(name, table, batch_size, records).toMap()
                }
            )
        }
        //Notification Relevance: SimpleNotification.
        //Register SimpleNotification
        val notificationCheck = checkPermission("android.permission.POST_NOTIFICATIONS")
        if(notificationCheck){
            simpleDefaultNotification = SimpleNotificationManager(this)
            val createNotification: (Array<out Any?>) -> Any? = { args ->
                val notificationId = this.simpleDefaultNotification.createNotification(args[0] as MutableMap<String,Any>,args[1] as MutableMap<String,Any>)
                notificationId
            }
            _ni.registerFunction(
                false,
                "createNotification",
                createNotification
            )
            //Delete Notification
            val deleteNotification: (Array<out Any?>) -> Any? = { args ->
                this.simpleDefaultNotification.deleteNotification(this,args[0] as String)
            }
            _ni.registerFunction(
                false,
                "deleteNotification",
                deleteNotification
            )
            //Set Badge: do nothing at Android
            val setBadgeNumber: (Array<out Any?>) -> Any? = { args ->
                this.simpleDefaultNotification.setBadgeNumber(args[0] as Number)
            }
            _ni.registerFunction(
                false,
                "setBadgeNumber",
                setBadgeNumber
            )
        }
    }
    private fun checkPermission(permission: String): Boolean {
        return try {
            this.packageManager.getPackageInfo(this.packageName, PackageManager.GET_PERMISSIONS).requestedPermissions?.contains(permission) == true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }
}

