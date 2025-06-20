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

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.util.concurrent.Executors
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

private const val DOUBLE_PRECISION = 53
private const val MAX_SAFE_INTEGER = ((1L shl DOUBLE_PRECISION) - 1L)
private const val MIN_SAFE_INTEGER = (-MAX_SAFE_INTEGER)

/**
 * Converts a `String` to a JavaScript string literal.
 *
 * This method adds double quotation signs as a prefix and a suffix
 * and escape intermediate double quotation signs.
 *
 * @return a String representing a JavaScript string literal equivalent to the given value
 */
private fun toJavaScriptValue(value: String): String {
    val result = StringBuilder()
    result.append('"')
    var first = '\u0000'
    for (second in value) {
        val escaped = (first == '\\')
        when (second) {
            '\n' -> {
                result.append("\\n")
            }
            '\r' -> {
                result.append("\\r")
            }
            '\t' -> {
                result.append("\\t")
            }
            '\"' -> {
                if (escaped) {
                    result.append("\\\\\"")
                } else {
                    result.append("\\\"")
                }
            }
            else -> {
                if (escaped) {
                    result.append('\\')
                }
                result.append(second)
            }
        }
        first = second
    }
    if (first == '\\') {
        result.append('\\')
    }
    result.append('"')
    return result.toString()
}

private fun toJavaScriptValue(v: Char): String {
    return toJavaScriptValue(v.toString())
}

private fun toJavaScriptValue(v: Boolean): String {
    return if (v) { "true" } else { "false" }
}

/**
 * Converts a `Int` to a JavaScript numeric literal.
 *
 * If the given value is equal to `Int.MIN_VALUE`,
 * because negation of `Int.MIN_VALUE` equals to `Int.MIN_VALUE` itself,
 * this will implicitly convert the value to `Long` and then call [toJavaScriptValue].
 *
 * Note that `Int` is a SIGNED integral type and hence
 * this method will return a number literal with minus sign if the value is negative.
 * If you want to UNSIGNED one, you should convert the value to unsigned integral and then
 * call `toJavaScriptLiteral`.
 *
 * @return a String representing a JavaScript hexadecimal numeric literal equivalent to the given value
 * @see toJavaScriptValue
 */
private fun toJavaScriptValue(v: Int): String {
    return if (v >= 0) {
        String.format(null, "0x%x", v)
    } else if (v == Int.MIN_VALUE) {
        toJavaScriptValue(v.toLong())
    } else { // :: not MIN_VALUE but negative
        // String.format will convert a negative number to its 2's complement,
        // so to negate the given value before formatting is needed.
        String.format(null, "-0x%x", -v)
    }
}

/**
 * Converts a `Long` to a JavaScript numeric literal.
 *
 * If the given value is greater than the `MAX_SAFE_INTEGER` or is less than the `MIN_SAFE_INTEGER`,
 * the resulting value mayn't be accurately parsed in JavaScript land
 * because the Number literal will be converted into a 64-bit floating point number
 * but it only has 53 bits precision.
 *
 * Note that `Long` is a SIGNED integral type and hence
 * this method will return a number literal with minus sign if the value is negative.
 * If you want to UNSIGNED one, you should convert the value to unsigned integral and then
 * call `toJavaScriptLiteral`.
 *
 * @return a String representing a JavaScript hexadecimal numeric literal equivalent to the given value
 * @see toJavaScriptValue
 */
private fun toJavaScriptValue(v: Long): String {
    return if (v >= 0) {
        if (v > MAX_SAFE_INTEGER) {
            AlierLog.w(id = 1000, message =
                """
                toJavaScriptValue(): 
                The given value exceeds MAX_SAFE_INTEGER (= 2^53 - 1)!
                The value may be rounded to be fitted into floating point number representation.
                """.trimIndent()
            )
        }
        String.format(null, "0x%x", v)
    } else {
        // String.format will convert a negative number to its 2's complement,
        // so to negate the given value before formatting is needed.
        if (v < MIN_SAFE_INTEGER) {
            AlierLog.w(id = 1000, message =
                """
                toJavaScriptValue(): 
                The given value is less than MIN_SAFE_INTEGER (= -(2^53 - 1))!
                The value may be rounded to be fitted into floating point number representation.
                """.trimIndent()
            )
        }
        if (v == Long.MIN_VALUE) {
            v.toDouble().toString()
        } else {
            String.format(null, "-0x%x", -v)
        }
    }
}

/**
 * Converts a `UInt` to a JavaScript numeric literal.
 *
 * @return a String representing a JavaScript hexadecimal numeric literal equivalent to the given value
 * @see toJavaScriptValue
 */
private fun toJavaScriptValue(v: UInt): String {
    return String.format(null, "0x%x", v)
}

