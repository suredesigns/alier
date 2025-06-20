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
import os

// Log for iOS
public class AlierLog {
    public enum LogLevel: Int {
        case DEBUG = 0
        case INFO = 1
        case WARN = 2
        case ERROR = 3
        case FAULT = 4
        
        var name: String {
             switch self {
             case .DEBUG: return "DEBUG"
             case .INFO:  return "INFO"
             case .WARN:  return "WARN"
             case .ERROR: return "ERROR"
             case .FAULT: return "FAULT"
             }
        }
    }
    private static var minLogLevel: LogLevel = LogLevel.DEBUG
    private static var startId: Int = 0
    private static var endId: Int = Int.max
    
    public static func filter(level: LogLevel, start: Int, end: Int) {
        minLogLevel = level
        startId = start < 0 ? 0 : start
        endId = end < 0 ? 0 : (end < start ? start : end)
    }
    
    public static func loadLogFilter() {
        let fileName = "LogFilter"
        let ext = "ini"
        let pr = _PathRegistry()
        var url = pr.getAppResDir()
        url = url.appendingPathComponent(fileName)
        url = url.appendingPathExtension(ext)
        if !pr.isFile(atPath: url.relativePath) {
            if (fileName == "LogFilter") {
                AlierLog.i(id: 0, message: "File not found : " + fileName + "." + ext)
            } else {
                AlierLog.w(id: 0, message: "File not found : " + fileName + "." + ext)
            }
            return
        }
        var contents: String
        do {
            contents = try String(contentsOf: url, encoding: .utf8)
        } catch {
            AlierLog.w(id: 0, message: "File read error : " + fileName + "." + ext)
            return
        }
        var level = minLogLevel
        var start = startId
        var end   = endId
        contents.enumerateLines { (line, stop) -> () in
            let notSpace = line.filter{ !$0.isWhitespace }
            let item = notSpace.components(separatedBy: CharacterSet(charactersIn: "=,."))
            if item.count >= 2 {
                if let value = Int(item[1]) {
                    switch (item[0]) {
                    case "level": level = LogLevel(rawValue: value)!
                    case "start": start = value
                    case "end": end = value
                    default: break
                    }
                }
            }
        }
        filter(level: level, start: start, end: end)
    }
    
    public static func getLogFilter() -> String {
        return "\(minLogLevel.rawValue),\(startId),\(endId)"
    }
    
    public static func d(id: Int, message: String) {
        log(level: LogLevel.DEBUG, id: id, message: message)
    }
    public static func d(_ id: Int, _ message: String) {
        log(level: LogLevel.DEBUG, id: id, message: message)
    }
    
    public static func i(id: Int, message: String) {
        log(level: LogLevel.INFO, id: id, message: message)
    }
    
    // Swift does not have a warning log level, so it outputs at the info log level.
    public static func w(id: Int, message: String) {
        log(level: LogLevel.WARN, id: id, message: message)
    }
    
    public static func e(id: Int, message: String) {
        log(level: LogLevel.ERROR, id: id, message: message)
    }
    
    public static func f(id: Int, message: String) {
        log(level: LogLevel.FAULT, id: id, message: message)
    }
    
    private static func log(level: LogLevel, id: Int, message: String) {
        if level.rawValue < minLogLevel.rawValue { return }
        if id >= 1000 && !(startId <= id && id <= endId) { return }
        if id < 0 { return }

//        let logger = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "alier:Native:\(level.name):\(String(format:"%04d", id))")
        let logger = Logger(subsystem: "alier_logger", category: "alier:Native:\(level.name):\(String(format:"%04d", id))")

        var logType: OSLogType = .debug
        
        switch (level) {
            case LogLevel.DEBUG : logType = .default
            case LogLevel.INFO  : logType = .info
            case LogLevel.WARN  : logType = .info
            case LogLevel.ERROR : logType = .error
            case LogLevel.FAULT : logType = .fault
        }
        
        logger.log(level: logType, "[\(id)] \(message,privacy: .public)")
    }
}

// 2025/01/10: dump file Provisional support
public class AlierDump {
    public enum LogLevel: Int {
        case DEBUG = 0
        case INFO = 1
        case WARN = 2
        case ERROR = 3
        case FAULT = 4
        
        var name: String {
             switch self {
             case .DEBUG: return "DEBUG"
             case .INFO:  return "INFO"
             case .WARN:  return "WARN"
             case .ERROR: return "ERROR"
             case .FAULT: return "FAULT"
             }
        }
    }
    private static var minLogLevel: LogLevel = LogLevel.WARN
    private static var startId: Int = 0
    private static var endId: Int = Int.max
    
    public static func filter(level: LogLevel, start: Int, end: Int) {
        minLogLevel = level
        startId = start < 0 ? 0 : start
        endId = end < 0 ? 0 : (end < start ? start : end)
    }
    
    public static func loadLogFilter() {
        let fileName = "LogFilter"
        let ext = "ini"
        let pr = _PathRegistry()
        var url = pr.getAppResDir()
        url = url.appendingPathComponent(fileName)
        url = url.appendingPathExtension(ext)
        if !pr.isFile(atPath: url.relativePath) {
            AlierLog.w(id: 0, message: "File not found : " + fileName + "." + ext)
            return
        }
        var contents: String
        do {
            contents = try String(contentsOf: url, encoding: .utf8)
        } catch {
            AlierLog.w(id: 0, message: "File read error : " + fileName + "." + ext)
            return
        }
        var level = minLogLevel
        var start = startId
        var end   = endId
        contents.enumerateLines { (line, stop) -> () in
            let notSpace = line.filter{ !$0.isWhitespace }
            let item = notSpace.components(separatedBy: CharacterSet(charactersIn: "=,."))
            if item.count >= 2 {
                if let value = Int(item[1]) {
                    switch (item[0]) {
                    case "level": level = LogLevel(rawValue: value)!
                    case "start": start = value
                    case "end": end = value
                    default: break
                    }
                }
            }
        }
        filter(level: level, start: start, end: end)
    }
    
    public static func getLogFilter() -> String {
        return String(minLogLevel.rawValue) + "," + String(startId) + "," + String(endId)
    }
    
    public static func d(id: Int, message: Any) {
        log(level: LogLevel.DEBUG, id: id, message: message)
    }
    
    public static func i(id: Int, message: Any) {
        log(level: LogLevel.INFO, id: id, message: message)
    }
    
    // Swift does not have a warning log level, so it outputs at the info log level.
    public static func w(id: Int, message: Any) {
        log(level: LogLevel.WARN, id: id, message: message)
    }
    
    public static func e(id: Int, message: Any) {
        log(level: LogLevel.ERROR, id: id, message: message)
    }
    
    public static func f(id: Int, message: Any) {
        log(level: LogLevel.FAULT, id: id, message: message)
    }
    
    private static func log(level: LogLevel, id: Int, message: Any) {
        if level.rawValue < minLogLevel.rawValue { return }
        if id >= 1000 && !(startId <= id && id <= endId) { return }
        if id < 0 { return }

        let logMessage = ["alier:Native:\(level.name)":message ]
        dump(logMessage)
    }
}
