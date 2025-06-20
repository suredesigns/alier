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
import WebKit
import os

private func toJavaScriptValue(_ value: Double) -> String {
    if value.isNaN {
        return "NaN"
    } else if value == Double.infinity {
        return "Number.POSITIVE_INFINITY"
    } else if value == -Double.infinity {
        return "Number.NEGATIVE_INFINITY"
    } else {
        return String(value)
    }
}

private func toJavaScriptValue(_ value: Float) -> String {
    if value.isNaN {
        return "NaN"
    } else if value == Float.infinity {
        return "Number.POSITIVE_INFINITY"
    } else if value == -Float.infinity {
        return "Number.NEGATIVE_INFINITY"
    } else {
        return String(Double(value))
    }
}

private func toJavaScriptValue(_ value: Int64) -> String {
    if (value >= 0) {
        return "0x\(String(value, radix: 16, uppercase: false))"
    } else if (value != Int64.min) {
        return "-0x\(String(-value, radix: 16, uppercase: false))"
    } else {
        return toJavaScriptValue(Double(value))
    }
}

private func toJavaScriptValue(_ value: Int32) -> String {
    if (value >= 0) {
        return "0x\(String(value, radix: 16, uppercase: false))"
    } else if (value != Int32.min) {
        return "-0x\(String(-value, radix: 16, uppercase: false))"
    } else {
        return toJavaScriptValue(Int64(value))
    }
}

private func toJavaScriptValue(_ value: Int) -> String {
    if MemoryLayout<Int>.size == 8 {
        return toJavaScriptValue(Int64(value))
    } else {
        return toJavaScriptValue(Int32(value))
    }
}

private func toJavaScriptValue(_ value: Int16) -> String {
    return toJavaScriptValue(Int32(value))
}

private func toJavaScriptValue(_ value: Int8) -> String {
    return toJavaScriptValue(Int32(value))
}

private func toJavaScriptValue(_ value: UInt64) -> String {
    return "0x\(String(value, radix: 16, uppercase: false))"
}

private func toJavaScriptValue(_ value: UInt32) -> String {
    return "0x\(String(value, radix: 16, uppercase: false))"
}

private func toJavaScriptValue(_ value: UInt) -> String {
    if MemoryLayout<UInt>.size == 8 {
        return toJavaScriptValue(UInt64(value))
    } else {
        return toJavaScriptValue(UInt32(value))
    }
}

private func toJavaScriptValue(_ value: UInt16) -> String {
    return toJavaScriptValue(Int32(value))
}

private func toJavaScriptValue(_ value: UInt8) -> String {
    return toJavaScriptValue(Int32(value))
}

private func toJavaScriptValue(_ value: String) -> String {
    var result = ""
    var first: Character = "\0"
    result.append("\"")
    for second in value {
        let escaped = (first == "\\")
        switch second {
        case "\n":
            result.append("\\n")
        case "\r":
            result.append("\\r")
        case "\r\n":
            result.append("\\r\\n")
        case "\t":
            result.append("\\t")
        case "\"":
            if escaped {
                result.append("\\\\\"")
            } else {
                result.append("\\\"")
            }
        default:
            if escaped {
                result.append("\\")
            }
            result.append(second)
        }
        first = second
    }
    if first == "\\" {
        result.append("\\")
    }
    result.append("\"")
    return result
}

private func toJavaScriptValue(_ value: Character) -> String {
    return toJavaScriptValue(String(value))
}

private func toJavaScriptValue(_ value: [String: Any?]) throws -> String {
    if value.isEmpty {
        return "({})"
    }
    var result = ""
    result.append("{")
    for key in value.keys {
        let key_js = toJavaScriptValue(key)
        if let item = value[key] {
            let item_js = try toJavaScriptValue(item)
            result.append("\(key_js):\(item_js),")
        } else {
            result.append("\(key_js):null,")
        }
    }
    //  value is not empty here (i.e. the body of the above loop is certainly evaluated)
    //  and hence it is guaranteed that a trailing comma is removed
    result.removeLast()
    result.append("}")
    return result
}

private func toJavaScriptValue(_ value: [AnyHashable: Any?]) throws -> String {
    if value.isEmpty {
        return "({})"
    }
    var key_type = "Number"
    for key in value.keys {
        if key is Int64  || key is Int32  || key is Int16  || key is Int8  ||
           key is UInt64 || key is UInt32 || key is UInt16 || key is UInt8
        {
            continue
        }
        key_type = "String"
        break
    }
    var result = ""
    if key_type == "String" {
        result.append("{")
        for key in value.keys {
            let key_js = try toJavaScriptValue(key)
            if let item = value[key] {
                let item_js = try toJavaScriptValue(item)
                result.append("\(key_js):\(item_js),")
            } else {
                result.append("\(key_js):null,")
            }
        }
        //  value is not empty here (i.e. the body of the above loop is certainly evaluated)
        //  and hence it is guaranteed that a trailing comma is removed
        result.removeLast()
        result.append("}")
    } else {
        result.append("[")
        for key in value.keys {
            let key_js = try toJavaScriptValue(key)
            if let item = value[key] {
                let item_js = try toJavaScriptValue(item)
                result.append("[\(key_js),\(item_js)],")
            } else {
                result.append("[\(key_js),null],")
            }
        }
        //  value is not empty here (i.e. the body of the above loop is certainly evaluated)
        //  and hence it is guaranteed that a trailing comma is removed
        result.removeLast()
        result.append("]")
    }
    return result
}