/**
 * Converts a `ULong` to a JavaScript numeric literal.
 *
 * If the given value is greater than the `MAX_SAFE_INTEGER`,
 * the resulting value mayn't be accurately parsed in JavaScript land
 * because the Number literal will be converted into a 64-bit floating point number
 * but it only has 53 bits precision.
 *
 * @return a String representing a JavaScript hexadecimal numeric literal equivalent to the given value
 * @see toJavaScriptValue
 */
private fun toJavaScriptValue(v: ULong): String {
    if (v > MAX_SAFE_INTEGER.toULong()) {
        AlierLog.w(id = 1000, message =  """
             toJavaScriptValue(): 
             The given value exceeds MAX_SAFE_INTEGER (= 2^53 - 1)!
             The value may be rounded to be fitted into floating point number representation.
             """.trimIndent())
    }
    return String.format(null, "0x%x", v)
}

/**
 * Converts a `Double` to an equivalent JavaScript expression.
 *
 * @return a String representing a JavaScript expression equivalent to the given floating point number.
 */
private fun toJavaScriptValue(v: Double): String {
    if (v.isNaN()) {
        return "NaN"
    }
    return when (v) {
        Double.POSITIVE_INFINITY -> "Number.POSITIVE_INFINITY"
        Double.NEGATIVE_INFINITY -> "Number.NEGATIVE_INFINITY"
        else                     -> v.toString()
    }
}

/**
 * Converts a `Float` to an equivalent JavaScript expression.
 *
 * @return a String representing a JavaScript expression equivalent to the given floating point number.
 */
private fun toJavaScriptValue(v: Float): String {
    if (v.isNaN()) {
        return "NaN"
    }
    return when (v) {
        Float.POSITIVE_INFINITY -> "Number.POSITIVE_INFINITY"
        Float.NEGATIVE_INFINITY -> "Number.NEGATIVE_INFINITY"
        else                    -> v.toDouble().toString()
    }
}

/**
 * Tries to convert the given value to a JavaScript expression or literal.
 *
 * If the value's type is unsupported, then `UnsupportedOperationException` will be thrown.
 *
 * @throws [IllegalArgumentException] when unsupported typed value was given.
 */
fun <T> toJavaScriptValue(value: T): String {
    if (value == null || value == JSONObject.NULL) {
        return "null"
    }
    return when(value) {
        is Unit    -> "undefined"
        is Boolean -> toJavaScriptValue(value)
        is Byte    -> toJavaScriptValue(value.toInt())
        is Short   -> toJavaScriptValue(value.toInt())
        is Int     -> toJavaScriptValue(value)
        is Long    -> toJavaScriptValue(value)
        is UByte   -> toJavaScriptValue(value.toInt())
        is UShort  -> toJavaScriptValue(value.toInt())
        is UInt    -> toJavaScriptValue(value)
        is ULong   -> toJavaScriptValue(value)
        is Float   -> toJavaScriptValue(value)
        is Double  -> toJavaScriptValue(value)
        is Char    -> toJavaScriptValue(value.toString())
        is String  -> toJavaScriptValue(value)
        is Pair<*,*> -> toJavaScriptValue(value)
        is Triple<*,*,*> -> toJavaScriptValue(value)
        is androidx.core.util.Pair<*,*> -> toJavaScriptValue(value)
        is android.util.Pair<*,*> -> toJavaScriptValue(value)
        is Map<*,*> -> toJavaScriptValue(value)
        is Array<*> -> toJavaScriptValue(value)
        is Iterable<*> -> toJavaScriptValue(value)
        else       ->
            throw IllegalArgumentException(
                "This object cannot be converted to a JavaScript expression."
            )
    }
}

/**
 * Converts an `Array` to a JavaScript's Array literal.
 */
private fun toJavaScriptValue(v: Array<*>): String {
    return v.joinToString(",", "[", "]") {
        toJavaScriptValue(it)
    }
}

/**
 * Converts an `Iterable` to a JavaScript's Array literal.
 */
private fun toJavaScriptValue(v: Iterable<*>): String {
    return v.joinToString(",", "[", "]") {
        toJavaScriptValue(it)
    }
}

/**
 * Converts a `kotlin.Pair` to a JavaScript's Array literal.
 */
private fun toJavaScriptValue(v: Pair<*, *>): String {
    return "[${toJavaScriptValue(v.first)},${toJavaScriptValue(v.second)}]"
}

/**
 * Converts an `androidx.core.util.Pair` to a JavaScript's Array literal.
 */
private fun toJavaScriptValue(v: androidx.core.util.Pair<*, *>): String {
    return "[${toJavaScriptValue(v.first)},${toJavaScriptValue(v.second)}]"
}

/**
 * Converts an `android.util.Pair` to a JavaScript's Array literal.
 */
