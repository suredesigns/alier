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
import UserNotifications
import UserNotificationsUI
import UIKit

//TODO: Later change to manage fixed values using an enum or similar.
protocol NotificationBase: UNNotificationContentExtension{
    //Get data for notification from the JS side.
    func createNotification(payload: Dictionary<String,Any>, trigger: Dictionary<String,Any>)
    //Be ready to notification on specified occasion.
    func scheduleNotification(manageId: String, trigger:Dictionary<String,Any>)-> Dictionary<String,String>
    func prepareNotification(manageId: String)//iOSVersion
    //Issue notification in each subclass.
    func send()
    func deleteNotification(manageId: String)
    func getManageId()->String
    //Get userInfo data property.Necessary at NotificationTrigger.
    func getData()->Dictionary<String, Any>
    //Necessary at NotificationTrigger.
    func getScheme()->String?
    //Necessary at NotificationTrigger.
    func getRepeat()-> Dictionary<String, Bool>
    func onReceive(data: Dictionary<String, Any> )//TODO: May not be needed.
    func tappedBanner(data: Dictionary<String, Any> )
    
    //TODO: Grant notification permission: currently for iOS only. May also be added to Android in the future as a new feature.
    //func requestAuthorization()
    
    //iOS only
    func getNotificationContents()->UNMutableNotificationContent
    
    //iOS only
    func createUserInfo(manageId: String, data:Dictionary<String,Any>)-> Dictionary<String,Any>
    
    //TODO: This function was omitted in 4/28/2025.
    //func updateNotification(manageId: String,payload: Dictionary<String,Any>, trigger: Dictionary<String,Any>)
}

//For notification send.  SingleTon Class.
final class _Notification: NSObject, UNUserNotificationCenterDelegate {
    
    static let _notification = _Notification()
    private var notificationNames: Dictionary<String,String> = [:]
    private override init() {}

    func configure() {
        UNUserNotificationCenter.current().delegate = self
    }
    
    fileprivate func setNotificationName(key:String,className: String){
        self.notificationNames.updateValue(className, forKey: key)
        UserDefaults.standard.setValue(className, forKey: key)
    }
    
    fileprivate func getNotificationName(key:String)-> String?{
        if(self.notificationNames[key] != nil){
            return self.notificationNames[key]
        }else{
            return UserDefaults.standard.string(forKey: key)
        }
    }
    
    //Handler for notification taps
    //  This method is called when a push notification is received while the app is in the foreground.
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(0)
        } else {
            // Fallback on earlier versions
            UIApplication.shared.applicationIconBadgeNumber = 0
        }
        //Get notification information.
        let _userInfo = notification.request.content.userInfo as NSDictionary
        var userInfo = _userInfo as? Dictionary<String, Any> ?? [:]
        let key = userInfo["manageId"] as! String
        if(userInfo.keys.contains("data")){
            let _data = MapAndJSONFormatter.jsonToMutableMap(jsonString: userInfo["data"] as! String)
            let data = _data["data"]
            userInfo["data"] = data
        }
       
        //Create subclass instance.
        let className: String? = self.getNotificationName(key: key)
        if(className != nil){
            let obj = NSClassFromString(className!) as! NSObject.Type
            let notifi = obj.init() as! NotificationBase
            notifi.onReceive(data: userInfo)
        }
        //TODO: Banner display settings. We also want to make this configurable in the future.
        completionHandler([.banner, .list, .sound])
    }
    
    // Method called when a push notification (banner) is tapped.
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(0)
        } else {
            // Fallback on earlier versions
            UIApplication.shared.applicationIconBadgeNumber = 0
        }
        //Get notification information.
        let _userInfo = response.notification.request.content.userInfo as NSDictionary
        var userInfo = _userInfo as? Dictionary<String, Any> ?? [:]
        let key = userInfo["manageId"] as! String
        if(userInfo.keys.contains("data")){
            let _data = MapAndJSONFormatter.jsonToMutableMap(jsonString: userInfo["data"] as! String)
            let data = _data["data"] as! Dictionary<String,Any>
            //Remove the trigger information as it is unnecessary.
            if(userInfo.keys.contains("trigger")){
                userInfo.removeValue(forKey: "trigger")
                userInfo["data"] = data["data"]
            }
            userInfo["data"] = data
        }else{
            if(userInfo.keys.contains("trigger")){
                userInfo.removeValue(forKey: "trigger")
            }
        }
        
        //Create subclass instance.
        let className: String? = self.getNotificationName(key: key)
        if(className != nil){
            let obj = NSClassFromString(className!) as! NSObject.Type
            let notifi = obj.init() as! NotificationBase
            //Send user information.
            notifi.tappedBanner(data: userInfo)
        }
        //Release the persistently stored notification class information.
        if(UserDefaults.standard.object(forKey: key) != nil ){
            UserDefaults.standard.removeObject(forKey: key)
        }
        if (UserDefaults.standard.data(forKey: "\(key)_time") != nil){
            UserDefaults.standard.removeObject(forKey: "\(key)_time")
        }
        completionHandler()
    }
    
}
@objc(DefaultNotification)// Required for instance creation.
open class DefaultNotification :NSObject, NotificationBase{
    public func didReceive(_ notification: UNNotification) {}
    
