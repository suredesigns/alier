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
import AVFoundation
import os

/**
 * A module used for accessing and manipulating local files.
 */
public class _FileOperation: NSObject {
    
    private let _path_registry = _PathRegistry()
    
    public init(update_needed: Bool = false) {
        super.init()
        _copyAssetsIntoAppSpecificDir(allow_overwrite: update_needed)
        _createBaseHTML()
    }
    
    /**
     Rename a file specified by the given key to the new file name.
     - Parameters:
        - key[String] a key which specifies a file to be renamed
        - dst:dst[URL] a `URL` instance representing the destination path. The transfer format is "file:///directory/filename.extension"
     
     - Returns:[URL]`dst`

     */
    func renameTo(src: URL, dst: URL) throws -> URL {
        let app_res = _path_registry.getAppResDir()
        let system_dir = _path_registry.getSystemDir()
        let app_resPath: String
        let system_dirPath: String
        let srcPath: String
        let dstPath: String
        app_resPath = app_res._path(percentEncoded: false)
        system_dirPath = system_dir._path(percentEncoded: false)
        srcPath = src._path(percentEncoded: false)
        dstPath = dst._path(percentEncoded: false)
        
        if (srcPath.hasPrefix(app_resPath) && !dstPath.hasPrefix(app_resPath)) {
            try! _PathRegistry.erroThrow(_PathRegistry.UniqueErrors.IllegalArgumentException("Moving a file to the outside of the app_res directory is not allowed."))
            
        }
        if (srcPath.hasPrefix(system_dirPath) && !dstPath.hasPrefix(system_dirPath)) {
            try! _PathRegistry.erroThrow(_PathRegistry.UniqueErrors.IllegalArgumentException("Moving a file to the outside of the system directory is not allowed."))
        }
        // rename
        let fileManager = FileManager.default
        do {
            try fileManager.moveItem(atPath: srcPath, toPath: dstPath)
        } catch {
            throw UniqueErrors.IOException("Rename failed: \(src) -> \(dst)")
        }
        return dst
    }
    
    func renameTo(src: String, dst: String) -> URL {
        return try! renameTo(
            src: _path_registry.getFilePath(path: src)!,
            dst: _path_registry.getFilePath(path: dst)!
        )
    }
    
    /**
     * Read a text from the target file specified by the given filepath.
     *
     * - Parameters:
     * - src: a filepath corresponding to the file to be read.
     - Returns: [String] a text read from the target file.
     *
     */
    func loadText(src: String) -> String? {
        guard let path = _path_registry.getFilePath(path: src)?._path(percentEncoded: false) else {
            return nil
        }
        
        do {
            //  read a file from the given path
            return String(try NSString(contentsOfFile: path, encoding: String.Encoding.utf8.rawValue))
        } catch {
            AlierLog.e(id: 0, message: "loadText(): \(error.localizedDescription)")
            return nil
        }
    }
    
    /**
     Write a text to the target file specified by the given key.
     - Parameters:
      - key[String] a key corresponding to the destination file
      - text[String] a text to be written to the destination file
      - allow_overwrite[Boolean] a flag whether allowing to overwrite or not
     - throws:
      - [IllegalArgumentException] when there is no files corresponding to the given key.This won't be thrown in normal cases because a file will be created if the given key is not registered.
      - throws [IOException] when a file already exists but overwriting not allowed.
     */
    func saveText(dst: String, text: String, allow_overwrite: Bool = false) throws {
        let dst_file_url: URL = if dst.hasPrefix("/") {
            //  absolute path is treated as a path under the framework root directory
            _path_registry.frameworkRootDir._appending(path:dst, directoryHint: .notDirectory)
        } else {
            //  relative path is treated as a path relative to the application resources directory
            _path_registry.getAppResDir()._appending(path: dst, directoryHint: .notDirectory)
        }
        let dst_file_path = dst_file_url._path(percentEncoded: false)
        
        // write to dst
        let already_exists = _path_registry.isFile(atPath: dst_file_path)
        if already_exists && !allow_overwrite {
            try! erroThrow(UniqueErrors.IOException("Overwriting an existing file not allowed"))
        } else if already_exists {
            try FileManager.default.removeItem(atPath: dst_file_path)
        }

        // Create file
        if !FileManager.default.createFile(atPath: dst_file_path, contents: text.data(using: .utf8), attributes: nil) {
            AlierLog.e(id: 0, message: "saveText(): File not created: \(dst_file_path)")
        }
    }
    
    
    /// Copy asset files from app and framework's bundle directories into the app specific directory.
    /// This function is called once during the initialization process.
    ///
    /// - Parameter allow_overwrite: a boolean indicating whether or not to allow to overwrite existing files in the destination paths
    private func _copyAssetsIntoAppSpecificDir(allow_overwrite: Bool) {
        _copyBundle(bundle: _path_registry.getSystemBundle(), forResource: "mobile", allowOverwrite: allow_overwrite)
        _copyBundle(bundle: Bundle.main, forResource: "test_app", allowOverwrite: allow_overwrite)
    }
    