private fun toJavaScriptValue(v: android.util.Pair<*, *>): String {
    return "[${toJavaScriptValue(v.first)},${toJavaScriptValue(v.second)}]"
}

/**
 * Converts an `kotlin.Triple` to a JavaScript's Array literal.
 */
private fun toJavaScriptValue(v: Triple<*, *, *>): String {
    return "[${toJavaScriptValue(v.first)},${toJavaScriptValue(v.second)},${toJavaScriptValue(v.third)}]"
}

/**
 * Converts a `Map` to a JavaScript's Array literal if the key type is numeric,
 * otherwise converts to an Object literal.
 */
private fun toJavaScriptValue(v: Map<*, *>): String {
    if (v.isEmpty()) {
        return "({})"
    }
    var key_type = "Number"
    for ((key, _) in v) {
        if (key == null) { continue }
        if (key is Long  || key is Int  || key is Short  || key is Byte ||
            key is ULong || key is UInt || key is UShort || key is UByte
        ) {
            continue
        }
        key_type = "String"
        break
    }
    return if (key_type == "String") {
        val sb = StringBuilder()
        sb.append('{')
        for ((key, value) in v) {
            if (key == null || value is Unit) { continue }
            sb.append("${toJavaScriptValue(key)}:${toJavaScriptValue(value)},")
        }
        if (sb.length > 1) {
            sb.deleteAt(sb.lastIndex)
        }
        sb.append('}')
        sb.toString()
    } else {
        toJavaScriptValue(v.toList())
    }
}

/**
 * Converts the given object to an equivalent typed with standard classes.
 *
 * Conversion will be done as follows:
 * -  `JSONArray`        -> `Array<Any?>`,
 * -  `JSONObject`       -> `Map<string, Any?>`
 * -  `JSONObject.NULL`  -> `null`
 * -  `"undefined"`      -> `Unit`
 * -  `"NaN"`            -> `Double.NaN`
 * -  `"Infinity"`
 * -  `"-Infinity"`      -> `Double.NEGATIVE_INFINITY`
 * -   otherwise, as-is
 */
private fun unwrapJson(v: Any?): Any? {
    return when (v) {
        is JSONArray -> {
            val arr = Array<Any?>(v.length()) {}
            for (i in 0 until v.length()) {
                arr[i] = unwrapJson(v[i])
            }
            arr
        }
        is JSONObject -> {
            val map = mutableMapOf<String, Any?>()
            for (k in v.keys()) {
                map[k] = unwrapJson(v[k])
            }
            map.toMap()
        }
        is Number       -> v.toDouble()
        JSONObject.NULL -> null
        "null"          -> null
        "undefined"     -> Unit
        "NaN"           -> Double.NaN
        "Infinity"      -> Double.POSITIVE_INFINITY
        "-Infinity"     -> Double.NEGATIVE_INFINITY
        else            -> v
    }
}

private fun asJson(v: Any?): String {
    val json = when (v) {
        null                     -> "null"
        JSONObject.NULL          -> "null"
        Unit                     -> "\"undefined\""
        Double.NaN               -> "\"NaN\""
        Float.NaN                -> "\"NaN\""
        Double.POSITIVE_INFINITY -> "\"Infinity\""
        Float.POSITIVE_INFINITY  -> "\"Infinity\""
        Double.NEGATIVE_INFINITY -> "\"-Infinity\""
        Float.NEGATIVE_INFINITY  -> "\"-Infinity\""
        is Boolean     -> if (v) "true" else "false"
        is Byte        -> v.toString(10)
        is Short       -> v.toString(10)
        is Int         -> v.toString(10)
        is Long        -> v.toString(10)
        is UByte       -> v.toString(10)
        is UShort      -> v.toString(10)
        is UInt        -> v.toString(10)
        is ULong       -> v.toString(10)
        is Float       -> v.toString()
        is Double      -> v.toString()
        is String      -> toJavaScriptValue(v)
        is Char        -> toJavaScriptValue(v.toString())
        is Pair<*,*> -> {
            "[${asJson(v.first)},${asJson(v.second)}]"
        }
        is androidx.core.util.Pair<*,*> -> {
            "[${asJson(v.first)},${asJson(v.second)}]"
        }
        is android.util.Pair<*,*> -> {
            "[${asJson(v.first)},${asJson(v.second)}]"
        }
        is Triple<*,*,*> -> {
            "[${asJson(v.first)},${asJson(v.second)},${asJson(v.third)}]"
        }
        is Array<*> -> {
            if (v.isNotEmpty()) {
                val sb = StringBuilder()
                sb.append('[')
                for (element in v) {
                    sb.append(asJson(element))
                    sb.append(',')
                }
                sb.deleteAt(sb.lastIndex)
                sb.append(']')
                sb.toString()
            } else {
                "[]"
            }
        }
        is Iterable<*> -> {
            val sb = StringBuilder()
            sb.append('[')
            for (element in v) {
                sb.append(asJson(element))
                sb.append(',')
            }
            if (sb.length > 1) {
                sb.deleteAt(sb.lastIndex)
            }
            sb.append(']')
            sb.toString()
        }
        is Map<*,*> -> {
            val sb = StringBuilder()
            sb.append('{')
            for ((key, value) in v) {
                if (value is Unit) { continue }
                val json_key = when (key) {
                    is String -> asJson(key).removeSurrounding("\"")
                    is Char   -> asJson(key).removeSurrounding("\"")
                    is Byte   -> asJson(key)
                    is Short  -> asJson(key)
                    is Int    -> asJson(key)
                    is Long   -> asJson(key)
                    is UByte  -> asJson(key)
                    is UShort -> asJson(key)
                    is UInt   -> asJson(key)
                    is ULong  -> asJson(key)
                    else      -> throw IllegalArgumentException(
                        "Unexpected key type: $key"
                    )
                }
                sb.append("\"${json_key}\":${asJson(value)},")
            }
            if (sb.length > 1) {
                sb.deleteAt(sb.lastIndex)
            }
            sb.append('}')
            sb.toString()
        }
        else -> {
            throw IllegalArgumentException(
                "Unexpected value type: $v"
            )
        }
    }
    return json
}

