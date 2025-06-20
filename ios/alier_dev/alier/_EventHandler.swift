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
public class EventHandler {
    private var _handle_map: [String:[HandleObject]] = [:]
    private let _script_mediator: ScriptMediator

    public init(scriptMeditator: ScriptMediator) {
        _script_mediator = scriptMeditator
    }

    public func addListener(category: String, javaScriptFunctionHandle: HandleObject) {
        if javaScriptFunctionHandle.type != "function" {
            return
        }
        
        if var handle_list = _handle_map[category] {
            if !handle_list.contains(where: { $0 == javaScriptFunctionHandle }) {
                handle_list.append(javaScriptFunctionHandle)
            }
        } else {
            _handle_map[category] = [javaScriptFunctionHandle]
        }
    }

    public func post(category: String, message: Any?) throws {
        guard let handle_list = _handle_map[category], !handle_list.isEmpty else {
            return
        }
        let args: [Any?] = if (message == nil) { [] } else { [message!] }
        var errors: [Error] = []
        
        let js = _script_mediator
        var i = handle_list.endIndex - 1

        var next: (Any?) -> Void = { _ in }
        next = { (result: Any?) in
            if i < 0 {
                return
            }
            if result as? Bool == true {
                return
            }
            let handle = handle_list[i]
            i -= 1
            do {
                try js.callJavaScriptFunction(
                    dispose: false,
                    handle: handle,
                    args: args,
                    completionHandler: next
                )
            } catch {
                errors.append(error)
            }
        }
        
        next(nil)
        
        if !errors.isEmpty {
            throw errors.first!
        }
    }
}
