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
import UniformTypeIdentifiers
import os

public class _PathRegistry {
    enum PathKind {
    case isDirectory
    case isFile
    case notExist
    }
    /**
     * Directory on App-specific storage used for Alier
     *
     * which may be `"/data/user/0/{app-package}/app_alier"`.
     */
    var frameworkRootDir: URL {
        get { return _alier_dir }
    }

    /**
     * The base URL for accessing files stored in the user's device.
     * The base URL may vary each time the application is launched.
     */
    var _alier_dir: URL {
        get {
            let default_url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            return default_url._appending(path: "Shared", directoryHint: .isDirectory)
        }
    }
    
    init(){
        self.getAppDataDir()
    }

    /**
     * Make a directory under the Alier specific directory if it doesn't exist.
     *
     * - Parameters:
     *   - dirname: the primary segment of the target directory
     *   - subdirs: a sequence of segments succeeding the primary segment
     * - Returns: an `URL` representing the target directory
     */
    @discardableResult
    public func mkdir(dirname: String, subdirs: String...) throws -> URL {
        var dir_to_be_created: URL = _alier_dir._appending(path: dirname, directoryHint: .isDirectory)
        var created_dirs: [URL] = []
        let fm = FileManager.default
        do {
            //  create `dir_to_be_created` directory if not exist
            if !isDirectory(at: dir_to_be_created) {
                try fm.createDirectory(at: dir_to_be_created, withIntermediateDirectories: true)
                created_dirs.append(dir_to_be_created)
            }
            //  create subsequent directories as well
            for segment in subdirs {
                //  skip empty segments
                if segment.isEmpty {
                    continue
                }
                
                dir_to_be_created = dir_to_be_created._appending(path: segment, directoryHint: .isDirectory)

                // skip existing directories
                if isDirectory(at: dir_to_be_created) { continue }
                
                try fm.createDirectory(at: dir_to_be_created, withIntermediateDirectories: true)
                created_dirs.append(dir_to_be_created)
            }
        } catch {
            //  remove created directories if mkdir failed.
            for i in created_dirs.indices.reversed() {
                let created_dir = created_dirs[i]
                try? fm.removeItem(at: created_dir)
            }
            //  notify failure to the caller
            throw error
        }
        
        return dir_to_be_created
    }
    
    /**
     Get `/alier/app_res` directory on the App-specific storage.
     */
    public func getAppResDir() -> URL {
        return try! mkdir(dirname: "app_res")
    }
    
    /**
     Get `/alier/data` directory on the App-specific storage.
     */
    func getAppDataDir() -> URL {
        return try! mkdir(dirname: "app_data")
    }
    
    /**
     Get `/alier/app_res/.temp` directory on the App-specific storage.
     */
    func getAppResTempDir() -> URL {
        return try! mkdir(dirname: "app_res", subdirs:".temp")
    }
    
    /**
     Get `/alier/system` directory on the App-specific storage.
     */
    func getSystemDir() -> URL {
        return try! mkdir(dirname: "alier_sys")
    }
    
    /**
     Get `/alier/system/.temp` directory on the App-specific storage.
     */
    func getSystemTempDir() -> URL {
        return try! mkdir(dirname: "alier_sys", subdirs: ".temp")
    }
    
    /**
     * Gets the `__base.html` file path.
     *
     * - Returns: an `URL` pointing to the `__base.html` file path.
     */
    func getBaseHtmlPath() -> URL {
        return getSystemDir()._appending(path: "__base.html", directoryHint: .notDirectory)
    }
    
    /**
     * Normalize the given path.
     * If the given path starts with "/" it is treated as a relative path to the root.
     * If the given path starts with ".." it is treated as a relative path to the parent of the app_res directory.
     *
     * @param path A string representing a path to be calculated a relative path from
     * the root of the app-specific data directory.
     * @return a [String] representing a path relative to the root of the app-specific data directory.
     * @throws [IllegalArgumentException] when the given [path] is outside of the root directory.
     */
    func normalizePathString(path: String) -> String {
        if path.isEmpty { return "" }
        
        let cwd = "/" + getAppResDir().lastPathComponent
        
        // Split the path at "/" and store it in an array
        var path_components = path.components(separatedBy: "/")
        var i = 0
        // Remove "..", ".", and "" from path_components
        while i < path_components.count {
            switch path_components[i] {
            case "..":
                if i >= 1 {
                    let prev = path_components[i - 1]
                    if prev == "/" || prev == ".." {
                        i += 1
                    } else {
                        path_components.remove(at:i)
                        path_components.remove(at:i - 1)
                        i -= 1
                    }
                } else {
                    i += 1
                }
            case ".":
                path_components.remove(at:i)
            case "":
                if i >= 1 {
                    path_components.remove(at: i)
                } else {
                    i += 1
                }
            default:
                i += 1
            }
        }
        // Create the normalized path
        let path_normalized: String
        // If path_components is empty, assign ""
        if path_components.isEmpty {
            path_normalized = ""
        } else {
            if path_components[0] == ".." {
                if cwd == "/" {
                    try! _PathRegistry.erroThrow(UniqueErrors.IllegalArgumentException("Given path is outside of the root: \(path)"))
                }
                var path_prefix = cwd
                while !path_components.isEmpty && path_components[0] == ".." {
                    if path_prefix.isEmpty {
                        try! _PathRegistry.erroThrow(UniqueErrors.IllegalArgumentException("Given path is outside of the root: \(path)"))
                        path_components.remove(at:0)
                        path_prefix = String(path_prefix[path_prefix.startIndex..<path_prefix.lastIndex(of: "/")!])
                    }
                    path_components.insert(path_prefix, at: 0)
                }
                path_normalized = path_components.joined(separator: "/")
            } else {
                let path_joined = path_components.joined(separator: "/")
                if path_joined.isEmpty {
                    path_normalized = "/"
                } else {
                    path_normalized = path_joined
                }
            }
        }
        return path_normalized
    }
    
