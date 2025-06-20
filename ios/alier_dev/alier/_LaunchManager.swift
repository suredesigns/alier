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
import UIKit

class LaunchManager {
    private var _launch_apps: [String: String] = [:]
    private var _startup_params: [String: Any?]? = nil
    
    public func getStartupParams() -> [String:Any?] {
        return self._startup_params ?? [:]
    }
    
    public func loadStartupParams(data: URL, eventHandler: EventHandler) {
        var params: [String: Any?] = _startup_params ?? [:]
        _startup_params = params

        setData(data: data, params: &params)
        notifyAwoken(eventHandler: eventHandler, params: params)
    }
    
    public func loadStartupParams(shortcuts: UIApplicationShortcutItem?, eventHandler: EventHandler) {
        var params: [String: Any?] = _startup_params ?? [:]
        _startup_params = params

        if let shortcuts_ = shortcuts {
            setShortcuts(shortcuts: shortcuts_, params: &params)
        }

        notifyAwoken(eventHandler: eventHandler, params: params)
    }
    
    private func notifyAwoken(eventHandler: EventHandler, params: [String: Any?]) {
        try! eventHandler.post(
            category: "lifeCycle",
            message: LifecycleKind.onAwake.toDictionary(params)
        )

    }
    
    private func setData(data: URL, params: inout [String:Any?]) {
        guard let query = data._query(percentEncoded: true) else {
            return
        }
        
        let query_params = query.split(separator: "&")
        if query_params.isEmpty  {
            return
        }
        
        for query_param in query_params {
            let param_pair = query_param.split(separator: "=", maxSplits: 1)
            if param_pair.count == 2 {
                params.updateValue(String(param_pair[1]), forKey: String(param_pair[0]))
            }
        }
    }
    
    private func setShortcuts(shortcuts: UIApplicationShortcutItem, params: inout [String: Any?]) {
        guard let user_info = shortcuts.userInfo else {
            return
        }
        
        let keys = [
            "shortcut",
            "shortcut1",
            "shortcut2",
            "shortcut3",
            "shortcut4",
        ]
        
        for key in keys {
            if let value = user_info[key] as? String {
                params[key] = value
            }
        }
    }
    
        
    public func registerLaunchApp(name: String, uri: String) {
        _launch_apps.updateValue(uri, forKey: name)
    }
    
