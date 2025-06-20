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
import java.io.*
import java.util.Locale

/**
 * Android-specific processing
 * */
class _FileOperation (
    private val _application_context: Context,
    update_needed: Boolean = false
) {
    private val _path_registry = _PathRegistry(_application_context)

    init {
        _copyAssetsIntoAppSpecificDir(update_needed)
        _createBaseHTML()
    }

    /**
     * Rename a file specified by the given key to the new file name.
     *
     * @param src a [File] directing a file to be renamed
     * @param dst a [File] directing the destination path
     * @return `dst`
     */
    @Suppress("MemberVisibilityCanBePrivate")
    fun renameTo(src: File, dst: File): File {
        val app_res = _path_registry.getAppResDir()
        val system_dir = _path_registry.getSystemDir()
        if (src.startsWith(app_res) && !dst.startsWith(app_res)) {
            throw IllegalArgumentException(
                "Moving a file to the outside of the app_res directory is not allowed."
            )
        }
        if (src.startsWith(system_dir) && !dst.startsWith(system_dir)) {
            throw IllegalArgumentException(
                "Moving a file to the outside of the system directory is not allowed."
            )
        }
        if (!src.renameTo(dst)) {
            throw IOException("Rename failed: $src -> $dst")
        }
        return dst
    }

    @Suppress("unused")
    fun renameTo(src: String, dst: String): File {
        return renameTo(
            _path_registry.getFilePath(src)!!,
            _path_registry.getFilePath(dst)!!
        )
    }

    /**
     * Reads a text from a file on the given path.
     *
     * @param src a string representing a path to the file to be read.
     * @return a text read from the target file if it exists, `null` otherwise.
     */
    fun loadText(src: String): String? {
        try {
            val file = _path_registry.getFilePath(src) ?: return null
            return file.readText()
        } catch (e: IllegalArgumentException) {
            AlierLog.w(0, e.stackTraceToString())
            return null
        }
    }

    /**
     * Writes a text to a file on the target path.
     *
     * @param dst a string representing a path to the destination file
     * @param text[String] a text to be written to the destination file
     * @param allow_overwrite a flag which represents whether or not allowing to overwrite.
     * Overwriting is allowed if `allow_overwrite` is `true`, not allowed otherwise.
     * @throws [IllegalArgumentException] when the given path is an absolute path
     * and its prefix does not match the root of data storage used for app.
     * @throws [IllegalArgumentException] when the given path is starting with "..".
     * @throws [IOException] when a file already exists but overwriting not allowed.
     */
    fun saveText(dst: String, text: String, allow_overwrite: Boolean = true) {
        //path generation
        val dst_file = if (dst.startsWith(File.separator)) {
            File(_path_registry.frameworkRootDir, dst)
        }else{
            File(_path_registry.getAppResDir(), dst)
        }
        // write to dst
        val already_exists = dst_file.isFile
        if (already_exists && !allow_overwrite) {
            throw IOException("Overwriting an existing file not allowed")
        } else if(already_exists){
            dst_file.writeText(text)
        } else if(dst_file.createNewFile()){    //If the file does not exist and the new file was created successfully
            dst_file.writeText(text)
        } else {
            throw IOException("Write failed")
        }
    }

    private fun _copyAssetsIntoAppSpecificDir(allow_overwrite: Boolean) {
        val assets = _application_context.resources.assets // used to open an asset in for-loop.
        for (asset in _path_registry.getAssetFiles()) {
            // Determine if the asset is a file or folder
            if (asset.startsWith("alier_sys")
                && asset.contains("_iOS", ignoreCase = true)
            ) {
                continue
            }
            val target = if (asset.startsWith("alier_sys")) {
                val sysFile = asset.removePrefix("alier_sys/")
                File(_path_registry.getSystemDir(),sysFile)
            } else {
                val appFile = asset.removePrefix("app_res/")
                File(_path_registry.getAppResDir(), appFile)
            }
            if (target.parent != null) {
                _path_registry.mkdir(target.parent!!)
            }
            val already_exists = target.isFile
            if (already_exists) {
                if (allow_overwrite) {
                    AlierLog.i(0, "File already exist. Overwrite it: ${target.path} ")
                } else {
                    AlierLog.i(0, "File already exist. Skip to copy: ${target.path} ")
                    continue
                }
            }
            var asset_ist: InputStream? = null
            try {
                asset_ist = assets.open(asset)
            } catch (e: IOException) {
                // each asset name is provided from AssetManager, so we can do nothing here.
                AlierLog.w(
                    0,
                    "Failed to open a file \"$asset\". Error details: ${
                        e.message ?: ""
                    }"
                )
            }
            if (asset_ist != null) {
                try {
                    BufferedInputStream(asset_ist).use { ist ->
                        BufferedOutputStream(target.outputStream()).use { ost ->
                            ist.copyTo(ost)
                        }
                    }
                } catch (e: FileNotFoundException) {
                    AlierLog.w(
                        0,
                        "Failed to copy a file \"$asset\" to $target. Error details: ${
                            e.message ?: ""
                        }"
                    )
                }
            }
        }
    }

    private fun _systemScriptTag(src: String, type: String = "text/javascript"): String {
        val src_path = _path_registry.getSystemDir().resolve(src).path
        return """<script type="$type" src="$src_path"></script>"""
    }

    private fun _createBaseHTML() {
        AlierLog.d(0, "_createBaseHTML()")
        val default_locale = Locale.getDefault()
        //  File class may or may not remove the trailing separator at construction time,
        //  and this behaviour depends on filesystem. Hence, to keep the trailing separator,
        //  remove the trailing separator if exists and then append a separator.
        val base_dir   = _path_registry.getAppResDir().path.removeSuffix(File.separator) + File.separator
        val base_html  = _path_registry.getBaseHtmlPath()
        base_html.writeText("""
            |<!DOCTYPE html>
            |<html lang="${default_locale.language}">
            |<head>
            |    <base href="$base_dir" />
            |    <meta charset="UTF-8" />
            |    <meta name="viewport" content="width=device-width, maximum-scale=1.0,user-scalable=yes" />
            |    ${_systemScriptTag("_dependency_Android.js")}
            |    ${_systemScriptTag("_MessagePorter.js")}
            |    ${_systemScriptTag("_AlierCore.js")}
            |</head>
            |<body></body>
            |</html>
            |""".trimMargin(marginPrefix = "|"))
    }

}