    private struct notificationRegistrationTime: Codable {
        let manageId: String
        let targetTime: Date  // target notification time.
    }
    
    private var title: String = ""
    private var message: String = ""
    private var channelId: String = ""
    private var data: Dictionary<String, Any> = [:]
    private var badge: Int = 0
    private var sound: UNNotificationSound? = UNNotificationSound.default
    private var image: String? = nil
    private var scheme: String = ""
    //"Repeat" is a reserved keyword, and thus cannot be used.
    private var repeatNotification: Dictionary<String,Bool> = ["timer":false, "calendar":false]
    //Necessary when updating or removing a notification. Automatically generated.
    private var notificationId: String = ""//uuid iOSではString
    private var manageId: String = ""//TODO: This is unnecessary?
    private var trigger: Dictionary<String,Any>!
    //iOS only
    private let notificationContent =  UNMutableNotificationContent()
    
    public override init(){
        super.init()
        _Notification._notification.configure()
    }

    //Property set relationship: use apply so that it can be implemented in the method chain.
    open func setTitle(title: String)-> Self{
        self.title = title//must
        return self
    }
    open func setMessage(message: String)-> Self{
        self.message = message//must
        return self
    }
    open func setChannelId(id:String)-> Self{
        self.channelId = id//must
        return self
    }
    open func setData(data: Dictionary<String, Any>)-> Self{
        self.data = data
        return self
    }
    open func setBadge(badge: Int)-> Self{
        self.badge = badge
        return self
    }
    open func setSound(soundUri: String?)-> Self{
        if(soundUri==nil){return self}
        if(soundUri != "defalut"){
            self.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: UNNotificationSoundName(rawValue: soundUri!).rawValue))
        }
        return self
    }
    open func setImagePath(path: String)->Self{
        self.image = path
        return self
    }
    open func setScheme(scheme: String)-> Self{
        self.scheme = scheme
        return self
    }
    open func setRepeat(_ key: String,_ value: Bool)-> Self{
        self.repeatNotification[key]=value//Use trigger.
        return self
    }
    
    open func sendNotificationEventToJS(params: Any){
        let message: Dictionary<String,Any> = ["id":"notified","param":params]
        do{
            try BaseMainActivity.instance.eventHandler?.post(category: "notified", message: message)
        } catch _{}
    }
    
    open func setBadgeNumber(badgeNumber: Int){
        UIApplication.shared.applicationIconBadgeNumber = badgeNumber
    }
    
    //TODO:unnecessary
    func setContext(context: NotificationBase)-> Self{
        return self
    }
    
    func setManageId(manageId: String){
        self.manageId = manageId
    }
    
    open func createNotification(payload: Dictionary<String,Any>, trigger: Dictionary<String,Any>) {
        self.trigger = trigger
        self.setTitle(title: payload["title"] as? String ?? "")
            .setMessage(message: payload["message"] as? String ?? "")
            .setChannelId(id: payload["manageId"] as? String ?? "")
        if(payload.keys.contains("data")) {
            let data = ["data":payload["data"]]
            let _ = self.setData(data: data as Dictionary<String, Any>)
        }
        if(payload.keys.contains("badge")) {
            self.setBadge(badge: payload["badge"] as? Int ?? 0)
        }
        if(payload.keys.contains("sound")){
            self.setSound(soundUri: payload["sound"] as? String)
        }
        if(payload.keys.contains("image")){
            self.setImagePath(path: payload["image"] as? String ?? "")
        }
        if(payload.keys.contains("scheme")) {
            self.setScheme(scheme: payload["scheme"] as? String ?? "")
        }
        
        //Check repeat property
        if(trigger.keys.contains("timer")){
            let timerInfo = self.trigger["timer"] as! Dictionary<String,Any>
            self.setRepeat("timer",timerInfo["repeat"] as? Bool ?? false)
        }
        if(trigger.keys.contains("calendar")){
            let calendarInfo = trigger["calendar"] as! Dictionary<String,Any>
            if(calendarInfo.keys.contains("repeatType")){
                self.setRepeat("calendar",true)
                let data = self.getData()
                self.setData(data: data)
            }
        }
    }
        
    open func scheduleNotification(manageId: String = "", trigger:Dictionary<String,Any> = [:]) -> Dictionary<String,String> {
        var idMap: Dictionary<String,String>=[:]
        if(!trigger.isEmpty){
            self.trigger = trigger
        }
        
        //Trigger detection.
        if(self.trigger.keys.contains("timer")){
            var timerManageId = ""
            if(manageId != ""){
                timerManageId = manageId
            }else{
                //Create notificationId.
                self.notificationId = NSUUID().uuidString
                timerManageId = self.channelId + "__alier__" + self.notificationId
            }
            //When no value is specified.
            if((self.trigger["timer"]) == nil){//TODO: Unlike Android, iOS determines it by checking for nil.
                return idMap
            }
            self.prepareNotification(manageId: timerManageId)
            
            //Invoking a timer notification.
            let timerInfo = self.trigger["timer"] as! Dictionary<String,Any>
            let numberTime = timerInfo["seconds"] as! NSNumber
            let time = Int64(exactly: numberTime)!
            let timerTrigger = TimerTrigger(self,time)
            timerTrigger.scheduleNotification(timerManageId)
            idMap["timer"] = timerManageId
            
            //TODO: 2024/04/28 update notification is omit.
            //Save scheduled notification time. for update notification function.
            //let registerdTime = DefaultNotification.notificationRegistrationTime(manageId:timerManageId,targetTime: Date().addingTimeInterval(TimeInterval(time)))
            //UserDefaults.standard.set(try? JSONEncoder().encode(registerdTime), forKey: "\(timerManageId)_time")
            
        }else
        if(self.trigger.keys.contains("calendar")){
            //Create notificationId.
            var calendarManageId = ""
            if(manageId != ""){
                calendarManageId = manageId
            }else{
                self.notificationId = NSUUID().uuidString
                calendarManageId = self.channelId + "__alier__" + self.notificationId
            }
            self.prepareNotification(manageId: calendarManageId)
            
            struct ItemName {
                let year = "year"
                let month = "month"
                let day = "day"
                let hour = "hour"
                let minute = "minute"
                let second = "second"
                let weekday = "weekday"
                let weekOfMonth = "weekOfMonth"
                let repeatType = "repeatType"
                let adjustEndOfMonth = "adjustEndOfMonth"
            }
            //When no value is specified.
            if((self.trigger["calendar"]) == nil){
                return idMap
            }
            let calendarInfo = self.trigger["calendar"] as! Dictionary<String,Any>
            //When mandatory fields are left empty.
            if(!calendarInfo.keys.contains(ItemName().hour) || !calendarInfo.keys.contains(ItemName().minute)){
                return [:]
            }
            idMap["calendar"] = manageId
            var year: Int? = nil
            var month: Int? = nil
            var day: Int? = nil
            var hour: Int? = nil
            var minute: Int? = nil
            var second: Int? = nil
            var weekday: Int? = nil
            var weekOfMonth: Int? = nil
            var repeatType: String? = nil
            var adjustEndOfMonth: Bool? = nil
            
            //Check include some calendar trigger keys.
            if(calendarInfo.keys.contains(ItemName().year)){
                year = calendarInfo[ItemName().year] as? Int
            }
            if(calendarInfo.keys.contains(ItemName().month)){
                month = calendarInfo[ItemName().month] as? Int
            }
            if(calendarInfo.keys.contains(ItemName().day)){
                day = calendarInfo[ItemName().day] as? Int
            }
            
            hour = calendarInfo[ItemName().hour] as? Int
            minute = calendarInfo[ItemName().minute] as? Int
            
            if(calendarInfo.keys.contains(ItemName().second)){
                second = calendarInfo[ItemName().second] as? Int
            }
            if(calendarInfo.keys.contains(ItemName().weekday)){
                weekday = calendarInfo[ItemName().weekday] as? Int
            }
            if(calendarInfo.keys.contains(ItemName().weekOfMonth)){
                weekOfMonth = calendarInfo[ItemName().weekOfMonth] as? Int
            }
            if(calendarInfo.keys.contains(ItemName().repeatType)){
                repeatType = calendarInfo[ItemName().repeatType] as? String
            }
            if(calendarInfo.keys.contains(ItemName().adjustEndOfMonth)){
                adjustEndOfMonth = calendarInfo[ItemName().adjustEndOfMonth] as? Bool
            }
            let calendarTrigger = CalendarTrigger(
                self,
                year, month, day, hour, minute, second, weekday, weekOfMonth, repeatType, adjustEndOfMonth
            )
            calendarTrigger.scheduleNotification(calendarManageId)
            idMap["calendar"] = calendarManageId
        }
        return idMap
    }
    
    func prepareNotification(manageId: String){
        //Prepare notification content.
        self.notificationContent.title = self.title
        self.notificationContent.body = self.message
        self.notificationContent.sound = self.sound
        self.notificationContent.badge = (self.badge) as NSNumber
        self.notificationContent.userInfo = self.createUserInfo(manageId: manageId, data: getData())
        if(self.image != nil){
            do{
                if #available(iOS 16.0, *) {
                    //Separate the filename and extension from the imagePath.
                    let fileURL = URL(fileURLWithPath: self.image!)
                    let name = fileURL.deletingPathExtension()
                    let ext = fileURL.pathExtension
                    let imagePath = Bundle.main.path(forResource: name.path(), ofType: ext) ?? ""
                    let attachment = try UNNotificationAttachment.init(identifier: manageId, url: URL(filePath: imagePath))
                    self.notificationContent.attachments = [attachment]
                }
            }catch _{}
        }
        //Save the name of the notification subclass.
        _Notification._notification.setNotificationName(key: manageId, className: String(describing: type(of: self)))
        
    }
    
    //Send Notification to System. Called by TriggerClass side.
    func send() {}
    
    func deleteNotification(manageId: String) {
        let notificationCenter = UNUserNotificationCenter.current()
        notificationCenter.removePendingNotificationRequests(withIdentifiers: [manageId])
        self.initializeNotificationInfo()
    }
    
    func initializeNotificationInfo(){
        self.setTitle(title: "")
            .setMessage(message: "")
            .setChannelId(id: "")
            .setData(data: [:])
            .setBadge(badge: 0)
            .setScheme(scheme: "")
            .manageId = ""
        sound = UNNotificationSound.default
        image = nil
        notificationId = ""
    }
    
    func getManageId() -> String {
        return self.manageId
    }
    func getData() -> Dictionary<String, Any> {
        return self.data
    }
    
    func getScheme() -> String? {
        return self.scheme
    }
    
    func getRepeat() -> Dictionary<String, Bool> {
        self.repeatNotification
    }
    
    //iOS only
    func getNotificationContents()->UNMutableNotificationContent{return self.notificationContent}
    
    //To be overridden and used by the user.
    open func onReceive(data: Dictionary<String, Any>  ) {}
    //To be overridden and used by the user.
    open func tappedBanner(data: Dictionary<String, Any>) {}
    
    func createUserInfo(manageId: String, data: Dictionary<String, Any>) -> Dictionary<String, Any> {
        var userInfo: Dictionary<String, Any> = [:]
        userInfo["manageId"] = manageId
        if(!data.isEmpty){
            userInfo["data"] = MapAndJSONFormatter.mutableMapToJSON(map: data)
        }
        userInfo["scheme"] = getScheme()
        return userInfo
    }
}