    private func _copyBundle(bundle: Bundle, forResource: String, allowOverwrite allow_overwrite: Bool) {
        let fm = FileManager.default
        let dst_prefix = _path_registry._alier_dir

        let urls = try! _path_registry.getBundleFiles(bundle: bundle, forResource: forResource)!
        //  A URL returned from a Bundle might be a symbolic link and hence
        //  resolve symlinks here.
        let src_prefix_url = bundle.url(forResource: forResource, withExtension: nil)!.resolvingSymlinksInPath()
        //  It is guaranteed by getBundleFiles() that an asset_url is not a symlink and so
        //  there is no need for calling resolvingSymlinksInPath() with asset_url.
        for asset_url in urls {
            var common_components =  Array(asset_url.pathComponents.dropFirst(src_prefix_url.pathComponents.count))
            //If a file exists directly under the 'app_res' directory, handle it.
            if (!common_components.contains("alier_sys") && !common_components.starts(with: ["app_res"])) {
                common_components.insert("app_res", at: 0)
            }
            
            let common_suffix = common_components.joined(separator: "/")
            let parent_dir = common_components.dropLast().joined(separator: "/")

            let is_system_component = common_suffix.hasPrefix("alier_sys")

            let src_path: String = asset_url._path(percentEncoded: false)
            let dst_path: String = dst_prefix._appending(path: common_suffix)._path(percentEncoded: false)
            
            // make parent directories of the destination path if they don't exist
            let dst_dir: String = dst_prefix._appending(path: parent_dir)._path(percentEncoded: false)
            if !_path_registry.isDirectory(atPath: dst_dir) {
                //  mkdir uses path relative to `_path_registry._alier_dir`
                try! _path_registry.mkdir(dirname: parent_dir)
            }

            //  test whether or not the source file is a system component for Android
            //  if it is android specific, skip subsequent procedures.
            if is_system_component && common_suffix.contains("_Android") {
                continue
            }
            
            //  Test whether or not a file already exists at the destination path
            let dst_exists = _path_registry.isFile(atPath: dst_path)
            if allow_overwrite && dst_exists {
                //  if allow_overwrite flag is on and there is an existing file,
                //  delete the existing file for FileManager.copyItem works properly
                try! fm.removeItem(atPath: dst_path)
                AlierLog.i(id: 0, message: "File already exist. Overwrite it: \(dst_path)")
            } else if dst_exists {
                //  if overwriting is not allowed, do nothing for the current file.
                AlierLog.i(id: 0, message: "File already exist. skipped: \(dst_path)")
                continue
            }

            if _path_registry.isFile(atPath: src_path) {
                try! fm.copyItem(atPath: src_path, toPath: dst_path)
            }
        }
    }
    
    private func removeFirstPrefixIfMultiple(_ path: String) -> String {
        // Split "app_res/" at "/"
        let components = path.split(separator: "/")
        
        // Check if the beginning contains multiple "app_res"
        let aaaCount = components.prefix(while: { $0 == "app_res" }).count
        if aaaCount > 1 {
            // Remove one "aaa/" and recombine
            return components.dropFirst().joined(separator: "/")
        }
        
        // If the condition is not met, return it as is.
        return path
    }
    
    private func _scriptTag(src: String, type: String = "text/javascript") -> String {
        return "<script type=\"$type\">\n\(loadText(src: src)!)\n</script>"
    }
    
    private func _systemScriptTag(src: String, type: String = "text/javascript") -> String {
        let src_path = _path_registry.getSystemDir()._appending(path: src).absoluteURL._path(percentEncoded: true)
        return  """
                <script type="\(type)" src="\(src_path)"></script>
                """
    }

    private func _createBaseHTML() {
        var default_locale = "en"
        if #available(iOS 16, *) {
            if let lang_code = Locale.current.language.languageCode {
                default_locale = lang_code.identifier
            }
        } else {
            if let lang_code = Locale.current.languageCode {
                default_locale = lang_code
            }
        }
        
        var base_url = _path_registry.getAppResDir().absoluteURL._path(percentEncoded: true)
        if !base_url.hasSuffix("/") {
            base_url += "/"
        }
        let contents = """
            <!DOCTYPE html>
            <html lang="\(default_locale)">
            <head>
                <base href="\(base_url)" />
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, maximum-scale=1.0,user-scalable=yes" />
                \(self._systemScriptTag(src: "_dependency_iOS.js"))
                \(self._systemScriptTag(src: "_MessagePorter.js"))
                \(self._systemScriptTag(src: "_AlierCore.js"))
            </head>
            <body></body>
            </html>
            """.data(using: .utf8)
        // Generate path
        let base_html_path: String = _path_registry.getBaseHtmlPath()._path(percentEncoded: false)

        //Create the _base.html file
        FileManager.default.createFile(atPath: base_html_path, contents: contents, attributes: nil) 
    }
}