interface ScriptMediator {
    /**
     * Register a function to allow calling it from the JavaScript land.
     *
     * @param isSync represents whether or not the given function is treated as a synchronous function.
     * @param functionName a string representing a name for the function to be registered.
     * @param function a function object to be registered.
     * @param completionHandler a callback function to be called after registration.
     *
     * @throws IllegalArgumentException
     * when a function named `functionName` is already registered.
     * @see replaceFunction
     */
    fun registerFunction(
        isSync: Boolean = false,
        functionName: String,
        function: (Array<out Any?>) -> Any?,
        completionHandler: ((Any?) -> Unit)?
    )

    suspend fun registerFunction(
        isSync: Boolean = false,
        functionName: String,
        function: (Array<out Any?>) -> Any?
    ): Any?

    /**
     * Register or replace a function to allow calling it from the JavaScript land.
     *
     * @param isSync represents whether or not the given function is treated as a synchronous function.
     * @param functionName a string representing a name for the function to be registered.
     * @param function a function object to be registered.
     * @param completionHandler a callback function to be called after registration.
     *
     * @see registerFunction
     */
    fun replaceFunction(
        isSync: Boolean = false,
        functionName: String,
        function: (Array<out Any?>) -> Any?,
        completionHandler: ((Any?) -> Unit)?
    )

    suspend fun replaceFunction(
        isSync: Boolean = false,
        functionName: String,
        function: (Array<out Any?>) -> Any?
    ): Any?

    /**
     * Call a function on the JavaScript land by name.
     *
     * What function can be invoked is determined from the JavaScript land.
     *
     * @param functionName a string representing the name of the function to be executed.
     * @param args an array of arguments to be passed to the target function.
     * @param completionHandler a callback function called after execution of the target function.
     *
     * @throws IllegalArgumentException when the given function name `functionName` is not registered.
     */
    fun callJavaScriptFunction(
        functionName: String,
        args: Array<out Any?>,
        completionHandler: ((Any?) -> Unit)?
    )

    suspend fun callJavaScriptFunction(
        functionName: String,
        args: Array<out Any?>
    ): Any?

    /**
     * Call a function on the JavaScript land by handle.
     *
     * What function can be invoked is determined from the JavaScript land.
     *
     * @param handle a handle associated with the function to be executed.
     * @param args an array of arguments to be passed to the target function.
     * @param dispose a boolean representing whether or not to dispose the function handle.
     * Dispose the function after execution if `dispose` is `true`,
     * do nothing otherwise.
     * @param completionHandler a callback function called after execution of the target function.
     *
     */
    fun callJavaScriptFunction(
        dispose: Boolean = false,
        handle: HandleObject,
        args: Array<out Any?>,
        completionHandler: ((Any?) -> Unit)?
    )

    suspend fun callJavaScriptFunction(
        dispose: Boolean = false,
        handle: HandleObject,
        args: Array<out Any?>
    ): Any?

    /**
     * Send a message to the JavaScript land.
     *
     * This method will invoke `Alier.Sys._recvstat(message: string)` defined in the JavaScript land
     * which resolves all promises associated with the message
     * which is queued by invoking `Alier.Sys._wait(message: string)`.
     *
     * @param message a message to be sent to the JavaScript land.
     * @see wait
     */
    fun sendstat(
        message: String = "default"
    )