private func toJavaScriptValue<T: Collection<Any?>>(_ value: T) throws -> String {
    if value.isEmpty {
        return "[]"
    }
    var result = "["
    for element in value {
        result.append(try toJavaScriptValue(element))
        result.append(",")
    }
    //  value is not empty here (i.e. the body of the above loop is certainly evaluated)
    //  and hence it is guaranteed that a trailing comma is removed
    result.removeLast()
    result.append("]")
    return result
}

private func toJavaScriptValue<T: Sequence<Any?>>(_ value: T) throws -> String {
    var result = "["
    for element in value {
        result.append(try toJavaScriptValue(element))
        result.append(",")
    }
    //  it is NOT guaranteed that the body of the above loop is evaluated because `value` may be empty.
    if result.count > 1 {
        result.removeLast()
    }
    result.append("]")
    return result
}

private func toJavaScriptValue(_ value: Bool) -> String {
    return value ? "true" : "false"
}

private func toJavaScriptValue(_ value: (Any?, Any?)) throws -> String {
    let first  = try toJavaScriptValue(value.0)
    let second = try toJavaScriptValue(value.1)
    return "[\(first),\(second)]"
}

private func toJavaScriptValue(_ value: (Any?, Any?, Any?)) throws -> String {
    let first  = try toJavaScriptValue(value.0)
    let second = try toJavaScriptValue(value.1)
    let third  = try toJavaScriptValue(value.2)
    return "[\(first),\(second),\(third)]"
}

private func toJavaScriptValue(_ value: NSNull) -> String {
    return "null"
}

private func toJavaScriptValue(_ value: Void) -> String {
    return "undefined"
}

public func toJavaScriptValue<T>(_ value: T?) throws -> String {
    guard let v = value else {
        return "null"
    }
    switch v {
    case is NSNull:
        return toJavaScriptValue(v as! NSNull)
    case is Void:
        return toJavaScriptValue(v as! Void)
    case is Bool:
        return toJavaScriptValue(v as! Bool)
    case is Int8:
        return toJavaScriptValue(v as! Int8)
    case is Int16:
        return toJavaScriptValue(v as! Int16)
    case is Int32:
        return toJavaScriptValue(v as! Int32)
    case is Int64:
        return toJavaScriptValue(v as! Int64)
    case is Int:
        return toJavaScriptValue(v as! Int)
    case is UInt8:
        return toJavaScriptValue(v as! UInt8)
    case is UInt16:
        return toJavaScriptValue(v as! UInt16)
    case is UInt32:
        return toJavaScriptValue(v as! UInt32)
    case is UInt64:
        return toJavaScriptValue(v as! UInt64)
    case is UInt:
        return toJavaScriptValue(v as! UInt)
    case is Float:
        return toJavaScriptValue(v as! Float)
    case is Double:
        return toJavaScriptValue(v as! Double)
    case is Character:
        return toJavaScriptValue(v as! Character)
    case is String:
        return toJavaScriptValue(v as! String)
    case is (Any?, Any?):
        return try toJavaScriptValue(v as! (Any?, Any?))
    case is (Any?, Any?, Any?):
        return try toJavaScriptValue(v as! (Any?, Any?, Any?))
    case is [String: Any?]:
        return try toJavaScriptValue((v as! [String: Any?]))
    case is [AnyHashable: Any?]:
        return try toJavaScriptValue((v as! [AnyHashable: Any?]))
    case is Set<AnyHashable>:
        return try toJavaScriptValue((v as! Set<AnyHashable>))
    case is [Any?]:
        return try toJavaScriptValue((v as! [Any?]))
    case is ArraySlice<Any?>:
        return try toJavaScriptValue((v as! ArraySlice<Any?>))
    default:
        throw _NativeFunctionInterface.InvocationError.UNSUPPORTED_TYPE_CONVERSION
    }
}

private func asJson(_ value: Float) -> String {
    if value.isNaN {
        return "\"NaN\""
    } else if value == Float.infinity {
        return "\"Infinity\""
    } else if value == -Float.infinity {
        return "\"-Infinity\""
    } else {
        return String(Double(value))
    }
}

private func asJson(_ value: Double) -> String {
    if value.isNaN || value.isSignalingNaN {
        return "\"NaN\""
    } else if value == Double.infinity {
        return "\"Infinity\""
    } else if value == -Double.infinity {
        return "\"-Infinity\""
    } else {
        return String(value)
    }
}

private func asJson(_ value: Int64) -> String {
    return String(value, radix: 10)
}

private func asJson(_ value: Int32) -> String {
    return String(value, radix: 10)
}

private func asJson(_ value: Int) -> String {
    if MemoryLayout<Int>.size == 8 {
        return asJson(Int64(value))
    } else {
        return asJson(Int32(value))
    }
}

private func asJson(_ value: Int16) -> String {
    return String(value, radix: 10)
}

private func asJson(_ value: Int8) -> String {
    return String(value, radix: 10)
}

private func asJson(_ value: UInt64) -> String {
    return String(value, radix: 10)
}

private func asJson(_ value: UInt32) -> String {
    return String(value, radix: 10)
}

private func asJson(_ value: UInt) -> String {
    if MemoryLayout<UInt>.size == 8 {
        return asJson(UInt64(value))
    } else {
        return asJson(UInt32(value))
    }
}

private func asJson(_ value: UInt16) -> String {
    return String(value, radix: 10)
}

private func asJson(_ value: UInt8) -> String {
    return String(value, radix: 10)
}

private func asJson(_ value: Bool) -> String {
    return value ? "true" : "false"
}

