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

import android.content.res.AssetManager
import android.util.Log
import java.io.BufferedReader
import java.io.InputStream
import java.lang.Exception

/**
 * A logger class which wraps [android.util.Log] class.
 *
 * This class provides the feature filtering logs by id and/or log-level.
 * Filtering target is specified by the special preference file, `LogFilter.ini`.
 *
 * In `LogFilter.ini`, you can set the following 3 preferences:
 *
 * - `level` : zero or a positive integer representing the minimum log-level to be shown
 * - `start` : zero or a positive integer representing the lower-limit of ids to be shown
 * -  `end`  : zero or a positive integer representing the upper-limit of ids to be shown
 *
 * Each of log-levels is defined in [LogLevel] enum and its underlying value is as follows:
 *
 * -  [LogLevel.DEBUG] : 0
 * -  [LogLevel.INFO]  : 1
 * -  [LogLevel.WARN]  : 2
 * -  [LogLevel.ERROR] : 3
 * -  [LogLevel.FAULT] : 4
 *
 * So, if you set the `level` to `2` in `LogFilter.ini`, then `DEBUG` and `INFO` level logs are not printed out.
 *
 * You can choose the values for both `start` and `end` arbitrarily,
 * but there is an exception.
 * Ids less than 1000 are NOT filtered even if you set `start` to `1000` or higher.
 */
