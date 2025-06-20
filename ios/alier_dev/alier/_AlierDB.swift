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
import SQLite3

private func asSqlIdentifier(_ identifier: String) -> String {
    let expr = try! NSRegularExpression(pattern: "^[_a-zA-Z][_a-zA-Z0-9]*$")
    if expr.firstMatch(in: identifier, range: NSRange(location: 0, length: identifier.utf16.count)) != nil {
        return identifier
    } else {
        return "\"\(identifier.replacingOccurrences(of: "\"", with: "\"\""))\""
    }
    
}

public struct SQLiteError: Error {
    init(code: Int32, message: String) {
        self.code = code
        self.message = message
    }
    
    let code: Int32
    let message: String
}

public struct GenericError: Error {
    init(message: String, cause: Error? = nil) {
        self.message = message
        self.cause = cause
    }
    
    let message: String
    let cause: Error?
}

public enum DBError: Error {
    case sqliteError(code: Int32, message: String)
    case genericError(message: String, cause: Error? = nil)
}

extension DBError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .sqliteError(code: let code, message: let message):
            return "SQLite error: \(code): \(message)"
        case .genericError(message: let message, cause: let cause):
            if let cause = cause {
                return "\(message)\ncaused by: \(cause.localizedDescription)"
            } else {
                return message
            }
        }
    }
}

/// An enum representing the execution result of SQL statements.
public enum SQLResult {
    case success(records: [[String: Any?]]? = nil)
    case failure(message: String? = nil)
    
    func toDict() -> [String: Any?] {
        switch self {
        case .success(records: let records):
            if let records_ = records {
                return [ "status": true, "records": records_ ]
            } else {
                return [ "status": true ]
            }
        case .failure(message: let message):
            if let message_ = message {
                return [ "status": false, "message": message_ ]
            } else {
                return [ "status": false ]
            }
        }
    }
}

/// A simple wrapper for SQLite3 APIs.
public class SQLiteDatabase {
    /// An `OpaquePointer` pointing to the SQLite database.
    private var _sqlite: OpaquePointer? = nil
    
    private init(_ sqlite: OpaquePointer? = nil) {
        self._sqlite = sqlite
    }
    
    deinit {
        try? close()
    }
    
    /// Closes the target SQLite database.
    ///
    /// -  Throws:
    ///    - `DBError.sqliteError`:
    ///       - When failed to close the database for some reason.
    func close() throws {
        guard let sqlite = _sqlite else {
            return
        }
        
        let code = sqlite3_close_v2(sqlite)
        if code != SQLITE_OK {
            let message = Self.getErrorString(code)
            throw DBError.sqliteError(code: code, message: message)
        }
        
        // Erase the database pointer to invalidate.
        _sqlite = nil
    }
    
    /// Gets the last error from the target SQLite database.
    ///
    /// -  Returns:
    ///    A string describing the last error.
    ///    If the target `SQLiteDatabase` is already closed, then an empty string is returned.
    func lastError() -> String {
        guard let sqlite = _sqlite else {
            // already closed
            return ""
        }

        if let cstr = sqlite3_errmsg(sqlite) {
            return String(cString: cstr)
        } else {
            return ""
        }
    }
    
    /// Compiles the given SQL statement for future use.
    ///
    /// -  Parameters:
    ///    - statement: the SQL statement to compile.
    ///
    /// -  Returns:
    ///    An `SQLiteStatement` which manages the compiled statement.
    ///
    /// -  Throws:
    ///    - `DBError.genericError`:
    ///       - When SQLite returns `SQLITE_OK`; however, no valid pointer for a prepared statement is provided after compiling.
    ///       - When the database is already closed.
    ///    - `DBError.sqliteError`:
    ///       - When failed to compile the statement for some reason.
    func prepare(statement: String) throws -> SQLiteStatement {
        let sqlite = try _getPointerOrThrow()
        var ps: OpaquePointer? = nil
        
        // Invoke the `sqlite3_prepare_v2()` C API to compile the given SQL statement.
        // For more details, see: https://www.sqlite.org/c3ref/prepare.html
        let code = sqlite3_prepare_v2(sqlite, statement, -1, &ps, nil)
        
        switch code {
        case SQLITE_OK:
            guard let ps_ = ps else {
                let message = "SQLITE_OK (\(SQLITE_OK)) is returned; however, no valid pointer for a prepared statement is provided after compiling"
                throw DBError.genericError(message: message)
            }
            return SQLiteStatement(database: self, statement: ps_)
        default:
            let message = Self.getErrorString(code)
            throw DBError.sqliteError(code: code, message: message)
        }
    }
    
