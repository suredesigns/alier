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

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import java.io.IOException
import java.lang.Exception

abstract class _ResourceManager (
    private val _result_launcher: ActivityResultLauncher<Array<String>>,
    private val _native_interface: _NativeFunctionInterface
) {

    fun openImage(resultData: Intent) {
//        val data_uri: Uri = resultData.data!!
//        _native_interface.evaluateJavascript(
//            """_nativeHandler.callJavaScriptFunction("selectedResource", "${data_uri}")"""
//            ,null
//        )
    }

    fun openAudioPicker() {
//        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT, MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
//        intent.type="*/*"
//        intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("audio/*"))
//        _result_launcher.launch(arrayOf("audio/*"))
    }
    fun openImageAndMovie() {
//        if(Build.VERSION.SDK_INT >= 30){
//            photoPickerLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo))
//        }else{
//            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT, MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
//            intent.addCategory(Intent.CATEGORY_BROWSABLE)//Intent.CATEGORY_DEFAULTでもOK
//            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)//複数選択
//            intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))//写真と動画複数選びたい時
//            intent.action = Intent.ACTION_PICK//これをONにする場合はIntent.createChooserを使用することになる
//            intent.action = Intent.ACTION_GET_CONTENT;
//            _result_launcher.launch(arrayOf("image/*", "video/*"))
//        }
    }
    fun openDocumentPicker() {
//        val intent = Intent(Intent.ACTION_GET_CONTENT)
//        intent.type="*/*"
//        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)//複数選択
//        intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("text/*","application/pdf"))
//        _result_launcher.launch(arrayOf("text/*","application/pdf"))
    }
}

fun makeResourceManager() {
//    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
//
//    } else {
//
//    }
}