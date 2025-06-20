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

import android.app.Activity
import android.app.SearchManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.MediaStore
import android.provider.Settings
import com.google.android.gms.actions.NoteIntents
import org.json.JSONObject
import java.lang.Exception
import androidx.core.net.toUri

class _LaunchManager {
    private val _launch_apps = mutableMapOf<String, String>()
    private var _startup_params: Map<String, Any?>? = null
    private var _uri_host: String = ""

    fun getStartupParams(): Map<String, Any?> {
        return _startup_params ?: mapOf()
    }

    fun getUriHost(): String {
        return _uri_host
    }

    fun loadStartupParams(intent: Intent, eventHandler: EventHandler) {
        val params =  mutableMapOf<String, Any?>()

        // Get startup parameters when launched by URL and other apps and push notification
        val data = intent.data
        if (data != null) {
            setData(data, params)
        }

        val extras = intent.extras
        if (extras != null) {
            setShortcuts(extras, params)
            setWidgets(extras, params)
        }

        val startup_params = params.toMap()
        _startup_params = startup_params

        notifyAwoken(eventHandler, startup_params)
    }

    private fun notifyAwoken(event: EventHandler, params: Map<String, Any?>) {
        event.post(
            category = "lifeCycle",
            message = BaseMainActivity.LifecycleKind.onAwake.toMap(params)
        )
    }

    private fun setData(data: Uri, params: MutableMap<String, Any?>) {
        val host = data.host
        if (host != null) {
            _uri_host = host
        }
        for (key in data.queryParameterNames) {
            //  Use the first value if there are duplicated values for the given key.
            params[key] = data.getQueryParameter(key)
        }
    }

    // Launch in shortcut
    private fun setShortcuts(extras: Bundle, params: MutableMap<String, Any?>) {
        val keys = arrayOf(
            "shortcut",
            "shortcut1",
            "shortcut2",
            "shortcut3",
            "shortcut4",
            )

        for (key in keys) {
            val shortcut = extras.getString(key)
            if (shortcut.isNullOrEmpty()) { continue }

            params[key] = shortcut
        }
    }

    // Launch in widget
    private fun setWidgets(extras: Bundle, params: MutableMap<String, Any?>) {
        val keys = arrayOf(
            "widget",
            "widget1",
            "widget2",
            "widget3",
            "widget4",
            "widget5",
        )

        for (key in keys) {
            val widget = extras.getString(key)
            if (widget.isNullOrEmpty()) { continue }

            params[key] = widget
        }
    }

    fun registerLaunchApp(name: String, uri: String) {
        _launch_apps[name] = uri
    }