    /// Executes the given SQL statement.
    /// 
    /// -  Parameters:
    ///    - statement:
    ///      the SQL statement to compile.
    ///    - params: An optional parameters to bind with the statement.
    ///    - buffer_ptr:
    ///      A pointer to the buffer to write records retrieved from the database, or `nil`.
    ///      If the `recordBufferPointer` is `nil`, this function skip to retrieve the records.
    ///    - busy_timeout_ms:
    ///      A 32-bit signed integer representing the duration of sleep to wait for the database to unlock in milliseconds.
    ///      By default, the duration of sleep is set to 1000 ms.
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - When the database is already closed.
    ///    -  `DBError.sqliteError`:
    ///       - When failed to execute the statement for some reason.
    func execute(
        statement: String,
        bindingParameters params: [Any?]? = nil,
        recordBufferPointer buffer_ptr: UnsafeMutablePointer<[[String: Any?]]>? = nil,
        busyTimeoutMilliseconds busy_timeout_ms: Int32 = 1000
    ) throws {
        let ps = try prepare(statement: statement)
        
        if let params_ = params {
            try ps.bindAll(params_)
        }

        try ps.execute(recordBufferPointer: buffer_ptr, busyTimeoutMilliseconds: busy_timeout_ms)
        try ps.finalize()
    }
    
    /// Get the new `user_version` to the SQLite database.
    ///
    /// - Returns:
    ///   The current `user_version` of the SQLite database.
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - When the database is already closed.
    ///    -  `DBError.sqliteError`:
    ///       - When failed to execute the `PRAGMA user_version` statement for some reason.
    func getUserVersion() throws -> Int32 {
        var records: [[String: Any?]] = []
        try execute(statement: "PRAGMA user_version", recordBufferPointer: &records)
                
        let user_version = Int32(records.first!["user_version"] as! Int)
        
        return user_version
    }
    
    /// Set the new `user_version` to the SQLite database.
    ///
    /// - Parameters:
    ///   - new_version:
    ///     An integer representing the `user_version` to newly set to the database.
    ///
    /// - Returns:
    ///   The previous `user_version` of the SQLite database.
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - When the database is already closed.
    ///    -  `DBError.sqliteError`:
    ///       - When failed to execute the `PRAGMA user_version = <new_version>` statement for some reason.
    @discardableResult
    func setUserVersion(newVersion new_version: Int32) throws -> Int32 {
        let old_version = try getUserVersion()
        
        //  PRAGMA does not support placeholders and hence embed the new version into the statement directly.
        try execute(statement: "PRAGMA user_version = \(new_version)")

        return old_version
    }
    
    /// Opens an SQLite database.
    ///
    /// -  Parameters:
    ///    - filePath: A path to the SQLite database file to open.
    ///    - sqliteOpenFlags: A combination of any kind of `SQLITE_OPEN_*` flags. Valid flags are listed here: <https://www.sqlite.org/c3ref/open.html>
    ///    - vfs: The name of the Virtual File System (VFS) object to use. If it is `nil`, the default VFS object is used. For more details, see: <https://www.sqlite.org/vfs.html>
    ///
    /// -  Returns:
    ///    An `SQLiteDatabase` which manages the opened database.
    ///
    /// -  Throws:
    ///    - `DBError.genericError`:
    ///       - When SQLite returns `SQLITE_OK`; however, no valid pointer for a database is provided after opening.
    ///    - `DBError.sqliteError`:
    ///       - When failed to open a database for some reason.
    static func open(
        filePath: String,
        sqliteOpenFlags: Int32 = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE,
        vfs: String? = nil
    ) throws -> SQLiteDatabase {
        var sqlite: OpaquePointer? = nil
        
        //  Invoke the `sqlite3_open_v2()` C API to open an SQLite database.
        //  For more details, see: <https://www.sqlite.org/c3ref/open.html>
        let code = sqlite3_open_v2(filePath, &sqlite, sqliteOpenFlags, vfs)
        
        switch code {
        case SQLITE_OK:
            if let sqlite_ = sqlite {
                return SQLiteDatabase(sqlite_)
            } else {
                let message = "SQLITE_OK (\(SQLITE_OK)) is returned; however, no valid pointer for a database is provided after opening"
                throw DBError.genericError(message: message)
            }
        default:
            let message = getErrorString(code)
            throw DBError.sqliteError(code: code, message: message)
        }
    }
    
