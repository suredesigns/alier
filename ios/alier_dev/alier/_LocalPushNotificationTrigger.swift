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
import UIKit
//TODO: Later change to manage fixed values using an enum or similar.
protocol NotificationTrigger {
    func scheduleNotification(_ manageId: String)
}

class TimerTrigger:NSObject,NotificationTrigger {
    private let notification: NotificationBase
    private var delaySeconds: Int64 = 0
    
    init(_ context: NotificationBase,_ delaySeconds: Int64){
        self.notification = context
        self.delaySeconds = delaySeconds
    }
    
    func scheduleNotification(_ manageId: String) {
        //Create the notification request.
        let repeatData = notification.getRepeat()
        let repeatNotification: Bool =  repeatData["timer"]!
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(self.delaySeconds), repeats: repeatNotification)
        let notificationContents = notification.getNotificationContents()
        let request = UNNotificationRequest(identifier: manageId, content: notificationContents, trigger: trigger)

        //Register the notification request.
        UNUserNotificationCenter.current().add(request) { (error : Error?) in
            if let error = error {
                print("notification failed \(error)")
            }
        }
    }
    
    func setDelaySeconds(time: Int64)-> NotificationTrigger{
        self.delaySeconds = time
        return self
    }
    
}



class CalendarTrigger :NSObject, NotificationTrigger {
    private var notification: NotificationBase? = nil
    private var year: Int? = nil
    private var month: Int? = nil
    private var day: Int? = nil
    private var hour: Int? = nil
    private var minute: Int? = nil
    private var second: Int? = nil
    private var weekday: Int? = nil
    private var weekOfMonth: Int? = nil
    private var repeatType: String = ""
    private var adjustEndOfMonth: Bool? = nil
    private var date: DateComponents
    private var repeatData: Bool = false
    private var notificationContents: UNMutableNotificationContent? = nil
    
    init(
       _ context: NotificationBase?,
       _ year: Int? = nil,
       _ month: Int? = nil,
       _ day: Int? = nil,
       _ hour: Int? = nil,
       _ minute: Int? = nil,
       _ second: Int? = nil,
       _ weekday: Int? = nil,
       _ weekOfMonth: Int? = nil,
       _ repeatType: String? = nil,
       _ adjustEndOfMonth: Bool? = nil
    ){
        self.notification = context
        self.date = DateComponents()
    
        if(year != nil){
            self.date.setValue(year!, for: Calendar.Component.year)
        }
        if(month != nil){
            self.month = month
            self.date.month = month!
        }
        if(day != nil){
            self.day = day!
            self.date.day = day!
        }
        if(hour != nil){
            self.hour = hour
            self.date.hour = hour
        }
        if(minute != nil){
            self.minute = minute
            self.date.minute = minute
        }
        if(second != nil){
            self.second = second
            self.date.second = second
        }
        if(weekday != nil && (repeatType == "week" || repeatType == "weekOfMonth")){
            self.weekday = weekday
            self.date.weekday = weekday
        }
        if(weekOfMonth != nil && (repeatType == "week" || repeatType == "weekOfMonth")){
            self.weekOfMonth = weekOfMonth
            self.date.weekOfMonth = weekOfMonth
        }
        if(repeatType != nil){
            self.repeatType = repeatType!
            self.repeatData = true
        }
        if(adjustEndOfMonth != nil){
            self.adjustEndOfMonth = adjustEndOfMonth!
        }
        self.date.nanosecond = 0
    }
    
    struct RepeatType{
        let year = "year"
        let month = "month"
        let day = "day"
        let week = "week"
        let weekOfMonth = "weekOfMonth"
    }
    
    func setNotificationContents(contents: UNMutableNotificationContent){
        self.notificationContents = contents
    }
    
    func setDate(date:DateComponents){
        self.date = date
    }
    