class AlierLog {
    /**
     * Enumerators representing log levels.
     *
     * -  [LogLevel.DEBUG] : which indicates that logs containing information used for debugging purpose.
     * -  [LogLevel.INFO]  : which indicates that logs containing supplemental information.
     * -  [LogLevel.WARN]  : which indicates that logs containing information requiring to pay attention,
     *                       e.g. possible misuse of functions.
     * -  [LogLevel.ERROR] : which indicates that logs containing error information.
     * -  [LogLevel.FAULT] : which indicates that logs containing severe error information.
     *
     */
    enum class LogLevel(val id: Int) {
        /** Log level used for debugging purposes. */
        DEBUG(0),
        /** Log level used for notifying supplemental information. */
        INFO(1),
        /** Log level used for warning. */
        WARN(2),
        /** Log level used for notifying an error occurs. */
        ERROR(3),
        /** Log level used for notifying a fatal error occurs.  */
        FAULT(4);
        companion object {
            /**
             * Gets the enumerator corresponding to the given id.
             *
             * @param id an integer representing the id of the enumerator to be get.
             * @return The enumerator corresponding to `id` if such enumerator exists.
             * Otherwise [LogLevel.DEBUG] is returned instead.
             */
            fun idOf(id: Int): LogLevel {
                for (item in enumValues<LogLevel>()) {
                    if (item.id == id) {
                        return item
                    }
                }
                return DEBUG
            }
        }
    }
    companion object {
        private var minLogLevel = LogLevel.DEBUG
        private var startId: Int = 0
        private var endId: Int = Int.MAX_VALUE

        /**
         * Sets filtering condition.
         *
         * @param level log-level
         * @param start lower limit of ids
         * @param end  upper limit of ids
         */
        @Suppress("MemberVisibilityCanBePrivate")
        fun filter(level: LogLevel, start: Int, end: Int) {
            minLogLevel = level
            startId = if (start <= 0) 0 else start
            endId = if (end <= 0) 0 else if (end <= start) start else end
        }

        /**
         * Loads preferences defined in `app_res/LogFilter.ini`.
         *
         * If `LogFilter.ini` does not exist, this function does nothing.
         *
         * @param assets an [AssetManager] to be used to read the `app_res/LogFilter.ini` file.
         */
        fun loadLogFilter(assets: AssetManager) {
            val fileName = "app_res/LogFilter.ini"
            val asset: InputStream
            try {
                asset = assets.open(fileName)
            } catch (e: Exception) {
                d(id = 3000, message = "File not found : $fileName")
                return
            }

            var start_id  = startId
            var end_id    = endId
            var min_level = minLogLevel

            BufferedReader(asset.reader()).use { br ->
                var line: String?
                while (br.readLine().also { line = it } != null) {
                    val not_space = line?.filterNot { it.isWhitespace() }
                    val param = not_space?.split("=", ".", ",") ?: continue
                    if (param.size < 2) continue
                    val key = param[0]
                    val value = param[1]
                    when (key) {
                        "level" -> min_level = LogLevel.idOf(value.toInt())
                        "start" -> start_id  = value.toInt()
                        "end"   -> end_id    = value.toInt()
                    }
                }
            }

            filter(level = min_level, start = start_id, end = end_id)
        }

        /**
         * Returns current filtering preferences as a comma-separated values (CSV) string.
         *
         * - The first value in the returned CSV represents the id for minimum log level.
         * - The second value in the CSV represents the lower limit of ids.
         * - The third value in the CSV represents the upper limit of ids.
         *
         * To restore the original information, you should split the returned string with commata,
         * and then parse each of the substrings.
         *
         * @return a CSV string representing a tuple of the minimum log level and the lower limit of ids
         * and the upper limit of ids.
         */
        fun getLogFilter(): String {
            return "${minLogLevel.id},$startId,$endId"
        }

        /**
         * Prints a debug log.
         *
         * @param id an integer representing the log id.
         * @param message a string representing the log message.
         *
         * @see
         * - [LogLevel.DEBUG]
         * - [AlierLog.i]
         * - [AlierLog.w]
         * - [AlierLog.e]
         * - [AlierLog.f]
         */
        fun d(id: Int, message: String) {
            log(level = LogLevel.DEBUG, id = id, message = message)
        }

        /**
         * Prints a log for supplemental information.
         *
         * @param id an integer representing the log id.
         * @param message a string representing the log message.
         *
         * @see
         * - [LogLevel.INFO]
         * - [AlierLog.d]
         * - [AlierLog.w]
         * - [AlierLog.e]
         * - [AlierLog.f]
         */
        fun i(id: Int, message: String) {
            log(level = LogLevel.INFO, id = id, message = message)
        }

        /**
         * Prints a log for warning.
         *
         * @param id an integer representing the log id.
         * @param message a string representing the log message.
         *
         * @see
         * - [LogLevel.WARN]
         * - [AlierLog.d]
         * - [AlierLog.i]
         * - [AlierLog.e]
         * - [AlierLog.f]
         */
        fun w(id: Int, message: String) {
            log(level = LogLevel.WARN, id = id, message = message)
        }

        /**
         * Prints an error log.
         *
         * @param id an integer representing the log id.
         * @param message a string representing the log message.
         *
         * @see
         * - [LogLevel.ERROR]
         * - [AlierLog.d]
         * - [AlierLog.i]
         * - [AlierLog.w]
         * - [AlierLog.f]
         */
        fun e(id: Int, message: String) {
            log(level = LogLevel.ERROR, id = id, message = message)
        }

        /**
         * Prints a severe error log.
         *
         * NOTE:
         * [android.util.Log] does not have the exact counter-part of the "fault" level,
         * so this function, [AlierLog.f], also invokes [android.util.Log.e].
         *
         * @param id an integer representing the log id.
         * @param message a string representing the log message.
         * @see
         * - [LogLevel.FAULT]
         * - [AlierLog.d]
         * - [AlierLog.i]
         * - [AlierLog.w]
         * - [AlierLog.e]
         */
        @Suppress("MemberVisibilityCanBePrivate")
        fun f(id: Int, message: String) {
            log(level = LogLevel.FAULT, id = id, message = message)
        }

        private fun log(level: LogLevel, id: Int, message: String) {
            if (level < minLogLevel) return
            else if (id >= 1000 && id !in startId..endId) return
            else if (id < 0) return

            val tag = "alier:Native:${level.name}:${"%04d".format(id)}"

            when (level) {
                LogLevel.DEBUG -> Log.d(tag, message)
                LogLevel.INFO  -> Log.i(tag, message)
                LogLevel.WARN  -> Log.w(tag, message)
                LogLevel.ERROR,
                LogLevel.FAULT -> Log.e(tag, message)
            }
        }
    }
}