class MapAndJSONFormatter{
    //Translate JSON Stringify to Dictionary<String,Any>.
    static func jsonToMutableMap(jsonString: String)-> Dictionary<String,Any>{
        //Translate to Data.
        if let jsonData = jsonString.data(using: .utf8) {
            do {
                //Translate to Dictionary.
                if let jsonDictionary = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any] {
                    return jsonDictionary
                }
            } catch {
                return [:]
            }
        }
        return [:]
    }
    
    //Translate Dicionary<String,Any> to JSON Stringify.
    static func mutableMapToJSON(map: Dictionary<String,Any>)-> String{
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: map, options: [.withoutEscapingSlashes])
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                return jsonString
            }
        } catch {
            return ""
        }
        return ""
    }
    
}

@objc(SimpleDefaultNotification) //Required to handle app launches from notifications when the app is not running.
// The class provided by Alier.
class SimpleDefaultNotification: DefaultNotification{
    override func tappedBanner(data: Dictionary<String, Any> ) {
        if(data["manageId"] != nil){
            self.sendNotificationEventToJS(params: data)
        }
    }
}

// Notification manager class for simple notifications.
open class SimpleNotificationManager{
    private var notificationMap: Dictionary<String, NotificationBase> = [:]//
    private let simpleNotification: SimpleDefaultNotification
    init(){
        simpleNotification = SimpleDefaultNotification()
    }

    public func createNotification(payload: Dictionary<String,Any>, trigger: Dictionary<String,Any>)-> Dictionary<String,String>{
        simpleNotification.createNotification(payload: payload,trigger: trigger)
        let notificationIdMap = simpleNotification.scheduleNotification()
        for id in notificationIdMap {
            notificationMap[id.value] = simpleNotification
        }
        return  notificationIdMap
    }

    public func deleteNotification(notificationId: String){
        if(self.notificationMap.keys.contains(notificationId)) {
            let notificationInstance = self.notificationMap[notificationId]
            notificationInstance?.deleteNotification(manageId: notificationId)
            //Delete instance.
            notificationMap.removeValue(forKey: notificationId)
        }else{
            //Release trigger.
            simpleNotification.deleteNotification(manageId:notificationId)
        }
    }
    
    public func setBadgeNumber(number: NSNumber){
        simpleNotification.setBadgeNumber(badgeNumber: Int(truncating: number))
    }
}