    public func launchOtherApp(action: String, params: String) {
        // https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/Introduction/Introduction.html
        switch action {
        case "alarm" : do {
        }
        case "set_alarm" : do {
        }
        case "timer" : do {
        }
        case "set_timer" : do {
        }
        case "calendar" : do {
            let url = URL(string: "calshow://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "camera" : do {
        }
        case "camera_capture" : do {
        }
        case "video" : do {
            let url = URL(string: "videos://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "video_capture" : do {
        }
        case "mail" : do {
            let url = URL(string: "mailto://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "map" : do {
            let url = URL(string: "maps://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "memo" : do {
            let url = URL(string: "mobilenotes://showNote" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "tel" : do {
            // Does not work because the phone app does not exist on the simulator
            let url = URL(string: "tel://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "facetime" : do {
            // iOS only
            let url = URL(string: "facetime://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "facetime_audio" : do {
            // iOS only
            let url = URL(string: "facetime-audio://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "search" : do {
        }
        case "settings" : do {
            // Deprecated in iOS5.1
            let url = URL(string: "prefs://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "sms" : do {
            let url = URL(string: "sms://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "mms" : do {
            let url = URL(string: "sms://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "browser" : do {
            // https cannot be used
            let url = URL(string: setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "appstore" : do {
            let url = URL(string: "itms-apps://" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        case "itunes" : do {
            let url = URL(string: "http://phobos.apple.com/" + setLaunchParam(action: action, params: params))
            if #available(iOS 10.0, *) {
                UIApplication.shared.open(url!, options: [:])
            } else {
                UIApplication.shared.openURL(url!)
            }
        }
        default : do {
            if _launch_apps.keys.contains(action) {
                let scheme = _launch_apps[action]
                if let url = URL(string: scheme!) {
                    if #available(iOS 10.0, *) {
                        UIApplication.shared.open(url, options: [:])
                    } else {
                        UIApplication.shared.openURL(url)
                    }
                } else {
                    AlierLog.w(id: 0, message: scheme! + " not installed.")
                }
            } else {
                AlierLog.w(id: 0, message: "No action registered : " + action)
            }
        }
        }
    }
    
    private func setLaunchParam(action: String, params: String) -> String {
        var res = ""
        let data: Data =  params.data(using: String.Encoding.utf8)!
        var jsonDict = Dictionary<String, Any>()
        do {
            jsonDict = try JSONSerialization.jsonObject(with: data) as! Dictionary<String, Any>
            // alarm
            // set_alarm
            // timer
            // set_timer
            // calendar
            // camera
            // camera_capture
            // video
            // video_capture
            // mail
            if (jsonDict.keys.contains("to")) {
                res += cnvAny2String(jsonDict["to"])
            }
            if (jsonDict.keys.contains("subject")) {
                if (!res.contains("?")) { res += "?" }
                res += "subject=" + cnvAny2String(jsonDict["subject"]) + "&"
            }
            // map
            if (jsonDict.keys.contains("latitude") && jsonDict.keys.contains("longitude")) {
                res += "ll=" + cnvAny2String(jsonDict["latitude"]) + "," + cnvAny2String(jsonDict["longitude"])
            }
            if (jsonDict.keys.contains("zoom")) {
                if (!res.contains("?")) { res += "?" }
                res += "z=" + cnvAny2String(jsonDict["zoom"]) + "&"
            }
            if (jsonDict.keys.contains("label_lat") && jsonDict.keys.contains("label_lng")) {
                if (!res.contains("?")) { res += "?" }
                res += "sll=" + cnvAny2String(jsonDict["label_lat"]) + "," + cnvAny2String(jsonDict["label_lng"]) + "&"
            }
            if (jsonDict.keys.contains("house") && jsonDict.keys.contains("street") && jsonDict.keys.contains("address")) {
                if (!res.contains("?")) { res += "?" }
                res += "address=" + cnvAny2String(jsonDict["house"]) + "," + cnvAny2String(jsonDict["street"]) + "," + cnvAny2String(jsonDict["address"]) + "&"
            }
            if (jsonDict.keys.contains("type")) {
                if (!res.contains("?")) { res += "?" }
                res += "t=" + cnvAny2String(jsonDict["type"]) + "&"
            }
            // memo
            // tel
            if (jsonDict.keys.contains("number")) {
                res += cnvAny2String(jsonDict["number"])
            }
            // search
            // settings
            // sms/mms
            if (jsonDict.keys.contains("text")) {
                if (!res.contains("?")) { res += "?" }
                res += "body=" + cnvAny2String(jsonDict["text"]) + "&"
            }
            // browser
            if (jsonDict.keys.contains("uri")) {
                res += cnvAny2String(jsonDict["uri"])
            }
            // appstore
            // itunes
            if (jsonDict.keys.contains("store")) {
                res += cnvAny2String(jsonDict["store"])
            }
        } catch {
            AlierLog.e(id: 0, message: error.localizedDescription)
        }
        
        if res.last == "&" {
            res = String(res.dropLast())
        }
        return res
    }
    
    private func cnvAny2String(_ data: Any?) -> String {
        switch (data) {
        case let intValue as Int:
            return String(intValue)
        case let stringValue as String:
            return stringValue
        case let dateValue as Date:
            let f = DateFormatter()
            f.dateFormat = "yyyy/mm/dd"
            return f.string(from: dateValue)
        default:
            return "?"
        }
    }
}