    /// Gets an error string corresponding to the given error code on SQLite3 C API.
    ///
    /// - Parameters:
    ///    - code: An SQLite3 error code. all the codes is listed here: <https://www.sqlite.org/rescode.html>
    ///
    /// - Returns:
    ///    A string describing the error.
    static func getErrorString(_ code: Int32) -> String {
        //  Invoke the `sqlite3_errstr()` C API to get the error message associated with the error code.
        //  For more details, see: <https://www.sqlite.org/c3ref/errcode.html>
        return String(cString: sqlite3_errstr(code))
    }
    
    private func _getPointerOrThrow() throws -> OpaquePointer {
        guard let sqlite = _sqlite else {
            throw DBError.genericError(message: "The database is already closed")
        }
        
        return sqlite
    }
}

/// A simple wrapper for prepared staments created from SQLite3 APIs.
class SQLiteStatement {
    private let _database: SQLiteDatabase
    private var _statement: OpaquePointer? = nil
    private var _count: Int32 = 1
    
    init(database: SQLiteDatabase, statement: OpaquePointer) {
        self._database  = database
        self._statement = statement
    }

    deinit {
        try? finalize()
    }
    
    /// Binds the given boolean value to the compiled statement.
    ///
    /// - Parameters:
    ///    -    value: A `Bool` value to bind
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bindBoolean(_ value: Bool) throws {
        return try bindInt(value ? 1 : 0)
    }
    
    /// Binds the given `Int` value as `Int32` to the compiled statement.
    ///
    /// - Parameters:
    ///    -    value: A `Int` value to bind
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bindInt(_ value: Int) throws {
        return try bindInt32(Int32(value))
    }

    /// Binds the given `Int32` value to the compiled statement.
    ///
    /// - Parameters:
    ///    -    value: A `Int32` value to bind
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bindInt32(_ value: Int32) throws {
        let ps = try _getPointerOrThrow()
        
        // Invoke `sqlite_bind_int()` C API to bind an integer.
        // For more details, see: <https://www.sqlite.org/c3ref/bind_blob.html>
        let code = sqlite3_bind_int(ps, _count, value)
        
        try _nextOrThrow(code)
    }
    
    /// Binds the given `Int64` value to the compiled statement.
    ///
    /// - Parameters:
    ///    -    value: A `Int64` value to bind
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bindInt64(_ value: Int64) throws {
        let ps = try _getPointerOrThrow()

        // Invoke `sqlite_bind_int64()` C API to bind an integer.
        // For more details, see: <https://www.sqlite.org/c3ref/bind_blob.html>
        let code = sqlite3_bind_int64(ps, _count, value)
        
        try _nextOrThrow(code)
    }

    /// Binds the given `Float` value as `Double` to the compiled statement.
    ///
    /// - Parameters:
    ///    -    value: A `Float` value to bind
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bindFloat(_ value: Float) throws {
        return try bindDouble(Double(value))
    }

    /// Binds the given `Double` value to the compiled statement.
    ///
    /// - Parameters:
    ///    -    value: A `Double` value to bind
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bindDouble(_ value: Double) throws {
        let ps = try _getPointerOrThrow()
        
        // Invoke `sqlite_bind_double()` C API to bind a double.
        // For more details, see: <https://www.sqlite.org/c3ref/bind_blob.html>
        let code = sqlite3_bind_double(ps, _count, value)
        
        try _nextOrThrow(code)
    }
    
    /// Binds the given `String` value as an UTF-8 text to the compiled statement.
    ///
    /// - Parameters:
    ///    -    value: A `String` value to bind
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bindUtf8String(_ value: String) throws {
        let ps = try _getPointerOrThrow()
        
        // Invoke `sqlite_bind_text()` C API to bind a string.
        // For more details, see: <https://www.sqlite.org/c3ref/bind_blob.html>
        let code = sqlite3_bind_text(ps, _count, value, -1, nil)

        try _nextOrThrow(code)
    }