private func asJson(_ value: NSNull) -> String {
    return "null"
}

private func asJson(_ value: Void) -> String {
    return "\"undefined\""
}

private func asJson(_ value: Character) -> String {
    return toJavaScriptValue(value)
}

private func asJson(_ value: String) -> String {
    return toJavaScriptValue(value)
}

private func asJson<T: Collection<Any?>>(_ value: T) throws -> String {
    if value.isEmpty {
        return "[]"
    }
    var result = "["
    for element in value {
        result.append(try asJson(element))
        result.append(",")
    }
    //  value is not empty here (i.e. the body of the above loop is certainly evaluated)
    //  and hence it is guaranteed that a trailing comma is removed
    result.removeLast()
    result.append("]")
    return result
}

private func asJson<T: Sequence<Any?>>(_ value: T) throws -> String {
    var result = "["
    for element in value {
        result.append(try asJson(element))
        result.append(",")
    }
    //  it is NOT guaranteed that the body of the above loop is evaluated because `value` may be empty.
    if result.count > 1 {
        result.removeLast()
    }
    result.append("]")
    return result
}

private func asJson(_ value: [String: Any?]) throws -> String {
    if value.isEmpty {
        return "{}"
    }
    var result = ""
    result.append("{")
    for key in value.keys {
        let key_json = toJavaScriptValue(key)
        if let item = value[key] {
            let item_json = try asJson(item)
            result.append("\(key_json):\(item_json),")
        } else {
            result.append("\(key_json):null,")
        }
    }
    //  value is not empty here (i.e. the body of the above loop is certainly evaluated)
    //  and hence it is guaranteed that a trailing comma is removed
    result.removeLast()
    result.append("}")
    return result
}

private func asJson(_ value: [AnyHashable: Any?]) throws -> String {
    if value.isEmpty {
        return "{}"
    }
    var key_type = "Number"
    for key in value.keys {
        if key is Int64  || key is Int32  || key is Int16  || key is Int8  ||
           key is UInt64 || key is UInt32 || key is UInt16 || key is UInt8
        {
            continue
        }
        key_type = "String"
        break
    }
    var result = ""
    if key_type == "String" {
        result.append("{")
        for key in value.keys {
            let key_json: String
            if key is Character {
                key_json = toJavaScriptValue(String(key as! Character))
            } else if key is String {
                key_json = toJavaScriptValue(key as! String)
            } else {
                key_json = toJavaScriptValue(try asJson(key))
            }
            if let item = value[key] {
                let item_json = try asJson(item)
                result.append("\(key_json):\(item_json),")
            } else {
                result.append("\(key_json):null,")
            }
        }
        //  value is not empty here (i.e. the body of the above loop is certainly evaluated)
        //  and hence it is guaranteed that a trailing comma is removed
        result.removeLast()
        result.append("}")
    } else {
        result.append("[")
        for key in value.keys {
            let key_json: String
            if key is Character {
                key_json = toJavaScriptValue(String(key as! Character))
            } else if key is String {
                key_json = toJavaScriptValue(key as! String)
            } else {
                key_json = toJavaScriptValue(try asJson(key))
            }
            if let item = value[key] {
                let item_json = try asJson(item)
                result.append("[\(key_json),\(item_json)],")
            } else {
                result.append("[\(key_json),null],")
            }
        }
        //  value is not empty here (i.e. the body of the above loop is certainly evaluated)
        //  and hence it is guaranteed that a trailing comma is removed
        result.removeLast()
        result.append("]")
    }
    return result
}

private func asJson(_ value: (Any?, Any?)) throws -> String {
    let first  = try asJson(value.0)
    let second = try asJson(value.1)
    return "[\(first),\(second)]"
}

private func asJson(_ value: (Any?, Any?, Any?)) throws -> String {
    let first  = try asJson(value.0)
    let second = try asJson(value.1)
    let third  = try asJson(value.2)
    return "[\(first),\(second),\(third)]"
}

private func asJson<T>(_ value: T?) throws -> String {
    let null = "null"
    let undefined = "\"undefined\""
    guard let v = value else {
        return null
    }
    switch v {
    case is NSNull:
        return asJson(v as! NSNull)
    case is Void:
        return asJson(v as! Void)
    case is Bool:
        return asJson(v as! Bool)
    case is Int8:
        return asJson(v as! Int8)
    case is Int16:
        return asJson(v as! Int16)
    case is Int32:
        return asJson(v as! Int32)
    case is Int64:
        return asJson(v as! Int64)
    case is Int:
        return asJson(v as! Int)
    case is UInt8:
        return asJson(v as! UInt8)
    case is UInt16:
        return asJson(v as! UInt16)
    case is UInt32:
        return asJson(v as! UInt32)
    case is UInt64:
        return asJson(v as! UInt64)
    case is UInt:
        return asJson(v as! UInt)
    case is Float:
        return asJson(v as! Float)
    case is Double:
        return asJson(v as! Double)
    case is Character:
        return asJson(v as! Character)
    case is String:
        return asJson(v as! String)
    case is (Any?, Any?):
        return try asJson(v as! (Any?, Any?))
    case is (Any?, Any?, Any?):
        return try asJson(v as! (Any?, Any?, Any?))
    case is [String: Any?]:
        return try asJson((v as! [String: Any?]))
    case is [AnyHashable: Any?]:
        return try asJson((v as! [AnyHashable: Any?]))
    case is Set<AnyHashable>:
        return try asJson((v as! Set<AnyHashable>))
    case is [Any?]:
        return try asJson((v as! [Any?]))
    case is ArraySlice<Any?>:
        return try asJson((v as! ArraySlice<Any?>))

    default:
        // return json stringify text.
        let json_data = try JSONSerialization.data(
            withJSONObject: v,
            options: .fragmentsAllowed
        )
        return String(data: json_data, encoding: String.Encoding.utf8) ?? undefined
    }
}

