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

import android.content.Context
import java.io.File
import java.io.IOException
import kotlin.IllegalArgumentException

/**
 * This class provides functions accessing files / directories on the App-specific storage.
 *
 * To operate a file or a directory gotten from this registry, use [_FileOperation] class.
 */
class _PathRegistry(
    private val _application_context: Context
) {
    init{
        this.getAppDataDir()
    }

    /**
     * Directory on App-specific storage used for Alier
     *
     * which may be `"/data/user/0/{app-package}/app_alier"`.
     */
    val frameworkRootDir: File
        get() = _application_context.getDir("alier", Context.MODE_PRIVATE)

    /**
     * Makes a sub-directory under the Alier specific directory if it doesn't exist,
     * and then return the requested path as a File object.
     *
     * @param dirname a string representing a directory name relative to the directory on
     * the App-specific storage used for the framework.
     * Note that if an absolute path is given as this argument,
     * then it is converted to the relative path from the root directory of the framework.
     * This
     * @param subdirs a sequence of sub directories to be made if not exist
     *
     * @return File object having the given directory path.
     * @throws IOException when failing to create a directory.
     * @throws IllegalArgumentException when passing a directory path having different root from
     * the directory used for the framework on the App-specific storage.
     */
    fun mkdir(dirname: String, vararg subdirs: String): File {
        val sep = File.separator
        val basedir = frameworkRootDir.path
        val dirname_rel = if (File(dirname).isAbsolute) {
            dirname.removePrefix(if (dirname.startsWith(basedir)) { basedir + sep } else { sep })
        } else {
            dirname
        }
        val target_dir = File(
            """$basedir$sep$dirname_rel$sep${subdirs.joinToString(sep)}"""
        )
        if (target_dir.isDirectory) {
            return target_dir
        }
        val ls_dir = mutableListOf(basedir, dirname_rel, *subdirs)
        val sb_base_dir = StringBuilder()
        while (ls_dir.isNotEmpty()) {
            val dir = ls_dir.removeAt(0)
            if (dir.contains(sep)) {
                ls_dir.addAll(0, dir.split(sep))
                continue
            }
            sb_base_dir.append(dir, sep)
            if (!File(sb_base_dir.toString()).exists()) {
                break
            }
        }
        ls_dir.add("") // add a sentinel used while-loop below
        val ls_dir_created = mutableListOf<File>()
        try {
            val sb_sub_dir = StringBuilder(sb_base_dir)
            while (ls_dir.isNotEmpty()) { // This is done at least once because ls_dir has a sentinel.
                val file = File(sb_sub_dir.toString())
                if (!file.isDirectory && !file.isFile) {
                    if (!file.mkdir()) {
                        throw IOException("Creating specified directory was failed: $file")
                    }
                }
                val next = ls_dir.removeAt(0)
                ls_dir_created.add(file)
                sb_sub_dir.append(next, sep)
            }
        } catch (e: IOException) {
            for (file in ls_dir_created) {
                if (!file.delete()) {
                    throw IOException("Deletion of disused directory was failed: $file", e)
                }
            }
            throw e
        }
        return target_dir
    }

    /**
     * Gets `/app_alier/app_res` directory on the App-specific storage.
     *
     * @return [File] the directory stored application components.
     * @see getAppDataDir
     * @see getAppResTempDir
     * @see getSystemDir
     * @see getSystemTempDir
     */
    fun getAppResDir(): File {
        return mkdir("app_res")
    }

    /**
     * Gets `/app_alier/app_data` directory on the App-specific storage.
     *
     * @return [File] the directory stored data managed by the framework user.
     * @see getAppResDir
     * @see getAppResTempDir
     * @see getSystemDir
     * @see getSystemTempDir
     */
    @Suppress("MemberVisibilityCanBePrivate")
    fun getAppDataDir(): File {
        return mkdir("app_data")
    }

    /**
     * Gets `/app_alier/app_res/.temp` directory on the App-specific storage.
     *
     * Note that files in the temp directory are NOT treated as cache files.
     * So you should take responsibility for free disk space up by deleting those files manually,
     * if you created files in the temp directory.
     *
     * @return [File] the directory stored application components.
     * @see getAppResDir
     * @see getAppDataDir
     * @see getSystemDir
     * @see getSystemTempDir
     */
    @Suppress("MemberVisibilityCanBePrivate")
    fun getAppResTempDir(): File {
        return mkdir("app_res", ".temp")
    }

    /**
     * Gets `/app_alier/system` directory on the App-specific storage.
     *
     * @return [File] the directory stored system components of Alier.
     * @see getAppResDir
     * @see getAppDataDir
     * @see getAppResTempDir
     * @see getSystemTempDir
     */
    fun getSystemDir(): File {
        return mkdir("alier_sys")
    }

    /**
     * Gets `/app_alier/system/.temp` directory on the App-specific storage.
     *
     * Note that files in the temp directory are NOT treated as cache files.
     * So you should take responsibility for free disk space up by deleting those files manually,
     * if you created files in the temp directory.
     *
     * @return [File] the directory stored temporary files related to system components of Alier.
     * @see getAppResDir
     * @see getAppDataDir
     * @see getAppResTempDir
     * @see getSystemDir
     */
    @Suppress("MemberVisibilityCanBePrivate")
    fun getSystemTempDir(): File {
        return mkdir("alier_sys", ".temp")
    }

    /**
     * Gets `__base.html` file path.
     *
     * @return [File]
     * the `__base.html` file path.
     */
    fun getBaseHtmlPath(): File = File(getSystemDir(), "__base.html")

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
    @Suppress("MemberVisibilityCanBePrivate")
    fun normalizePathString(path: String): String {
        if (path.isEmpty()) {
            return ""
        }
        val root = frameworkRootDir.absolutePath
        val cwd = getAppResDir().absolutePath.removePrefix(root)

        //  split the given path into mutable list of segments by the path delimiter.
        val path_segments = path.split(File.separator).toMutableList()
        var i = 0
        //  remove dot-segments and empty segments from the list of segments.
        while (i < path_segments.size) {
            when(path_segments[i]) {
                ".." -> {
                    val prev = if (i >= 1) { path_segments[i - 1] } else { null }
                    if (prev.isNullOrEmpty() || prev == "..") {
                        //  double-dots can be removed if and only if there exists a preceding segment and
                        //  it is neither a dots segment nor an empty segment.
                        i++
                    } else {
                        //  remove a double-dots
                        //  path_segments = foo/BAR/../qux
                        //                          ^^  (i = 2)
                        path_segments.removeAt(i)
                        //                = foo/BAR/qux # double-dot ".." removed
                        //                          ^^^ (i = 2)
                        path_segments.removeAt(i - 1)
                        //                = foo/qux     # preceding segment "BAR" removed
                        //                          ^^^ (i = 2)
                        i--
                        //                = foo/qux     # index moved to the succeeding segment
                        //                      ^^^     (i = 1)
                    }
                }
                "." -> {
                    //  remove a single-dot
                    //  path_segments = foo/bar/./qux
                    //                          ^   (i = 2)
                    path_segments.removeAt(i)
                    //  path_segments = foo/bar/qux # single-dot "." removed
                    //                          ^^^ (i = 2)
                }
                "" -> {
                    if (i >= 1) {
                        //  remove an empty segment
                        //  path_segments = /foo/bar/   /qux
                        //                           ^^^    (i = 2)
                        path_segments.removeAt(i)
                        //  path_segments = /foo/bar/qux
                        //                           ^^^    (i = 2)
                    } else {
                        //  keep the leading empty segment to distinguish absolute paths
                        //  from relative paths.
                        //  path_segments =    /foo/bar/baz
                        //                  ^^^     (i = 0)
                        i++
                        //  path_segments =    /foo/bar/baz
                        //                      ^^^ (i = 1)
                    }
                }
                else -> {
                    i++
                }
            }
        }
        val path_normalized = if (path_segments.isEmpty()) {
            ""
        } else {
            if (path_segments[0] == "..") {
                if (cwd == File.separator) {
                    throw IllegalArgumentException("Given path is outside of the root: $path")
                }
                var path_prefix = cwd
                while (path_segments.isNotEmpty() && path_segments[0] == "..") {
                    if (path_prefix == "") {
                        throw IllegalArgumentException("Given path is outside of the root: $path")
                    }
                    path_segments.removeAt(0)
                    path_prefix = path_prefix.substring(0, path_prefix.lastIndexOf(File.separator))
                }
                path_segments.add(0, path_prefix)
                path_segments.joinToString(File.separator)
            }
            val path_joined = path_segments.joinToString(File.separator)
            if (path_joined == "") { File.separator } else { path_joined }  //  = path_normalized
        }
        return path_normalized
    }

    /**
     * Gets a [File] instance from the given path.
     *
     * @param path A string representing a path.
     * @return a [File] instance representing the given [path].
     * @throws [IllegalArgumentException] when the given [path] is outside of the root directory.
     * @throws [IllegalArgumentException] when a file does not exist on the given [path].
     */
    fun getFilePath(path: String): File? {
        val path_normalized = normalizePathString(path)

        val file = if (path_normalized.startsWith(prefix = File.separator)) {
            File(frameworkRootDir, path_normalized.removePrefix(File.separator))
        } else {
            File(getAppResDir(), path_normalized)
        }

        return if (file.isFile) {
            file
        } else {
            null
        }
    }

    /**
     * Gets path strings of asset files as an array.
     * @return an array of strings representing asset file paths.
     */
    fun getAssetFiles(): Array<String> {
        val assets = _application_context.resources.assets
        val asset_files = assets.list("")?.toMutableList() ?: mutableListOf<String>()
        var i = 0
        while (i < asset_files.size) {
            try {
                // Test whether the given name represents a file or not.
                // if asset_files[i] is not a file, open() will throw IOException.
                assets.open(asset_files[i]).close()
                i++
            } catch (e: IOException) {
                val dir = asset_files.removeAt(i)
                val sub_assets = assets.list(dir) ?: arrayOf()
                for (index in sub_assets.indices) {
                    sub_assets[index] = "$dir${File.separator}${sub_assets[index]}"
                }
                asset_files.addAll(sub_assets)
            }
        }
        return asset_files.toTypedArray()
    }
}