    /// Binds `NULL` to the compiled statement.
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bindNull() throws {
        let ps = try _getPointerOrThrow()
        
        // Invoke `sqlite_bind_null()` C API to bind a `NULL`.
        // For more details, see: <https://www.sqlite.org/c3ref/bind_blob.html>
        let code = sqlite3_bind_null(ps, _count)
        
        try _nextOrThrow(code)
    }
    
    /// Binds the given `Data` value as a byte array (`BLOB`) to the compiled statement.
    ///
    /// - Parameters:
    ///    -    value: A `Data` value to bind
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bindBlob(_ value: Data) throws {
        let ps = try _getPointerOrThrow()
        
        // Invoke `sqlite_bind_blob()` C API to bind a byte array.
        // For more details, see: <https://www.sqlite.org/c3ref/bind_blob.html>
        let code = sqlite3_bind_blob(ps, _count, value.withUnsafeBytes { $0.baseAddress }, Int32(value.count), nil)

        try _nextOrThrow(code)
    }
    
    /// Binds the given parameters to the compiled statement.
    ///
    /// - Parameters:
    ///    - params
    ///      A set of parameters to bind.
    ///      Note that, `NSNumber` is always treated as `Double`.
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bind(_ params: Any?...) throws {
        try bindAll(params)
    }
    
    /// Binds the given parameters to the compiled statement.
    ///
    /// - Parameters:
    ///    - params
    ///      A set of parameters to bind.
    ///      Note that, `NSNumber` is always treated as `Double`.
    ///
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to bind for some reason.
    func bindAll(_ params: [Any?]) throws {
        for param in params {
            if let ns_number = param as? NSNumber {
                try bindDouble(ns_number.doubleValue)
                continue
            }
            switch param {
            case let bool_param as Bool:
                try bindBoolean(bool_param)
            case let uint8_param as UInt8:
                try bindInt32(Int32(uint8_param))
            case let uint16_param as UInt16:
                try bindInt32(Int32(uint16_param))
            case let uint32_param as UInt32:
                try bindInt32(Int32(bitPattern: uint32_param))
            case let uint64_param as UInt64:
                try bindInt64(Int64(bitPattern: uint64_param))
            case let uint_param as UInt:
                try bindInt(Int(bitPattern: uint_param))
            case let int8_param as Int8:
                try bindInt32(Int32(int8_param))
            case let int16_param as Int16:
                try bindInt32(Int32(int16_param))
            case let int32_param as Int32:
                try bindInt32(int32_param)
            case let int64_param as Int64:
                try bindInt64(int64_param)
            case let int_param as Int:
                try bindInt(int_param)
            case let double_param as Double:
                try bindDouble(double_param)
            case let str_param as String:
                try bindUtf8String(str_param)
            case let data_param as Data:
                try bindBlob(data_param)
            case nil:
                try bindNull()
            default:
                try _nextOrThrow(SQLITE_OK)
            }
        }
    }
    