    func getFilePath(path: String) -> URL? {
        let path_normalized = normalizePathString(path: path)
        let file_url: URL = if path_normalized.hasPrefix("/") {
            _alier_dir._appending(path: path_normalized, directoryHint: .notDirectory)
        } else {
            getAppResDir()._appending(path: path_normalized, directoryHint: .notDirectory)
        }
        
        let file_path: String = file_url._path(percentEncoded: false)
        if !isFile(atPath: file_path) {
            return nil
        }
        return file_url
    }
    
    /// Gets framework's bundle object.
    ///
    /// - Returns: `Bundle` of framework' resources.
    func getSystemBundle() -> Bundle {
        #if SWIFT_PACKAGE
        return Bundle.module
        #else
        return Bundle(for: _PathRegistry.self)
        #endif
    }
    
    /// Gets filepaths of assets included in the given bundle.
    ///
    /// - Parameters:
    ///   - bundle: the target bundle
    ///   - forResource: the target resource name in the given bundle.
    /// - Returns: an array of filepaths of resources in the target bundle if they exist.
    /// - Throws: when the target resource is not a directory, or inaccesible, or broken
    func getBundleFiles(bundle: Bundle, forResource: String?) throws -> [URL]? {
        guard let resource_root: URL = bundle.url(forResource: forResource, withExtension: nil) else {
            return nil
        }

        let fm = FileManager.default

        let property_keys = Set<URLResourceKey>([.isRegularFileKey])
        guard let resource_enumarator = fm.enumerator(at: resource_root, includingPropertiesForKeys: Array(property_keys)) else {
            return nil
        }
    
        var resources: [URL] = []
        for case let resource as URL in resource_enumarator {
            guard let resource_values = try? resource.resourceValues(forKeys: property_keys),
                  let is_regular_file: Bool = resource_values.isRegularFile
            else {
                continue
            }
            
            if is_regular_file {
                resources.append(resource.resolvingSymlinksInPath())
            }
        }
        
        return resources
    }
    
    
    /// Gets assets bundled with application and framework.
    ///
    ///- Returns: an array of URLs of all assets.
    func getAssets() -> ([URL], [URL]) {
        let system_assets = try! getBundleFiles(bundle: getSystemBundle(), forResource: "system")!
        let app_assets = try! getBundleFiles(bundle: Bundle.main, forResource: "app_res")!
        
        return (system_assets, app_assets)
    }

    enum UniqueErrors: Error {
        case IllegalArgumentException(String)
        case nilValueError
        case otherError(String)
    }
    
    static func erroThrow(_ error: UniqueErrors) throws {
        switch error {
        case .IllegalArgumentException:
            throw error
        case .nilValueError:
            throw error
        case .otherError:
            throw error
        }
    
    }
    
    func kindOf(atPath path: String) -> PathKind {
        var is_dir: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: path, isDirectory: &is_dir)

        return if is_dir.boolValue {
            .isDirectory
        } else if exists {
            .isFile
        } else {
            .notExist
        }
    }

    func kindOf(at fileurl: URL) -> PathKind {
        return kindOf(atPath: fileurl._path(percentEncoded: false))
    }

    func isFile(atPath path: String) -> Bool {
        kindOf(atPath: path) == .isFile
    }

    func isFile(at fileurl: URL) -> Bool {
        kindOf(at: fileurl) == .isFile
    }
    
    func isDirectory(atPath path: String) -> Bool {
        kindOf(atPath: path) == .isDirectory
    }
    
    func isDirectory(at fileurl: URL) -> Bool {
        kindOf(at: fileurl) == .isDirectory
    }

}

enum UniqueErrors: Error {
    case IllegalArgumentException(String)
    case nilValueError
    case IOException(String)
}

func erroThrow(_ error: UniqueErrors) throws {
    switch error {
    case .IllegalArgumentException:
        throw error
    case .nilValueError:
        throw error
    case .IOException:
        throw error
    }
}
