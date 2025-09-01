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

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class EventHandler(scriptMediator: ScriptMediator) {
    private val _scope = CoroutineScope(Dispatchers.Default)
    private val _handle_map: MutableMap<String, MutableList<HandleObject>> =
        mutableMapOf()
    private val _script_mediator = scriptMediator

    /**
     * Adds the given JavaScript function as an event listener.
     *
     * If the given handle is not a function handle or it is
     * already added, then this function does nothing.
     *
     * NOTE:
     * Basically, this function is invoked from JavaScript codes.
     * Handle objects are generated in JavaScript side and passed via
     * the Native Function Interface.
     *
     * @param category
     * a string representing a category of an event.
     *
     * @param javaScriptFunctionHandle
     * a handle object associated with a JavaScript function.
     */
    fun addListener(category: String, javaScriptFunctionHandle: HandleObject) {
        if (javaScriptFunctionHandle.type != "function") { return }

        val handle_list = _handle_map[category]
        if (handle_list == null) {
            _handle_map[category] = mutableListOf(javaScriptFunctionHandle)
        } else if (!handle_list.contains(javaScriptFunctionHandle)) {
            handle_list.add(javaScriptFunctionHandle)
        }
    }

    /**
     * Posts a message notifying occurrence of an event to listeners
     * belonging to the given category.
     *
     * @param category
     * a string representing a category of the event.
     *
     * @param message
     * an object to be passed to each of the listeners.
     */
    fun post(category: String, message: Any?) {
        val handle_list = _handle_map[category] ?: return
        val js = this._script_mediator
        val args = if (message == null) {
            arrayOf()
        } else {
            arrayOf(message)
        }
        _scope.launch {
            for (i in handle_list.indices.reversed()) {
                val result = js.callJavaScriptFunction(
                    dispose = false,
                    handle = handle_list[i],
                    args = args
                )
                if (result == true) {
                    break
                }
            }
        }
    }
}