    /// Executes the compiled statement with binding parameters.
    ///
    /// - Parameters:
    ///    - recordBufferPointer:
    ///      A pointer to the buffer to write records retrieved from the database, or `nil`.
    ///      If the `recordBufferPointer` is `nil`, this function skip to retrieve the records.
    ///    - busyTimeoutMilliseconds:
    ///      A 32-bit signed integer representing the duration of sleep to wait for the database to unlock in milliseconds.
    ///      By default, the duration of sleep is set to 1000 ms.
    /// - Returns:
    ///   `SQLITE_OK` if the execution is completed, `SQLITE_BUSY` otherwise. In the latter case
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to execute  for some reason other than `SQLITE_BUSY`.
    func execute(recordBufferPointer buffer_ptr: UnsafeMutablePointer<[[String: Any?]]>? = nil, busyTimeoutMilliseconds busy_timeout_ms: Int32 = 1000) throws {
        let ps = try _getPointerOrThrow()

        // To restore the initial state of records, memorize the initial array size.
        let init_count = buffer_ptr?.pointee.count ?? 0
        
        var busy_timeout_ms: Int32 = 1000
        var last_step: Int32 = sqlite3_step(ps)
        let use_buffer = buffer_ptr != nil
        
        while last_step == SQLITE_ROW || last_step == SQLITE_BUSY {
            if last_step == SQLITE_BUSY {
                if busy_timeout_ms <= 0 {
                    break
                }
                let busy_code = sqlite3_busy_timeout(ps, 3000)
                if busy_code != SQLITE_OK {
                    break
                }
                
                busy_timeout_ms /= 2
            } else if use_buffer {
                // last_step == SQLITE_ROW && record != nil here.
                
                let column_count = sqlite3_column_count(ps)

                var record: [String: Any?] = [:]
                record.reserveCapacity(Int(column_count))
                for i in 0..<column_count {
                    let name = String(cString: sqlite3_column_name(ps, i))
                    //  Invoke `sqlite3_column_type()` C API to get the current column data type.
                    //  And then, invoke the appropriate API to get the value of the current column.
                    //  For more details, see: <https://www.sqlite.org/c3ref/column_blob.html>
                    switch sqlite3_column_type(ps, i) {
                    case SQLITE_INTEGER:
                        record[name] = Int(sqlite3_column_int64(ps, i)) // This won't work on 32-bit platform but it's OK because 32-bit machines seem to be extinct.
                    case SQLITE_FLOAT:
                        record[name] = sqlite3_column_double(ps, i)
                    case SQLITE_BLOB:
                        let blob_len = Int(sqlite3_column_bytes(ps, i))
                        let blob_ptr = sqlite3_column_blob(ps, i)!
                        record[name] = Data(bytes: blob_ptr, count: blob_len)
                    case SQLITE_TEXT:
                        record[name] = String(cString: sqlite3_column_text(ps, i))
                    default:  // case SQLITE_NULL:
                        record[name] = nil
                    }
                }
                                
                buffer_ptr!.pointee.append(record)
            }
            
            last_step = sqlite3_step(ps)
        }
        
        try _reset()

        if last_step != SQLITE_DONE {
            // Discard the records added in the current call.
            if use_buffer {
                let diff = buffer_ptr!.pointee.count - init_count
                if diff > 0 {
                    buffer_ptr!.pointee.removeLast(diff)
                }
            }
            
            let code    = last_step
            let message = SQLiteDatabase.getErrorString(last_step)
            throw DBError.sqliteError(code: code, message: message)
        }
    }

    /// Releases the target statement.
    ///
    /// - Throws:
    ///    -  `DBError.sqliteError`: when failed to finalize for some reason.
    func finalize() throws {
        guard let ps = _statement else {
            return
        }
        
        // Invoke `sqlite3_finalize()` C API to release the compiled statement.
        // For more details, see: <https://www.sqlite.org/c3ref/finalize.html>
        let code = sqlite3_finalize(ps)
        if code != SQLITE_OK {
            let message = SQLiteDatabase.getErrorString(code)
            throw DBError.sqliteError(code: code, message: message)
        }
        
        _statement = nil
    }
    
    private func _getPointerOrThrow() throws -> OpaquePointer {
        if let ps = _statement {
            return ps
        } else {
            throw DBError.genericError(message: "Statement already finalized.")
        }
    }
    
    private func _nextOrThrow(_ code: Int32) throws {
        if code != SQLITE_OK {
            let message = SQLiteDatabase.getErrorString(code)
            throw DBError.sqliteError(code: code, message: message)
        }
        
        _count += 1
    }
    
    /// Resets the compiled state and clear its binding parameters.
    /// - Throws:
    ///    -  `DBError.genericError`:
    ///       - when the target statement is already finalized.
    ///    -  `DBError.sqliteError`:
    ///       - when failed to reset the statement for some reason
    ///       - when failed to clear the binding parameters for some reason
    private func _reset() throws {
        guard let ps = _statement else {
            return
        }
        
        //  Invoke `sqlite3_clear_bindings()` C API to reset the compiled statement.
        //  This does not clear the binding parameters.
        //  For more details, see: <https://www.sqlite.org/c3ref/reset.html>
        let reset_code = sqlite3_reset(ps)
        if reset_code != SQLITE_OK {
            let code    = reset_code
            let message = SQLiteDatabase.getErrorString(reset_code)
            throw DBError.sqliteError(code: code, message: message)
        }
        
        //  Invoke `sqlite3_clear_bindings()` C API to clear parameters binding with the compiled statement.
        //  For more details, see: <https://www.sqlite.org/c3ref/clear_bindings.html>
        let clear_bindings_code = sqlite3_clear_bindings(ps)
        if clear_bindings_code != SQLITE_OK {
            let code    = clear_bindings_code
            let message = SQLiteDatabase.getErrorString(clear_bindings_code)
            throw DBError.sqliteError(code: code, message: message)
        }
        
        _count = 1
    }
}