public protocol ScriptMediator {
    func _sendstat(_ message: String)
    func _wait(_ message: String,  action: @escaping () -> Void)
    func callJavaScriptFunction(
        dispose: Bool,
        handle: HandleObject,
        args: [Any?],
        completionHandler completion_handler: ((Any?) -> Void)?
    ) throws

    @available(iOS 15.0, *)
    func callJavaScriptFunction(
        dispose: Bool,
        handle: HandleObject,
        args: [Any?]
    ) async throws -> Any?

    func callJavaScriptFunction(
        functionName function_name: String,
        args: [Any?],
        completionHandler completion_handler: ((Any?) -> Void)?
    ) throws

    @available(iOS 15.0, *)
    func callJavaScriptFunction(
        functionName function_name: String,
        args: [Any?]
    ) async throws -> Any?

    
    func registerFunction(
        isSync is_sync: Bool,
        functionName function_name: String,
        function: @escaping ([Any?]) -> Any?,
        completionHandler completion_handler: ((Any?) -> Void)?
    ) throws
    
    @available(iOS 15.0, *)
    func registerFunction(
        isSync is_sync: Bool,
        functionName function_name: String,
        function: @escaping ([Any?]) -> Any?
    ) async throws -> Any?
    
    func registerFunction(
        isSync is_sync: Bool,
        functionName function_name: String,
        function: @escaping ([Any?]) throws -> Any?,
        completionHandler completion_handler: ((Any?) -> Void)?
    ) throws

    @available(iOS 15.0, *)
    func registerFunction(
        isSync is_sync: Bool,
        functionName function_name: String,
        function: @escaping ([Any?]) throws -> Any?
    ) async throws -> Any?

    func replaceFunction(
        isSync is_sync: Bool,
        functionName function_name: String,
        function: @escaping ([Any?]) -> Any?,
        completionHandler completion_handler: ((Any?) -> Void)?
    )
    
    @available(iOS 15.0, *)
    func replaceFunction(
        isSync is_sync: Bool,
        functionName function_name: String,
        function: @escaping ([Any?]) -> Any?
    ) async -> Any?
    
    func replaceFunction(
        isSync is_sync: Bool,
        functionName function_name: String,
        function: @escaping ([Any?]) throws -> Any?,
        completionHandler completion_handler: ((Any?) -> Void)?
    )

    @available(iOS 15.0, *)
    func replaceFunction(
        isSync is_sync: Bool,
        functionName function_name: String,
        function: @escaping ([Any?]) throws -> Any?
    ) async -> Any?
}

protocol ScriptEvaluator {
    func evaluate(
        _ script: String,
        completionHandler completion_handler: ((Any?) -> Void)?
    )
    
    @available(iOS 15.0, *)
    @MainActor
    func evaluate(
        _ script: String
    ) async throws -> Any?
}

final public class JavaScriptEvaluator
    : ScriptEvaluator
{
    private weak var _web_view: WKWebView?
    init (webView: WKWebView) {
        _web_view = webView
    }
    
    func evaluate(
        _ script: String,
        completionHandler completion_handler: ((Any?) -> Void)?
    ) {
        Task { @MainActor in
            if completion_handler == nil {
                _web_view!.evaluateJavaScript(script)
            } else {
                _web_view!.evaluateJavaScript(script) { (result, error) in
                    if error == nil {
                        completion_handler!(result)
                    } else {
                        completion_handler!(error)
                    }
                }
            }
        }
    }
    
    @available(iOS 15.0, *)
    @MainActor
    func evaluate(
        _ script: String
    ) async throws -> Any? {
        return try await _web_view!.evaluateJavaScript(script, contentWorld: .defaultClient)
    }
}

public struct HandleObject: Codable, Equatable {
    enum HandleObjectError: Error {
        case missingId
        case missingType
        case missingName
        case invalidId
        case invalidType
        case invalidName
    }
    
    let id  : Int64
    let type: String
    let name: String
    static func decode(json: String) throws -> HandleObject {
        let raw_obj = try JSONSerialization.jsonObject(with: json.data(using:.utf8)!) as! [String: Any]
        return HandleObject(
            id: Int64(raw_obj["id"] as! String)!,
            type: raw_obj["type"] as! String,
            name: raw_obj["name"] as! String
        )
    }
    static func from(dict: [String: Any?]) throws -> HandleObject {
        guard let raw_id   = dict["id"] else {
            throw HandleObjectError.missingId
        }
        guard let raw_type = dict["type"] else {
            throw HandleObjectError.missingType
        }
        guard let raw_name = dict["name"] else {
            throw HandleObjectError.missingName
        }
        
        var id: Int64 = -1
        switch raw_id {
        case let string as String:
            if let number = Int64(string) {
                id = number
            } else {
                throw HandleObjectError.invalidId
            }
        case let number as NSNumber:
            id = number.int64Value
        default:
            throw HandleObjectError.invalidId
        }
        
        guard let type = raw_type as? String else {
            throw HandleObjectError.invalidType
        }
        
        guard let name = raw_name as? String else {
            throw HandleObjectError.invalidName
        }
        
        return HandleObject.init(id: id, type: type, name: name)
    }
    static public func == (lhs: HandleObject, rhs: HandleObject) -> Bool {
        return lhs.id == rhs.id &&
        lhs.type == rhs.type &&
        lhs.name == rhs.name
    }
}