    fun launchOtherApp(activity: Activity, action: String, params: String) {
        val other_app_intent = Intent()
        // https://developer.android.com/guide/components/intents-common?hl=ja
        when (action) {
            "alarm" -> {
                other_app_intent.setAction(AlarmClock.ACTION_SHOW_ALARMS)
            }
            "timer" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    other_app_intent.setAction(AlarmClock.ACTION_SHOW_TIMERS)
                } else {
                    other_app_intent.setAction("android.intent.action.SHOW_TIMERS")
                }
            }
            "set_alarm" -> {
                other_app_intent.setAction(AlarmClock.ACTION_SET_ALARM).apply {
                    setLaunchParam(other_app_intent, action, params)
                }
            }
            "set_timer" -> {
                other_app_intent.setAction(AlarmClock.ACTION_SET_TIMER).apply {
                    setLaunchParam(other_app_intent, action, params)
                }
            }
            "calendar" -> {
                other_app_intent.setData(CalendarContract.Events.CONTENT_URI)
                other_app_intent.setAction(Intent.ACTION_INSERT).apply {
                    setLaunchParam(other_app_intent, action, params)
                }
            }
            "camera" -> {
                other_app_intent.setAction(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
            }
            "camera_capture" -> {
                other_app_intent.setAction(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    setLaunchParam(other_app_intent, action, params)
                }
            }
            "video" -> {
                other_app_intent.setAction(MediaStore.INTENT_ACTION_VIDEO_CAMERA)
            }
            "video_capture" -> {
                other_app_intent.setAction(MediaStore.ACTION_VIDEO_CAPTURE).apply {
                    setLaunchParam(other_app_intent, action, params)
                }
            }
            "mail" -> {
                other_app_intent.setAction(Intent.ACTION_SEND).apply {
                    other_app_intent.setType("*/*")
                    setLaunchParam(other_app_intent, action, params)
                }
            }
            "map" -> {
                var data = "geo:"
                other_app_intent.setAction(Intent.ACTION_VIEW).apply {
                    data += setLaunchParam(other_app_intent, action, params)
                }
                other_app_intent.setData(data.toUri())
            }
            "memo" -> {
                other_app_intent.setAction(NoteIntents.ACTION_CREATE_NOTE).apply {
                    setLaunchParam(other_app_intent, action, params)
                }
            }
            "tel" -> {
                var data = "tel:"
                other_app_intent.setAction(Intent.ACTION_DIAL).apply {
                    data += setLaunchParam(other_app_intent, action, params)
                }
                other_app_intent.setData(data.toUri())
            }
            "facetime" -> {

            }
            "facetime_audio" -> {

            }
            "search" -> {
                other_app_intent.setAction(Intent.ACTION_WEB_SEARCH).apply {
                    setLaunchParam(other_app_intent, action, params)
                }
            }
            "settings" -> {
                other_app_intent.setAction(Settings.ACTION_WIFI_SETTINGS)
            }
            "sms", "mms" -> {
                var data = "sms:"
                other_app_intent.setAction(Intent.ACTION_SENDTO).apply {
                    other_app_intent.setType("*/*")
                    data += setLaunchParam(other_app_intent, action, params)
                }
                other_app_intent.setData(data.toUri())
            }
            "browser" -> {
                var data = ""
                other_app_intent.setAction(Intent.ACTION_VIEW).apply {
                    data += setLaunchParam(other_app_intent, action, params)
                }
                other_app_intent.setData(data.toUri())
            }
            "appstore" -> {

            }
            "itunes" -> {

            }
            else -> {
                val data = _launch_apps[action]
                if (data != null) {
                    other_app_intent.setAction(Intent.ACTION_VIEW)
                        .setData(data.toUri())
                        .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        other_app_intent
                            .addFlags(Intent.FLAG_ACTIVITY_REQUIRE_DEFAULT)
                            .addFlags(Intent.FLAG_ACTIVITY_REQUIRE_NON_BROWSER)
                    }

                    try {
                        activity.startActivity(other_app_intent)
                    } catch (e: ActivityNotFoundException) {
                        AlierLog.w(0, "$data not installed.")
                    }
                } else {
                    AlierLog.w(0, "No action registered : $action")
                }
                return
            }
        }

        try {
            activity.startActivity(other_app_intent)
        } catch (e: Exception) {
            AlierLog.w(0, "Failed to start $action app.")
        }
    }

    private fun setLaunchParam(intent: Intent, action: String, params: String) : String {
        var data = ""
        if (params.isNotEmpty() && params != "\"\"") {
            val json = JSONObject(params)
            // set_alarm
            if (!json.isNull("message")) {
                intent.putExtra(AlarmClock.EXTRA_MESSAGE, json.getString("message"))
            }
            if (!json.isNull("days")) {
                // Integer in calendar class
                intent.putExtra(AlarmClock.EXTRA_DAYS, json.getInt("days"))
            }
            if (!json.isNull("hour")) {
                intent.putExtra(AlarmClock.EXTRA_HOUR, json.getString("hour"))
            }
            if (!json.isNull("minutes")) {
                intent.putExtra(AlarmClock.EXTRA_MINUTES, json.getString("minutes"))
            }
            if (!json.isNull("ringtone")) {
                intent.putExtra(AlarmClock.EXTRA_RINGTONE, json.getString("ringtone"))
            }
            if (!json.isNull("vibrate")) {
                intent.putExtra(AlarmClock.EXTRA_VIBRATE, json.getBoolean("vibrate"))
            }
            if (!json.isNull("skipUI")) {
                intent.putExtra(AlarmClock.EXTRA_SKIP_UI, json.getBoolean("skipUI"))
            }
            // set_timer
            if (!json.isNull("length")) {
                // seconds
                intent.putExtra(AlarmClock.EXTRA_LENGTH, json.getInt("length"))
            }
            if (!json.isNull("skipUI")) {
                intent.putExtra(AlarmClock.EXTRA_SKIP_UI, json.getBoolean("skipUI"))
            }
            // calendar
            if (!json.isNull("title")) {
                intent.putExtra(CalendarContract.Events.TITLE, json.getString("title"))
            }
            if (!json.isNull("description")) {
                intent.putExtra(CalendarContract.Events.DESCRIPTION, json.getString("description"))
            }
            if (!json.isNull("location")) {
                intent.putExtra(CalendarContract.Events.EVENT_LOCATION, json.getString("location"))
            }
            if (!json.isNull("all_day")) {
                intent.putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, json.getBoolean("all_day"))
            }
            if (!json.isNull("begin_time")) {
                // milliseconds
                intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, json.getInt("begin_time"))
            }
            if (!json.isNull("end_time")) {
                intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, json.getInt("end_time"))
            }
            // camera_capture, video_capture
            if (!json.isNull("output")) {
                intent.putExtra(MediaStore.EXTRA_OUTPUT, json.getString("output"))
            }
            // mail
            if (!json.isNull("to")) {
                intent.putExtra(Intent.EXTRA_EMAIL, json.getString("to"))
            }
            if (!json.isNull("cc")) {
                intent.putExtra(Intent.EXTRA_CC, json.getString("cc"))
            }
            if (!json.isNull("bcc")) {
                intent.putExtra(Intent.EXTRA_BCC, json.getString("bcc"))
            }
            if (!json.isNull("subject")) {
                intent.putExtra(Intent.EXTRA_SUBJECT, json.getString("subject"))
            }
            if (!json.isNull("text")) {
                intent.putExtra(Intent.EXTRA_TEXT, json.getString("text"))
            }
            if (!json.isNull("stream")) {
                intent.putExtra(Intent.EXTRA_STREAM, json.getString("stream"))
            }
            // map
            if (!json.isNull("latitude") && !json.isNull("longitude")) {
                data += json.getString("latitude") + "," + json.getString("longitude")
            }
            if (!json.isNull("zoom")) {
                data += "?z=" + json.getInt("zoom").toString()
            }
            if (!json.isNull("label") && !json.isNull("label_lat") && !json.isNull("label_lng")) {
                val label = json.getString("label")
                val label_lat = json.getString("label_lat")
                val label_lng = json.getString("label_lng")
                data += if (!json.isNull("zoom")) "&" else "?"
                data += "q=${label_lat},${label_lng}(${label})"
            } else if (!json.isNull("house") && !json.isNull("street") && !json.isNull("address")) {
                val house = json.getString("house")
                val street = json.getString("street")
                val address = json.getString("address")
                data += if (!json.isNull("zoom")) "&" else "?"
                data += "q=${house}+${street}+${address}"
            }
            // memo
            if (!json.isNull("title")) {
                intent.putExtra(NoteIntents.EXTRA_NAME, json.getString("title"))
            }
            if (!json.isNull("text")) {
                intent.putExtra(NoteIntents.EXTRA_TEXT, json.getString("text"))
            }
            // tel
            if (!json.isNull("number")) {
                data += json.getString("number")
            }
            // search
            if (!json.isNull("query")) {
                intent.putExtra(SearchManager.QUERY, json.getString("query"))
            }
            // sms/mms
            if (!json.isNull("subject")) {
                intent.putExtra("subject", json.getString("subject"))
            }
            if (!json.isNull("text")) {
                intent.putExtra("sms_body", json.getString("text"))
            }
            if (!json.isNull("stream")) {
                intent.putExtra(Intent.EXTRA_STREAM, json.getString("stream"))
            }
            // browser
            if (!json.isNull("uri")) {
                data += json.getString("uri")
            }
        }
        return data
    }
}