public class DeferredSQLiteOpen {
    private let _file_path: String
    private let _new_version: Int32
    private var _on_configure: ((SQLiteDatabase) throws -> Void)?
    private var _on_create: ((SQLiteDatabase) throws -> Void)?
    private var _on_upgrade: ((SQLiteDatabase, Int32, Int32) throws -> Void)?
    private var _on_downgrade: ((SQLiteDatabase, Int32, Int32) throws -> Void)?
    private var _on_open: ((SQLiteDatabase) throws -> Void)?

    init(
        filePath file_path: String,
        version new_version: Int32,
        onConfigure on_configure: ((SQLiteDatabase) throws -> Void)? = nil,
        onCreate on_create: ((SQLiteDatabase) throws -> Void)? = nil,
        onUpgrade on_upgrade: ((SQLiteDatabase, Int32, Int32) throws -> Void)? = nil,
        onDowngrade on_downgrade: ((SQLiteDatabase, Int32, Int32) throws -> Void)? = nil,
        onOpen on_open: ((SQLiteDatabase) throws -> Void)? = nil
    ) {
        _file_path    = file_path
        _new_version  = new_version
        _on_configure = on_configure
        _on_create    = on_create
        _on_upgrade   = on_upgrade
        _on_downgrade = on_downgrade
        _on_open      = on_open
    }
    
    private enum _CallbackKind {
        case noNeedVersions((SQLiteDatabase) throws -> Void)
        case versionsRequired((SQLiteDatabase, Int32, Int32) throws -> Void)
    }
    
    private func _doCallback(
        sqlite: SQLiteDatabase,
        oldVersion old_version: Int32,
        newVersion new_version: Int32,
        callback: _CallbackKind
    ) throws {
        do {
            switch callback {
            case .noNeedVersions(let callback_):
                try callback_(sqlite)
            case .versionsRequired(let callback_):
                try callback_(sqlite, old_version, new_version)
            }
        } catch {
            var cause = error

            //  Revert update of the `user_version` if needed.
            if old_version != new_version {
                do {
                    try sqlite.setUserVersion(newVersion: old_version)
                } catch {
                    cause = DBError.genericError(message: error.localizedDescription, cause: error)
                }
            }
            
            //  Close the database.
            do {
                try sqlite.close()
            } catch {
                throw DBError.genericError(message: error.localizedDescription, cause: cause)
            }
            
            //  Rethrow the cause even when succeeded to close the database.
            throw cause
        }
    }
    
    /// Opens an SQLite database.
    ///
    /// -  Returns:
    ///    An `SQLiteDatabase` which manages the opened database.
    ///
    /// -  Throws:
    ///    - `DBError.genericError`:
    ///       - When SQLite returns `SQLITE_OK`; however, no valid pointer for a database is provided after opening.
    ///       - When failed to do something in any of the given callbacks.
    ///    - `DBError.sqliteError`:
    ///       - When failed to open a database for some reason.
    func open() throws -> SQLiteDatabase {
        let is_new = !FileManager.default.fileExists(atPath: _file_path)

        let sqlite = try SQLiteDatabase.open(filePath: _file_path)
        let new_version = _new_version
        var old_version = new_version
        
        if let on_configure = _on_configure {
            _on_configure = nil
            try _doCallback(sqlite: sqlite, oldVersion: old_version, newVersion: new_version, callback: _CallbackKind.noNeedVersions(on_configure))
        }

        if is_new {
            old_version = try sqlite.setUserVersion(newVersion: new_version)
            if let on_create = _on_create {
                _on_create = nil
                try _doCallback(sqlite: sqlite, oldVersion: old_version, newVersion: new_version, callback: _CallbackKind.noNeedVersions(on_create))
            }
        } else {
            old_version = try sqlite.setUserVersion(newVersion: new_version)
            if old_version < new_version {
                if let on_upgrade = _on_upgrade {
                    _on_upgrade = nil
                    try _doCallback(sqlite: sqlite, oldVersion: old_version, newVersion: new_version, callback: _CallbackKind.versionsRequired(on_upgrade))
                }
            } else if old_version > new_version {
                if let on_downgrade = _on_downgrade {
                    _on_downgrade = nil
                    try _doCallback(sqlite: sqlite, oldVersion: old_version, newVersion: new_version, callback: _CallbackKind.versionsRequired(on_downgrade))
                }
            }
        }
        
        if let on_open = _on_open {
            _on_open = nil
            try _doCallback(sqlite: sqlite, oldVersion: old_version, newVersion: new_version, callback: _CallbackKind.noNeedVersions(on_open))
        }
        
        return sqlite
    }
}