    /**
     * Queue an action associated with the given message.
     *
     * Actions are consumed when invoking `Alier.Sys._sendstat()` with the associated message
     * from JavaScript land.
     *
     * @param message a message expected to be sent from the JavaScript land.
     * @param action a function to be invoked when the given message is received.
     * @see sendstat
     */
    fun wait(
        message: String = "default",
        action: () -> Unit
    )

    suspend fun wait(
        message: String = "default"
    )
}

interface ScriptEvaluator {
    fun evaluate(
        script: String,
        completionHandler: ((Any?) -> Unit)? = null
    )
}

class JavaScriptEvaluator(
    private val _web_view: WebView
)
    : ScriptEvaluator
{
    companion object {
        private val _main_looper_handler = Handler(Looper.getMainLooper())
    }
    override fun evaluate(
        script: String,
        completionHandler: ((Any?) -> Unit)?
    ) {
        // Create a ValueCallback before entering the UI thread
        // to reduce extra calculation on the thread.
        val handler = if (completionHandler != null) {
            ValueCallback<String> { result ->
                val json = result
                    .removeSurrounding("\"")
                    .replace("\\\"", "\"")
                val tokener = JSONTokener(json)
                val eval_result =unwrapJson(tokener.nextValue())
                completionHandler(eval_result)
            }
        } else { null }
        // mimicking Activity's runOnUiThread here.
        if (_main_looper_handler.looper.thread == Thread.currentThread()) {
            _web_view.evaluateJavascript(script, handler)
        } else {
            _main_looper_handler.post {
                _web_view.evaluateJavascript(script, handler)
            }
        }
    }
}

data class HandleObject (
    val id  : Long,
    val type: String,
    val name: String
) {
    companion object {
        /**
         * Creates a HandleObject from the given `Map` object.
         *
         * @param map
         * A source of a `HandleObject` to be created.
         * This map must have `"id"`, `"type"`, `"name"` fields
         * and it must satisfy the following conditions:
         *
         * -   value of `"id"` is an integer or a string representing an integer.
         * -   value of `"type"` is a string.
         * -   value of `"name"` is a string.
         *
         * @throws IllegalArgumentException
         * when:
         * -   the `"id"` field does not exist
         * -   the `"type"` field does not exist
         * -   the `"name"` field does not exist
         * -   the `"id"` field has a value cannot be converted to an integer
         * -   the `"type"` field has a non-string value
         * -   the `"name"` field has a non-string value
         *
         * @return a `HandleObject`
         */
        fun from(map: Map<String, Any?>): HandleObject {
            val raw_id = map["id"] ?: throw IllegalArgumentException("Given map does not have the \"id\" field")
            val raw_type = map["type"] ?: throw IllegalArgumentException("Given map does not have the \"type\" field")
            val raw_name = map["name"] ?: throw IllegalArgumentException("Given map does not have the \"name\" field")
            val id   = when (raw_id) {
                is Number -> raw_id.toLong()
                is String -> raw_id.toLong()
                else -> raw_id.toString().toLong()
            }
            val type = raw_type as? String ?: throw IllegalArgumentException("Given \"type\" is not a string")
            val name = raw_name as? String ?: throw IllegalArgumentException("Given \"name\" is not a string")

            return HandleObject(id = id, type = type, name = name)
        }
    }

    /**
     * Constructor which converts a JSONObject to a HandleObject.
     *
     * @param jsonObject[JSONObject] a JSONObject to be converted to a HandleObject
     * @return [HandleObject]
     */
    constructor(jsonObject: JSONObject): this (
        id   = jsonObject.getLong("id"),
        type = jsonObject.getString("type"),
        name = jsonObject.getString("name")
    )

    /**
     * Constructor which converts a JSON string to a HandleObject.
     *
     * @param jsonString[String] a JSON string to be converted to a HandleObject
     * @return [HandleObject]
     */
    constructor(jsonString: String): this(JSONObject(jsonString))

    /**
     * Convert to a JSON string.
     *
     * @return [String] a JSON string representing a HandleObject
     */
    override fun toString(): String {
        return """{"id":${
            toJavaScriptValue(id.toString(10))
        },"type":${
            toJavaScriptValue(type)
        },"name":${
            toJavaScriptValue(name)
        }}"""
    }
}

/**
 * Interface for communicating with JavaScript.
 */