public extension String {
    init(_ handle: HandleObject) {
        self.init(
            "{\"id\":\(toJavaScriptValue(String(handle.id, radix: 10))),\"type\":\(toJavaScriptValue(handle.type)),\"name\":\(toJavaScriptValue(handle.name))}"
        )
    }
}

enum ClosureKind {
    case mayThrow(([Any?]) throws -> Any?)
    case noThrows(([Any?]) -> Any?)
    func call(_ args: [Any?]) throws -> Any? {
        switch self {
        case .mayThrow(let closure):
            return try closure(args)
        case .noThrows(let closure):
            return closure(args)
        }
    }
}

final public class _NativeFunctionInterface :
    NSObject,
    WKScriptMessageHandler,
    WKUIDelegate,
    ScriptMediator
{
    
    enum ScriptMessageName: String {
        case functionCallReceiver
        case _recvstat
    }
    enum InvocationError: Error {
        case HANDLE_NOT_REGISTERED
        case INVALID_HANDLE_PASSED
        case FUNCTION_NAME_DUPLICATED
        case FUNCTION_NOT_REGISTERED
        case UNSUPPORTED_TYPE_CONVERSION 
    }
    private var _script_evaluator: JavaScriptEvaluator? = nil
    
    public var scriptEvaluator: JavaScriptEvaluator? {
        get {
            return self._script_evaluator
        }
        set (script_evaluator) {
            self._script_evaluator = script_evaluator
        }
    }

    public override init() {
        super.init()
        Self._native_function_registry["_registerJavaScriptFunction"] = .mayThrow {[weak self] args in
            try self?._registerJavaScriptFunction(args[0] as! String)
        }
    }
    
    private static var _action_queue: [String: [() -> Void]] = [:]
    
    /**
     * A mutable dictionary of native functions.
     * Each of keys represents a function name.
     */
    private static var _native_function_registry: [String: ClosureKind] = [:]
    
    /**
     * A mutable dictionary of handles of JavaScript functions.
     * Each of keys is an id of the corresponding value.
     */
    private static var _js_function_handle_registry: [Int64: HandleObject] = [:]
    
    /**
     * A mutable dictionary of ids of JavaScript function handles.
     * Each of keys represents a function name.
     */
    private static var _js_functions_frequently_used: [String: HandleObject] = [:]
    
    /**
     * A mutable array of function names.
     */
    private static var _js_functions_last_used: [String] = []
    private static let JS_FUNCTIONS_FREQUENTLY_USED_CAPACITY = 8
    
    /**
     * Evaluate given script on the [WebView].
     *
     * - parameter script:
     *   a string representing a sequence of JavaScript statements to be evaluated.
     * - parameter completion_handler:
     *   a callback function which captures an evaluation result.
     *
     * The result is the same as the value of the last evaluated statement in the given script.
     * So if you give a sequence of statements,
     * the callback will be passed the value of the expression statement lastly evaluated.
     *
     * If you don't need to get the evaluation result, you can pass `nil` as the argument `completion_handler`.
     */
    private func evaluateJavaScript(
        _ script: String,
        completionHandler completion_handler: ((Any?) -> Void)?
    ) {
        _script_evaluator!.evaluate(script, completionHandler: completion_handler)
    }

    @available(iOS 15.0, *)
    private func evaluateJavaScript(_ script: String) async throws -> Any? {
        return try await _script_evaluator!.evaluate(script)
    }
    
    /**
     * Register a handle associated with the target JavaScript function.
     * After registration, registered function can be invoked via [callJavaScriptFunction]
     * from the Native land.
     *
     * This method is called from the JavaScript land via `Alier.registerFunction()`.
     *
     * - parameter function_handle_json:
     *   a JSON string representing a handle object associated with the target JavaScript function.
     * - see callJavaScriptFunction
     */
    func _registerJavaScriptFunction(_ function_handle_json: String) throws {
        let handle_obj = try HandleObject.decode(json: function_handle_json)
        Self._js_function_handle_registry[handle_obj.id] = handle_obj
    }
    
    /**
     * Call a function on the JavaScript land by handle.
     *
     * What function can be invoked is determined
     * by [_registerJavaScriptFunction] invoked ordinarily from the JavaScript land.
     *
     * - parameter dispose:
     *   a boolean representing whether or not to dispose the function handle.
     *   Dispose the function after execution if `dispose` is `true`,
     *   do nothing otherwise.
     * - parameter handle:
     *   a handle associated with the function to be executed.
     * - parameter args:
     *   an array of arguments to be passed to the target function.
     * - parameter completion_handler:
     *   a callback function called after execution of the target function.
     *
     * - throws InvocationError.UNSUPPORTED_TYPE_CONVERSION:
     *   when the given arguments contain a value with an unsupported type.
     * - see _registerJavaScriptFunction
     */
    public func callJavaScriptFunction(
        dispose: Bool = false,
        handle: HandleObject,
        args: [Any?],
        completionHandler completion_handler: ((Any?) -> Void)?
    ) throws {
        evaluateJavaScript(
            "(Alier.Sys._functionCallReceiver(\(dispose), \(String(handle)), \(try toJavaScriptValue(args))));",
            completionHandler: completion_handler
        )
    }

    @available(iOS 15.0, *)
    public func callJavaScriptFunction(
        dispose: Bool = false,
        handle: HandleObject,
        args: [Any?]
    ) async throws -> Any? {
        return try await evaluateJavaScript(
            "(Alier.Sys._functionCallReceiver(\(dispose), \(String(handle)), \(try toJavaScriptValue(args))));"
        )
    }

    
    private func getFunctionHandle(_ function_name: String) -> HandleObject? {
        var handle = Self._js_functions_frequently_used[function_name]
        if handle == nil {
            for value in Self._js_function_handle_registry.values {
                if (value.name == function_name) {
                    handle = value
                    break
                }
            }
            if handle == nil {
                return nil
            }
        }
        /// MARK: Is synchronization needed here?
        Self._js_functions_frequently_used[function_name] = handle
        if Self._js_functions_last_used.count >= Self.JS_FUNCTIONS_FREQUENTLY_USED_CAPACITY {
            let removed = Self._js_functions_last_used.remove(at: 0)
            Self._js_functions_frequently_used.removeValue(forKey: removed)
        }
        if !Self._js_functions_last_used.contains(function_name) {
            Self._js_functions_last_used.append(function_name)
        }
        return handle
    }
    
    /**
     * Call a function on the JavaScript land by name.
     *
     * What function can be invoked is determined
     * by [_registerJavaScriptFunction] invoked ordinarily from the JavaScript land.
     *
     * - parameter function_name:
     *   a string representing the name of the function to be executed.
     * - parameter args:
     *   an array of arguments to be passed to the target function.
     * - parameter completion_handler:
     *   a callback function called after execution of the target function.
     *
     * - throws InvocationError.FUNCTION_NOT_REGISTERED:
     *   when the given function name `function_name` is not registered.
     * - see _registerJavaScriptFunction
     */
    public func callJavaScriptFunction(
        functionName function_name: String,
        args: [Any?],
        completionHandler completion_handler: ((Any?) -> Void)?
    ) throws {
        guard let handle = getFunctionHandle(function_name) else {
            throw InvocationError.FUNCTION_NOT_REGISTERED
        }
        
        try callJavaScriptFunction(
            dispose: false,
            handle: handle,
            args: args,
            completionHandler: completion_handler
        )
    }
    
    @available(iOS 15.0, *)
    public func callJavaScriptFunction(
        functionName function_name: String,
        args: [Any?]
    ) async throws -> Any? {
        guard let handle = getFunctionHandle(function_name) else {
            throw InvocationError.FUNCTION_NOT_REGISTERED
        }
        
        return try await callJavaScriptFunction(
            dispose: false,
            handle: handle,
            args: args
        )
    }

    private func updateNativeFunctionRegistry(update: Bool, functionName function_name: String, function: ClosureKind) throws {
        /// MARK: Is it needed to lock `_native_function_registry` here?
        if Self._native_function_registry[function_name] != nil {
            if update {
                AlierLog.w(
                    id: 0,
                    message: "registerFunction(): Function `\(function_name)` is already registered."
                )
            } else {
                throw InvocationError.FUNCTION_NAME_DUPLICATED
            }
        }
        Self._native_function_registry[function_name] = function
    }
    
    /**
     * Register a function to allow calling it from the JavaScript land.
     *
     * - parameter update:
     *   a flag indicating whether or not to replace a function
     *   if the given function name is already used for another function.
     *   If `update` is `true`, replacing is allowed.
     * - parameter function_name:
     *   a string representing a name for the function to be registered.
     * - parameter function:
     *   a function object to be registered.
     * - parameter completion_handler:
     *   a callback function to be called after registration.
     *
     * - throws InvocationError.FUNCTION_NAME_DUPLICATED:
     *   when `update` is `false` and a function named `function_name` was already registered.
     * - throws InvocationError.FUNCTION_NOT_REGISTERED:
     *   when  `"_registerNativeFunction"` was not registered.
     * - see registerFunction
     * - see replaceFunction
     */
    private func _registerFunctionImpl(
          update: Bool = false
        , isSync is_sync: Bool
        , functionName function_name: String
        , function: ClosureKind
        , completionHandler completion_handler: ((Any?) -> Void)?
    ) throws {
        try updateNativeFunctionRegistry(update: update, functionName: function_name, function: function)
        try callJavaScriptFunction(
            functionName: "_registerNativeFunction",
            args: [function_name, is_sync],
            completionHandler: completion_handler
        )
    }
    
    @available(iOS 15.0, *)
    private func _registerFunctionImpl(
          update: Bool = false
        , isSync is_sync: Bool
        , functionName function_name: String
        , function: ClosureKind
    ) async throws -> Any? {
        try updateNativeFunctionRegistry(update: update, functionName: function_name, function: function)
        return try await callJavaScriptFunction(
            functionName: "_registerNativeFunction",
            args: [function_name, is_sync]
        )
    }

    
    /**
     * Register a function to allow calling it from the JavaScript land.
     *
     * - parameter function_name:
     *   a string representing a name for the function to be registered.
     * - parameter function:
     *   a function object to be registered.
     * - parameter completion_handler:
     *   a callback function to be called after registration.
     *
     * - throws InvocationError.FUNCTION_NAME_DUPLICATED:
     *   when a function named `function_name` is already registered.
     * - see _registerFunctionImpl
     * - see replaceFunction
     */
    public func registerFunction(
        isSync is_sync: Bool = false,
        functionName function_name: String,
        function: @escaping ([Any?]) -> Any?,
        completionHandler completion_handler: ((Any?) -> Void)?
    ) throws {
        try _registerFunctionImpl(
            update: false,
            isSync: is_sync,
            functionName: function_name,
            function: .noThrows(function),
            completionHandler: completion_handler
        )
    }
    
    @available(iOS 15.0, *)
    public func registerFunction(
        isSync is_sync: Bool = false,
        functionName function_name: String,
        function: @escaping ([Any?]) -> Any?
    ) async throws -> Any? {
        return try await _registerFunctionImpl(
            update: false,
            isSync: is_sync,
            functionName: function_name,
            function: .noThrows(function)
        )
    }


    public func registerFunction(
        isSync is_sync: Bool = false,
        functionName function_name: String,
        function: @escaping ([Any?]) throws -> Any?,
        completionHandler completion_handler: ((Any?) -> Void)?
    ) throws {
        try _registerFunctionImpl(
            update: false,
            isSync: is_sync,
            functionName: function_name,
            function: .mayThrow(function),
            completionHandler: completion_handler
        )
    }
    @available(iOS 15.0, *)
    public func registerFunction(
        isSync is_sync: Bool = false,
        functionName function_name: String,
        function: @escaping ([Any?]) throws -> Any?
    ) async throws -> Any? {
        return try await _registerFunctionImpl(
            update: false,
            isSync: is_sync,
            functionName: function_name,
            function: .mayThrow(function)
        )
    }

    /**
     * Register or replace a function to allow calling it from the JavaScript land.
     *
     * - parameter function_name:
     *   a string representing a name for the function to be registered.
     * - parameter function:
     *   a function object to be registered.
     * - parameter completion_handler:
     *   a callback function to be called after registration.
     *
     * - see registerFunction
     * - see _registerFunctionImpl
     */
    public func replaceFunction(
        isSync is_sync: Bool = false,
        functionName function_name: String,
        function: @escaping ([Any?]) -> Any?,
        completionHandler completion_handler: ((Any?) -> Void)?
    ) {
        /// MARK: _registerFunctionImpl will not throw an error when update is true.
        try! _registerFunctionImpl(
            update: true,
            isSync: is_sync,
            functionName: function_name,
            function: .noThrows(function),
            completionHandler: completion_handler
        )
    }

    @available(iOS 15.0, *)
    public func replaceFunction(
        isSync is_sync: Bool = false,
        functionName function_name: String,
        function: @escaping ([Any?]) -> Any?
    ) async -> Any? {
        /// MARK: _registerFunctionImpl will not throw an error when update is true.
        return try! await _registerFunctionImpl(
            update: true,
            isSync: is_sync,
            functionName: function_name,
            function: .noThrows(function)
        )
    }

    public func replaceFunction(
        isSync is_sync: Bool = false,
        functionName function_name: String,
        function: @escaping ([Any?]) throws -> Any?,
        completionHandler completion_handler: ((Any?) -> Void)?
    ) {
        /// MARK: _registerFunctionImpl will not throw an error when update is true.
        try! _registerFunctionImpl(
            update: true,
            isSync: is_sync,
            functionName: function_name,
            function: .mayThrow(function),
            completionHandler: completion_handler
        )
    }
    
    @available(iOS 15.0, *)
    public func replaceFunction(
        isSync is_sync: Bool = false,
        functionName function_name: String,
        function: @escaping ([Any?]) throws -> Any?
    ) async -> Any? {
        /// MARK: _registerFunctionImpl will not throw an error when update is true.
        return try! await _registerFunctionImpl(
            update: true,
            isSync: is_sync,
            functionName: function_name,
            function: .mayThrow(function)
        )
    }

    private func functionCallReceiver(
        functionName function_name: String,
        callbackHandle callback_handle: HandleObject,
        args: [Any?]
    ) {
        try! _registerJavaScriptFunction(String(callback_handle))

        guard let f = Self._native_function_registry[function_name] else {
            try! callJavaScriptFunction(
                dispose: true,
                handle: callback_handle,
                args: [ [ "error": [ "message": "Function \"\(function_name)\" not defined" ]] ],
                completionHandler: nil
            )
            return
        }

        do {
            let result = try f.call(args)

            // invoke the callback function associated with
            // the given handle for returning the result to JS land.
            try callJavaScriptFunction(
                dispose: true,
                handle: callback_handle,
                args: [ [ "result": result ] ],
                completionHandler: nil
            )
        } catch {
            try! callJavaScriptFunction(
                dispose: true,
                handle: callback_handle,
                args: [ [ "error": [ "message": error.localizedDescription] ] ],
                completionHandler: nil
            )
        }
    }
    
    private func replaceSpecialString(_ s: String) -> Any? {
        switch s {
        case "null":
            return nil
        case "undefined":
            return () // Void
        case "Infinity":
            return Double.infinity
        case "-Infinity":
            return -Double.infinity
        case "NaN":
            return Double.nan
        case "true":
            return true
        case "false":
            return false
        default:
            return s
        }
    }
    
    private func replaceSpecialValuesFromDictionary(_ dict_ref: inout [String: Any?]) {
        for (key, item) in dict_ref {
            switch item {
            case let s as String:
                dict_ref[key] = replaceSpecialString(s)
            case var arr as [Any?]:
                replaceSpecialValuesFromArray(&arr)
                dict_ref[key] = arr
            case var dict as [String: Any?]:
                replaceSpecialValuesFromDictionary(&dict)
                dict_ref[key] = dict
            default:
                break
            }
        }
    }
    
    private func replaceSpecialValuesFromArray(_ array_ref: inout [Any?]) {
        for i in array_ref.indices {
            let item = array_ref[i]
            switch item {
            case let s as String:
                array_ref[i] = replaceSpecialString(s)
            case var arr as [Any?]:
                replaceSpecialValuesFromArray(&arr)
                array_ref[i] = arr
            case var dict as [String: Any?]:
                replaceSpecialValuesFromDictionary(&dict)
                array_ref[i] = dict
            default:
                break
            }
        }
    }
    
    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        switch message.name {
            case ScriptMessageName.functionCallReceiver.rawValue:
                guard let body = message.body as? [String: Any?] else {
                    AlierLog.e(
                        id: 0,
                        message: "userContentController(): a dictionary passed as a body was expected. (message:  \"\(message.name)\")"
                    )
                    break
                }
                guard var args = body["args"] as? [Any?] else {
                    AlierLog.e(
                        id: 0,
                        message: "userContentController(): `args` not provided as a message posted to \"\(message.name)\""
                    )
                    break
                }
                guard let function_name = body["function_name"] as? String else {
                    AlierLog.e(
                        id: 0,
                        message: "userContentController(): `function_name` not provided as a message posted to \"\(message.name)\""
                    )
                    break
                }
                guard let raw_handle = body["callback_handle"] as? [String : Any?] else {
                    AlierLog.e(
                        id: 0,
                        message: "userContentController(): `callback_handle` not provided as a message posted to  \"\(message.name)\""
                    )
                    break
                }
                guard let handle_id = raw_handle["id"] as? String else {
                    AlierLog.e(
                        id: 0,
                        message: "userContentController(): `callback_handle.id` not defined"
                    )
                    break
                }
                guard let handle_id_int64 = Int64(handle_id) else {
                    AlierLog.e(
                        id: 0,
                        message: "userContentController(): `callback_handle.id` is not an integer"
                    )
                    break
                }
                guard let handle_type = raw_handle["type"] as? String else {
                    AlierLog.e(
                        id: 0,
                        message: "userContentController(): `callback_handle.type` not defined"
                    )
                    break
                }
                guard let handle_name = raw_handle["name"] as? String else {
                    AlierLog.e(
                        id: 0,
                        message: "userContentController(): `callback_handle.name` not defined"
                    )
                    break
                }
            
                replaceSpecialValuesFromArray(&args)
            
                let handle_obj = HandleObject(
                    id: handle_id_int64,
                    type: handle_type,
                    name: handle_name
                )
            
                functionCallReceiver(
                    functionName: function_name,
                    callbackHandle: handle_obj,
                    args: args
                )
            case ScriptMessageName._recvstat.rawValue:
                guard let msg = message.body as? String else {
                    break
                }
                _recvstat(msg)
            default:
                break
        }
    }
    
    public func _recvstat(_ message: String) {
        let key = message == "" ? "default" : message
        guard var actions = Self._action_queue[key] else { return }
        while (actions.count > 0) {
            let action = actions.remove(at: 0)
            action()
        }
    }
    
    public func _sendstat(_ message: String = "default") {
        self.evaluateJavaScript("Alier.Sys._recvstat('\(message)');", completionHandler: nil)
    }
    
    public func _wait(_ message: String = "default", action: @escaping (() -> Void)) {
        let key = message == "" ? "default" : message
        if Self._action_queue[key] == nil {
            Self._action_queue[key] = []
        }
        Self._action_queue[key]!.append(action)
    }
    // Function executed when prompt() is called in javascript
    public func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        guard let prompt_data = prompt.data(using: .utf8) else {
            completionHandler(try! asJson([ "error" : [ "message": "functionCallReceiverSync(): Couldn't convert the given prompt to UTF-8 bytes." ]]))
            return
        }
        let json_value: Any
        do {
            json_value = try JSONSerialization.jsonObject(with: prompt_data)
        } catch {
            completionHandler(try! asJson([ "error": [ "message": "functionCallReceiverSync(): The given prompt was an invalid JSON. reason: \(error.localizedDescription)" ]]))
            return
        }
        guard var json_obj = json_value as? [String: Any] else {
            completionHandler(try! asJson([ "error": [ "message": "functionCallReceiverSync(): The given JSON not conform with JSON Object type." ] ]))
            return
        }
        // decode json stringify text.

        guard let function_name = json_obj.removeValue(forKey: "function_name") as? String else {
            completionHandler(try! asJson([ "error": [ "message": "functionCallReceiverSync(): `function_name` was not specified in the given JSON." ]]))
            return
        }
        guard var args = json_obj.removeValue(forKey: "args") as? [Any?] else {
            completionHandler(try! asJson([ "error": [ "message": "functionCallReceiverSync(): `args` was not specified in the given JSON." ]]))
            return
        }
        
        replaceSpecialValuesFromArray(&args)
        
        guard let f = Self._native_function_registry[function_name] else {
            //throw InvocationError.FUNCTION_NOT_REGISTERED
            completionHandler(try! asJson([ "error": [ "message": "functionCallReceiverSync(): The given function was not registered." ]]))
            return
        }

        let return_value: [String: Any?]
        do {
            guard let result = try f.call(args) else {
                completionHandler(try! asJson([ "result": "null" ]))
                return
            }
            return_value = [ "result": result ]
        } catch {
            completionHandler(try! asJson([ "error": [ "message": "functionCallReceiverSync(): \(error.localizedDescription)" ]]))
            return
        }

        do {
            completionHandler(try asJson(return_value))
            return
        } catch {
            completionHandler(try! asJson([ "error": [ "message": "functionCallReceiverSync(): Couldn't convert return value to JSON. reason: \(error.localizedDescription)"]]))
            return
        }
    }
}