enum DatabaseHandle {
    case opened(SQLiteDatabase)
    case deferred(DeferredSQLiteOpen)
}

public final class _AlierDB {
    private var _db_dict: [String: DatabaseHandle] = [:]
    
    public func addDB(
        name: String,
        version: Int32,
        onConfigure on_configure: ((SQLiteDatabase) throws -> Void)? = nil,
        onCreate on_create: ((SQLiteDatabase) throws -> Void)? = nil,
        onUpgrade on_upgrade: ((SQLiteDatabase, Int32, Int32) throws -> Void)? = nil,
        onDowngrade on_downgrade: ((SQLiteDatabase, Int32, Int32) throws -> Void)? = nil,
        onOpen on_open: ((SQLiteDatabase) throws -> Void)? = nil
    ) throws {
        let file_path = try! FileManager.default.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: false
        ).appendingPathComponent("\(name).sqlite")._path(percentEncoded: false)

        let db_open = DeferredSQLiteOpen(
            filePath: file_path,
            version: version,
            onConfigure: on_configure,
            onCreate: on_create,
            onUpgrade: on_upgrade,
            onDowngrade: on_downgrade,
            onOpen: on_open
        )
        
        _db_dict[name] = DatabaseHandle.deferred(db_open)
    }
    
    /// Closes all the databases managed by the target `_AlierDB`.
    /// 
    /// - Throws:
    ///    - `DBError.genericError`:
    ///       - When  failed to close any of the opened databases.
    public func close() throws {
        var aggregate_error: Error? = nil
        
        for name in _db_dict.keys {
            do {
                try close(name: name)
            } catch {
                let cause = error
                aggregate_error = DBError.genericError(message: cause.localizedDescription, cause: aggregate_error)
            }
        }
        
        if let error = aggregate_error {
            throw error
        }
    }
    
    /// Closes the specified database.
    ///
    /// - Parameters:
    ///   - name:
    ///     The database name to close.
    ///
    /// - Throws:
    ///    - `DBError.genericError`:
    ///       - When  failed to close the opened databases.
    public func close(name: String) throws {
        if let handle = _db_dict[name] {
            switch handle {
            case .opened(let db):
                try db.close()
            case .deferred:
                break
            }
            
            _db_dict.removeValue(forKey: name)
        }
    }
    
    /// Opens a database with the specified name.
    ///
    /// - Parameters:
    ///   - name:
    ///     The database name to open.
    ///
    /// - Returns:
    ///   An `SQLiteDatabase`.
    ///
    /// -  Throws:
    ///    - `DBError.genericError`:
    ///      - When the database with the specified name does not exist.
    ///       - When SQLite returns `SQLITE_OK`; however, no valid pointer for a database is provided after opening.
    ///       - When failed to do something in any of the callbacks provided via the `addDB()` function.
    ///    - `DBError.sqliteError`:
    ///       - When failed to open a database for some reason.
    private func _open(name: String) throws -> SQLiteDatabase {
        switch _db_dict[name] {
        case nil:
            throw DBError.genericError(message: "Database \(name) not found.")
        case .deferred(let db_open):
            return try db_open.open()
        case .opened(let db):
            return db
        }
    }
        
    /// Commits the current database state and ends the current transaction successfully.
    ///
    /// -   Parameters:
    ///    - name: The target database name.
    ///    - mode: A string representing the transaction mode.
    ///            It must be either `"exclusive"` or `"immedate"` case-insensitively.
    ///
    /// -  Throws:
    ///    - `DBError.genericError`:
    ///      - When failed to start a transaction
    public func startTransaction(name: String, mode: String) throws {
        let lc_mode = mode.lowercased()
        let mode_ = if lc_mode == "exclusive" {
            "EXCLUSIVE"
        } else if lc_mode == "immedate" {
            "IMMEDIATE"
        } else {
            "UNKNOWN"
        }

        switch execute(name: name, statement: "BEGIN \(mode_) TRANSACTION", params: []) {
        case .success:
            return
        case let .failure(message):
            throw DBError.genericError(message: message ?? "Failed to start transaction")
        }
        
    }

    /// Commits the current database state and ends the current transaction successfully.
    ///
    /// -   Parameters:
    ///    - name: The target database name.
    ///
    /// -  Throws:
    ///    - `DBError.genericError`:
    ///      - When failed to commit the current database state
    public func commit(name: String) throws {
        switch execute(name: name, statement: "COMMIT", params: []) {
        case .success:
            return
        case let .failure(message):
            throw DBError.genericError(message: message ?? "Failed to commit transaction")
        }
    }

    /// Rolls back the current database state to the previous state at the beginning of the current transaction, and then ends the current transaction in failure.
    ///
    /// -   Parameters:
    ///    - name: The target database name.
    ///
    /// -  Throws:
    ///    - `DBError.genericError`:
    ///      - When failed to rollback the current database state
    public func rollback(name: String) throws {
        switch execute(name: name, statement: "ROLLBACK", params: []) {
        case .success:
            return
        case let .failure(message):
            throw DBError.genericError(message: message ?? "Failed to rollback transaction")
        }
    }
    
    /// Puts a savepoint in the current transaction.
    ///
    /// -   Parameters:
    ///    - name: The target database name.
    ///    - savepoint: The savepoint name to put.
    ///
    /// -  Throws:
    ///    - `DBError.genericError`:
    ///      - When failed to put a savepoint
    public func putSavepoint(name: String, savepoint: String) throws {
        switch execute(name: name, statement: "SAVEPOINT \(asSqlIdentifier(savepoint))", params: []) {
        case .success:
            return
        case let .failure(message):
            throw DBError.genericError(message: message ?? "Failed to create savepoint")
        }
    }
    /// Puts a savepoint in the current transaction.
    ///
    /// -   Parameters:
    ///    - name: The target database name.
    ///    - savepoint: The savepoint name to rollback to.
    ///
    /// -  Throws:
    ///    - `DBError.genericError`:
    ///      - When failed to put a savepoint
    public func rollbackTo(name: String, savepoint: String) throws {
        switch execute(name: name, statement: "ROLLBACK TO \(asSqlIdentifier(savepoint))", params: []) {
        case .success:
            return
        case let .failure(message):
            throw DBError.genericError(message: message ?? "Failed to create savepoint")
        }
    }
    

    /// Executes the given SQL statement with the given parameters.
    ///
    /// - Parameters:
    ///   - name: The target database name.
    ///   - statement: The SQL statement to execute.
    ///   - params: The binding parameters used when executing the statement.
    ///
    /// - Returns:
    ///   The execution result of the given SQL statement on success, an error message on failure.
    public func execute(name: String, statement: String, params: Array<Any?>) -> SQLResult {
        if !_db_dict.keys.contains(name) {
            return SQLResult.failure(message: "Database does not exist: \(name)")
        }
        
        // Trim the surrounding whitespaces and new-lines.
        let statement_ = statement.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Test whether or not the given string is starting with an SQL command.
        let command_expr = try! NSRegularExpression(pattern: "^[a-zA-Z]{0,6}\\b")
        guard let command_match = command_expr.firstMatch(
            in: statement_,
            range: NSRange(location: 0, length: statement_.utf16.count)
        ) else {
            return SQLResult.failure(message: "No SQL command is specified.")
        }
        
        // Extract the SQL command from the statement.
        let command = (statement_ as NSString).substring(with: command_match.range).uppercased()
        var db: SQLiteDatabase
        do {
            db = try _open(name: name)
        } catch {
            return SQLResult.failure(message: error.localizedDescription)
        }
        
        if (command == "SELECT") {
            var records: [[String: Any?]] = []
            do {
                try db.execute(statement: statement_, bindingParameters: params, recordBufferPointer: &records)
            } catch {
                return SQLResult.failure(message: error.localizedDescription)
            }
            return SQLResult.success(records: records)
        } else {
            do {
                try db.execute(statement: statement_, bindingParameters: params)
            } catch {
                return SQLResult.failure(message: error.localizedDescription)
            }
            return SQLResult.success()
        }
    }
}