class _NativeFunctionInterface
    : ScriptMediator
{

    var scriptEvaluator: JavaScriptEvaluator?
        get() = _script_evaluator
        set(new_evaluator) {
            _script_evaluator = new_evaluator
        }
    private var _script_evaluator: JavaScriptEvaluator? = null

    companion object {
        private val _native_function_registry = mutableMapOf<String, (Array<out Any?>) -> Any?>()
        private val _js_function_handle_registry = mutableMapOf<Long, HandleObject>()
        private val _action_queue = mutableMapOf<String, MutableList<() -> Unit>>()
        private val _js_functions_frequently_used = mutableMapOf<String, HandleObject>()
        private val _js_functions_last_used = mutableListOf<String>()
        private const val JS_FUNCTIONS_FREQUENTLY_USED_CAPACITY = 8
        private val AVAILABLE_PROCESSORS = Runtime.getRuntime().availableProcessors()
    }

    private val _executor = Executors.newFixedThreadPool(AVAILABLE_PROCESSORS)
    init {
        if (!_native_function_registry.contains("_registerJavaScriptFunction")) {
            _native_function_registry["_registerJavaScriptFunction"] = { args ->
                this._registerJavaScriptFunction(args[0] as String)
            }
        }
    }

    /**
     * Evaluate given script on the [WebView].
     *
     * @param script a string representing a sequence of JavaScript statements to be evaluated.
     * @param completionHandler a callback function which captures an evaluation result.
     *
     * The result is the same as the value of the last evaluated statement in the given script.
     * So if you give a sequence of statements,
     * the callback will be passed the value of the expression statement lastly evaluated.
     *
     * If you don't need to get the evaluation result, you can pass `null` as the argument `completionHandler`.
     */
    private fun evaluateJavaScript(
        script: String,
        completionHandler: ((Any?) -> Unit)? = null
    ) {
        _script_evaluator!!.evaluate(
            script = script,
            completionHandler = completionHandler
        )
    }

    /**
     * Register a handle associated with the target JavaScript function.
     * After registration, registered function can be invoked via [callJavaScriptFunction]
     * from the Native land.
     *
     * This method is called from the JavaScript land via `Alier.registerFunction()`.
     *
     * @param functionHandleJson
     * a JSON string representing a handle object associated with the target JavaScript function.
     * @see callJavaScriptFunction
     */
    @Suppress("MemberVisibilityCanBePrivate")
    fun _registerJavaScriptFunction(
        functionHandleJson: String
    ) {
        val handle_obj = HandleObject(functionHandleJson)
        _js_function_handle_registry[handle_obj.id] = handle_obj
    }

    /**
     * Call a function on the JavaScript land by handle.
     *
     * What function can be invoked is determined
     * by [_registerJavaScriptFunction] invoked ordinarily from the JavaScript land.
     *
     * @param dispose a boolean representing whether or not to dispose the function handle.
     * Dispose the function after execution if `dispose` is `true`,
     * do nothing otherwise.
     * @param handle a handle associated with the function to be executed.
     * @param args an array of arguments to be passed to the target function.
     * @param completionHandler a callback function called after execution of the target function.
     *
     * @see _registerJavaScriptFunction
     */
    override fun callJavaScriptFunction(
        dispose: Boolean,
        handle: HandleObject,
        args: Array<out Any?>,
        completionHandler:((Any?) -> Unit)?
    ) {
        evaluateJavaScript(
            "(Alier.Sys._functionCallReceiver(${
                dispose
            }, ${
                handle
            }, ${
                toJavaScriptValue(args)
            }));",
            completionHandler
        )
    }
    @Suppress("MemberVisibilityCanBePrivate")
    override suspend fun callJavaScriptFunction(
        dispose: Boolean,
        handle : HandleObject,
        args   : Array<out Any?>
    ): Any? {
        return suspendCoroutine { continuation ->
            callJavaScriptFunction(dispose, handle, args) {
                continuation.resume(it)
            }
        }
    }

    /**
     * Call a function on the JavaScript land by name.
     *
     * What function can be invoked is determined
     * by [_registerJavaScriptFunction] invoked ordinarily from the JavaScript land.
     *
     * @param functionName a string representing the name of the function to be executed.
     * @param args an array of arguments to be passed to the target function.
     * @param completionHandler a callback function called after execution of the target function.
     *
     * @throws IllegalArgumentException
     * when the given function name `functionName` is not registered.
     * @see _registerJavaScriptFunction
     */
    override fun callJavaScriptFunction(
        functionName     : String,
        args              : Array<out Any?>,
        completionHandler: ((Any?) -> Unit)?
    ) {
        var handle = _js_functions_frequently_used[functionName]
        if (handle == null) {
            for (value in _js_function_handle_registry.values) {
                if (value.name == functionName) {
                    handle = value
                    break
                }
            }
            if (handle == null) {
                throw IllegalArgumentException("`$functionName` is not defined.")
            }
        }
        synchronized (_js_functions_frequently_used) {
            _js_functions_frequently_used[functionName] = handle
            if (_js_functions_last_used.size >= JS_FUNCTIONS_FREQUENTLY_USED_CAPACITY) {
                val removed = _js_functions_last_used.removeAt(0)
                _js_functions_frequently_used.remove(removed)
            }
            if (!_js_functions_last_used.contains(functionName)) {
                _js_functions_last_used.add(functionName)
            }
        }
        callJavaScriptFunction(dispose = false, handle, args, completionHandler)
    }

    @Suppress("MemberVisibilityCanBePrivate")
    override suspend fun callJavaScriptFunction(
        functionName: String,
        args         : Array<out Any?>
    ): Any? {
        return suspendCoroutine { continuation ->
            callJavaScriptFunction(functionName, args) {
                continuation.resume(it)
            }
        }
    }

    /**
     * Register a function to allow calling it from the JavaScript land.
     *
     * @param update a flag indicating whether or not to replace a function
     * if the given function name is already used for another function.
     * If `update` is `true`, replacing is allowed.
     * @param isSync represents whether or not the given function is treated as a synchronous function.
     * @param functionName a string representing a name for the function to be registered.
     * @param function a function object to be registered.
     * @param completionHandler a callback function to be called after registration.
     *
     * @throws IllegalArgumentException
     * when `update` is `false` and a function named `functionName` is already registered.
     * @see registerFunction
     * @see replaceFunction
     */
    private fun _registerFunctionImpl(
        update: Boolean = false,
        isSync: Boolean,
        functionName: String,
        function: (Array<out Any?>) -> Any?,
        completionHandler: ((Any?) -> Unit)? = null
    ) {
        synchronized (_native_function_registry) {
            if (_native_function_registry.contains(functionName)) {
                if (update) {
                    AlierLog.w(
                        1000,
                        "registerFunction(): Function `$functionName` is already registered."
                    )
                } else {
                    throw IllegalArgumentException(
                        "Function `$functionName` is already registered."
                    )
                }
            }
            _native_function_registry[functionName] = function
        }
        callJavaScriptFunction(
            functionName = "_registerNativeFunction",
            args = arrayOf(functionName, isSync),
            completionHandler = completionHandler
        )
    }

    /**
     * Register a function to allow calling it from the JavaScript land.
     *
     * @param isSync represents whether or not the given function is treated as a synchronous function.
     * @param functionName a string representing a name for the function to be registered.
     * @param function a function object to be registered.
     * @param completionHandler a callback function to be called after registration.
     *
     * @throws IllegalArgumentException
     * when a function named `functionName` is already registered.
     * @see _registerFunctionImpl
     * @see replaceFunction
     */
    override fun registerFunction(
        isSync: Boolean,
        functionName: String,
        function: (Array<out Any?>) -> Any?,
        completionHandler: ((Any?) -> Unit)?
    ) {
        _registerFunctionImpl(update = false, isSync, functionName, function, completionHandler)
    }

    override suspend fun registerFunction(
        isSync: Boolean,
        functionName: String,
        function: (Array<out Any?>) -> Any?
    ) {
        suspendCoroutine { continuation ->
            registerFunction(isSync, functionName, function) {
                continuation.resume(it)
            }
        }
    }

    /**
     * Register or replace a function to allow calling it from the JavaScript land.
     *
     * @param isSync represents whether or not the given function is treated as a synchronous function.
     * @param functionName a string representing a name for the function to be registered.
     * @param function a function object to be registered.
     * @param completionHandler a callback function to be called after registration.
     *
     * @see registerFunction
     * @see _registerFunctionImpl
     */
    override fun replaceFunction(
        isSync: Boolean,
        functionName: String,
        function: (Array<out Any?>) -> Any?,
        completionHandler: ((Any?) -> Unit)?
    ) {
        _registerFunctionImpl(update = true, isSync, functionName, function, completionHandler)
    }

    @Suppress("MemberVisibilityCanBePrivate")
    override suspend fun replaceFunction(
        isSync: Boolean,
        functionName: String,
        function: (Array<out Any?>) -> Any?
    ) {
        suspendCoroutine { continuation ->
            replaceFunction(isSync, functionName, function) {
                continuation.resume(it)
            }
        }
    }

    private fun getFunctionCallSpec(json: String): Triple<String, String, Array<*>> {
        val json_obj = JSONObject(json)

        val function_name = (json_obj["function_name"] as? String) ?:
        throw IllegalArgumentException("'function_name' was not defined in the given JSON.")

        val raw_callback_handle = (json_obj["callback_handle"] as? JSONObject) ?:
        throw IllegalArgumentException("'callback_handle' was not defined in the given JSON.")

        val callback_handle_json = HandleObject(raw_callback_handle).toString()
        val json_args = (json_obj["args"] as? JSONArray) ?:
        throw IllegalArgumentException("'args' was not defined in the given JSON.")

        val args = unwrapJson(json_args) as Array<*>
        return Triple(function_name, callback_handle_json, args)
    }
    /**
     * Invoke a function registered on the native function registry by name.
     *
     * This function's invocation will be triggered from JavaScript code.
     *
     * @param json a JSON string representing a set of a function-call parameter.
     *
     * For asynchronous call, json is required having the following properties:
     * -  `"callback_handle"`:
     *    a handle associated with a callback
     *      which will give the JavaScript side the return value of the invoked function.
     * -  `"function_name"`:
     *    a string representing the name of the function to be invoked.
     * -  `"args"`:
     *    a set of arguments which will be passed to the target function.
     * @throws IllegalArgumentException when the target function is not registered.
     */
    @JavascriptInterface
    fun functionCallReceiver(json: String) {
        val (function_name, callback_handle_json, args) = getFunctionCallSpec(json)

        _executor.submit {
            var result: Any?
            try {
                val f = _native_function_registry[function_name] ?:
                throw IllegalArgumentException("`$function_name` is not a function.")

                val success = f.invoke(args)

                result = mapOf("result" to success)
            } catch (e: Exception) {
                AlierLog.e(0, e.stackTraceToString())

                val error_map = mapOf(
                    "message" to "${e.javaClass.name}: ${e.localizedMessage}"
                )

                result = mapOf("error" to error_map)
            }

            _registerJavaScriptFunction(callback_handle_json)
            val handle = HandleObject(callback_handle_json)

            // invoke the callback function associated with
            // the given handle for returning the result to JS land.
            callJavaScriptFunction(
                dispose = true,
                handle = handle,
                args = arrayOf(result),
                completionHandler = null
            )
        }
    }

    @JavascriptInterface
    fun functionCallReceiverSync(json: String): String {
        try {
            val json_obj = JSONObject(json)

            val function_name = (json_obj["function_name"] as? String) ?:
            throw IllegalArgumentException("'function_name' was not defined in the given JSON.")
            val json_args = (json_obj["args"] as? JSONArray) ?:
            throw IllegalArgumentException("'args' was not defined in the given JSON.")
            val f = _native_function_registry[function_name] ?:
            throw IllegalArgumentException("`$function_name` is not a function.")

            val args = unwrapJson(json_args) as Array<*>
            val result = f(args)
            return asJson(mapOf("result" to result))
        } catch (e: Exception) {
            AlierLog.e(0, e.stackTraceToString())

            val error_map = mapOf(
                "message" to "${e.javaClass.name}: ${e.localizedMessage}",
            )
            return asJson(mapOf("error" to error_map))
        }
    }

    /**
     * Send a message to the JavaScript land.
     *
     * This method will invoke `Alier.Sys._recvstat(message: string)` defined in the JavaScript land
     * which resolves all promises associated with the message
     * which is queued by invoking `Alier.Sys._wait(message: string)`.
     *
     * @param message a message to be sent to the JavaScript land.
     * @see recvstat
     * @see wait
     */
    override fun sendstat(
        message: String
    ) {
        val m = if (message == "") { "default" } else { message }
        evaluateJavaScript("Alier.Sys._recvstat(\"$m\");")
    }
    /**
     * Resolve actions associated with the given message.
     *
     * This method will be invoked from the JavaScript land by invoking
     * `Alier.Sys._sendstat(message: string)`.
     *
     * @param message a message received from the JavaScript land.
     * @see sendstat
     * @see wait
     */
    @JavascriptInterface
    fun recvstat(
        message: String
    ) {
        val m = if (message == "") { "default" } else { message }
        synchronized(_action_queue) {
            val actions = _action_queue[m] ?: return
            while (actions.size > 0) {
                val action = actions.removeAt(0)
                action()
            }
            _action_queue.remove(m)
        }
    }

    /**
     * Queue an action associated with the given message.
     *
     * The action queued will be invoked from [recvstat].
     *
     * @param message a message expected to be sent from the JavaScript land.
     * @param action a function to be invoked when the given message is received.
     * @see sendstat
     * @see recvstat
     */
    override fun wait(
        message: String,
        action: () -> Unit
    ) {
        synchronized(_action_queue) {
            if (!_action_queue.containsKey(message)) {
                _action_queue[message] = mutableListOf()
            }
            _action_queue[message]!!.add(action)
        }
    }

    /**
     * Queue an action associated with the given message.
     *
     * The action queued will be invoked from [recvstat].
     *
     * @param message a message expected to be sent from the JavaScript land.
     * @see sendstat
     * @see recvstat
     */
    override suspend fun wait(message: String) {
        suspendCoroutine { continuation ->
            wait(message) {
                continuation.resume(Unit)
            }
        }
    }
}
