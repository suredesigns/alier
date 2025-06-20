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

/**
 * Extension for URL
 */
public extension URL {
    enum _DirectoryHint {
        case isDirectory
        case notDirectory
        case checkFileSystem
        case inferFromPath
    }
    init(_filePath: String, _directoryHint: _DirectoryHint = .checkFileSystem, _relativeTo: URL? = nil) {
        if #available(iOS 16.0, *) {
            switch _directoryHint {
            case .isDirectory:
                self.init(filePath: _filePath, directoryHint: .isDirectory, relativeTo: _relativeTo)
            case .notDirectory:
                self.init(filePath: _filePath, directoryHint: .notDirectory, relativeTo: _relativeTo)
            case .checkFileSystem:
                self.init(filePath: _filePath, directoryHint: .checkFileSystem, relativeTo: _relativeTo)
            case .inferFromPath:
                self.init(filePath: _filePath, directoryHint: .inferFromPath, relativeTo: _relativeTo)
            }
        } else {
            switch _directoryHint {
            case .isDirectory:
                self.init(fileURLWithPath: _filePath, isDirectory: true, relativeTo: _relativeTo)
            default:
                self.init(fileURLWithPath: _filePath, relativeTo: _relativeTo)
            }
        }
    }
    func _path(percentEncoded: Bool = true) -> String {
        if #available(iOS 16.0, *) {
            return self.path(percentEncoded: percentEncoded)
        } else {
            //  URL.path remove a trailing slash but URL.path() does not.
            //  To keep compatibility with the latter, appending a trailing slash manually
            //  if the target URL has a directory path.
            let path_ = self.path + ( self.hasDirectoryPath ? "/" :  "" )
            return if percentEncoded {
                path_.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)!
            } else {
                path_
            }
        }
    }
    func _query(percentEncoded: Bool = true) -> String? {
        if #available(iOS 16.0, *) {
            return self.query(percentEncoded: percentEncoded)
        } else {
            guard let query = self.query else { return nil }
            return if percentEncoded {
                query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
            } else {
                query
            }
        }
    }
    func _appending(path: String, directoryHint: _DirectoryHint = .checkFileSystem) -> URL {
        if #available(iOS 16.0, *) {
            switch directoryHint {
            case .isDirectory:
                self.appending(path: path, directoryHint: .isDirectory)
            case .notDirectory:
                self.appending(path: path, directoryHint: .notDirectory)
            case .checkFileSystem:
                self.appending(path: path, directoryHint: .checkFileSystem)
            case .inferFromPath:
                self.appending(path: path, directoryHint: .inferFromPath)
            }
        } else {
            switch directoryHint {
            case .isDirectory:
                self.appendingPathComponent(path, isDirectory: true)
            default:
                self.appendingPathComponent(path)
            }
        }
    }
}