    func scheduleNotification(_ manageId: String) {
        if(self.repeatData){
            let isSet = self.setRepeatDate()
            if(!isSet){return}
        }
        let trigger = UNCalendarNotificationTrigger(dateMatching: self.date, repeats: self.repeatData)
        var notificationContents: UNMutableNotificationContent
        if(self.notificationContents != nil){
            notificationContents = self.notificationContents!
        }else{
            notificationContents = self.notification?.getNotificationContents() ?? UNMutableNotificationContent()
        }
        let request = UNNotificationRequest(identifier: manageId, content: notificationContents, trigger: trigger)
        //Register the notification request.
        UNUserNotificationCenter.current().add(request) { (error : Error?) in
            if let error = error {
                print("notification failed \(error)")
            }
        }
    }
    
    private func setRepeatDate()->Bool{
        //yearly
        if(repeatType == RepeatType().year){
            //Check if the required data is defined.: month, day
            if(month==nil||day==nil){
                return false
            }
            var _day: Int = self.day!
            //End of month adjustment.
            if(adjustEndOfMonth ?? false){
                let calendar = Calendar.current
                let now = Date()
                // Get the date range of the current month.
                if let range = calendar.range(of: .day, in: .month, for: now),
                    let inputDay = self.day{
                    let lastDay = range.count  // Number of days in the current month.
                    // If the input value exceeds the maximum, return the last day of the month.
                    if(inputDay > lastDay ){
                        _day = lastDay
                    }
                }
            }
            //Specify using month, day, hour, minute, and second.
            var repeatDate = DateComponents()
            repeatDate.month = self.month
            repeatDate.day = _day
            repeatDate.hour = self.hour
            repeatDate.minute = self.minute
            repeatDate.second = self.second
            repeatDate.nanosecond = 0
            self.date = repeatDate
            self.repeatData = true
        }else
        //monthly
        if(repeatType == RepeatType().month){
            //Check if the required data is defined.: day
            if(day==nil){
                return false
            }
            var _day: Int = self.day!
            //End of month adjustment.
            if(adjustEndOfMonth ?? false){
                let calendar = Calendar.current
                let now = Date()
                if let range = calendar.range(of: .day, in: .month, for: now),
                    let inputDay = self.day {
                    let lastDay = range.count
                    if(inputDay > lastDay ){
                        _day = lastDay
                    }
                }
            }
            //day,hour,minute,second
            var repeatDate = DateComponents()
            repeatDate.day = _day
            repeatDate.hour = self.hour
            repeatDate.minute = self.minute
            repeatDate.second = self.second
            repeatDate.nanosecond = 0
            self.date = repeatDate
            self.repeatData = true
        }else
        //daily
        if(repeatType == RepeatType().day){
            //hour, minute, second
            var repeatDate = DateComponents()
            repeatDate.hour = self.hour
            repeatDate.minute = self.minute
            repeatDate.second = self.second
            repeatDate.nanosecond = 0
            self.date = repeatDate
            self.repeatData = true
        }else
        //weekly
        if(repeatType == RepeatType().week){
            if(weekday==nil){
                return false
            }
            //weekday, hour, minute, second
            var repeatDate = DateComponents()
            repeatDate.weekday = self.weekday
            repeatDate.hour = self.hour
            repeatDate.minute = self.minute
            repeatDate.second = self.second
            repeatDate.nanosecond = 0
            self.date = repeatDate
            self.repeatData = true
        }else
        //week of month
        if(repeatType == RepeatType().weekOfMonth){
            if(weekday==nil||weekOfMonth==nil){
                return false
            }
            //weekday, weekOfMonth, hour, minute, second
            var repeatDate = DateComponents()
            repeatDate.weekday = self.weekday
            repeatDate.weekOfMonth = self.weekOfMonth
            repeatDate.hour = self.hour
            repeatDate.minute = self.minute
            repeatDate.second = self.second
            repeatDate.nanosecond = 0
            self.date = repeatDate
            self.repeatData = true

        }else
        //use test
        if(repeatType == "minute"){
            var repeatDate = DateComponents()
            repeatDate.setValue(0, for: Calendar.Component.second)
            repeatDate.setValue(0, for: Calendar.Component.nanosecond)
            self.date = repeatDate
            self.repeatData = true
        }else{
            return false
        }
        return true
    }
}
