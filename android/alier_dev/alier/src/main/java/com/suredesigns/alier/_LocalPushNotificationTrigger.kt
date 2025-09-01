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

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.annotation.RequiresApi
import java.util.Calendar
import java.util.Date


//TODO: Later change to manage fixed values using an enum or similar.
interface NotificationTrigger {
    fun scheduleNotification(manageId: String)
}

//BroadcastReceiver: Called from timer or calendar intents.
class NotificationTriggerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        //manageId
        val manageId = intent.getStringExtra("manageId")
        val triggerType = intent.getStringExtra("trigger")
        if(manageId != null){
            //Get NotificationBaseClass instance.
            var notificationBase = NotificationObjectManager.getNotificationObj(manageId)
            //Create an instance if it does not already exist.
            if(notificationBase == null){
                //Get subclass name.
                val className = NotificationObjectManager.getClassName(context,manageId)
                //Get notification information.
                val notificationInfo = NotificationObjectManager.getNotificationInfo(context,manageId)
                //Get notification trigger.
                val notificationTrigger = NotificationObjectManager.getNotificationTrigger(context,manageId)

                //Send Notification use notification instance.
                val subClazz = Class.forName(className).kotlin
                val constructor = subClazz.constructors.firstOrNull() // Get the available constructor.
                notificationBase = constructor?.call() as DefaultNotification // Create instance.
                notificationBase.setContext(context)
                notificationBase.createNotification(notificationInfo,notificationTrigger)

            }else{
                val notificationInfo = NotificationObjectManager.getNotificationInfo(context,manageId)
                val notificationTrigger = NotificationObjectManager.getNotificationTrigger(context,manageId)
                notificationBase.createNotification(notificationInfo,notificationTrigger)
            }
            //1. Prepare notification.
            notificationBase.prepareNotification(context,manageId)
            //2. Send Notification.
            notificationBase.send(context,manageId)
            //If repeat is true, register the notification again.
            val repeatMap = notificationBase.getRepeat()

            if(repeatMap["timer"] as Boolean && triggerType.toString() == "timer"){
                val notificationTrigger = NotificationObjectManager.getNotificationTrigger(context,manageId)
                notificationBase.scheduleNotification(manageId,notificationTrigger)
                //Turn off the notification sending flag.
                NotificationObjectManager.setNotifiedFlag(context,manageId,false)
            }else
            if(repeatMap["calendar"] as Boolean  && triggerType == "calendar"){
                val notificationTrigger = NotificationObjectManager.getNotificationTrigger(context,manageId)
                notificationBase.scheduleNotification(manageId,notificationTrigger)
                //Turn off the notification sending flag.
                NotificationObjectManager.setNotifiedFlag(context,manageId,false)
            }else{
                //Turn on the notification sending flag.
                NotificationObjectManager.setNotifiedFlag(context,manageId,true)
            }
        }
    }
}

class TimerTrigger(
    private val context: Context,
    private val delaySeconds: Long
) : NotificationTrigger {

    fun cancelTimer(manageId: String){
        val intent = this.createIntent(manageId)
        val pendingIntent = this.createPendingIntent(manageId,intent)
        val alarmManager = createAlarmManager()

        pendingIntent.cancel()//Clear the PendingIntent for safety.
        alarmManager?.cancel(pendingIntent)
    }

    private fun createAlarmManager(): AlarmManager?{
        return context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
    }

    private fun createIntent(manageId: String): Intent{
        return Intent(context, NotificationTriggerReceiver::class.java).apply {
            // Put Value to BroadCastReceiver
            putExtra("manageId", manageId) // Provide the ID for each notification.
            putExtra("trigger","timer")
        }
    }

    private fun createPendingIntent(manageId: String,intent: Intent):PendingIntent{
        //Extract the number (notification ID part) from notification.getNotificationKey().
        val (channelId, notificationId) = manageId.split("__alier__")
        val requestCode = notificationId.toInt()
        return PendingIntent.getBroadcast(
            context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    @RequiresApi(Build.VERSION_CODES.M)
    override fun scheduleNotification(manageId: String) {
        // Trigger the notification after the specified time.
        //Use setExactAndAllowWhileIdle() in AlarmManager.
        val alarmManager = this.createAlarmManager()
        //Prepare an intent to call notification.send() when the time comes.
        val intent = this.createIntent(manageId)
        val pendingIntent = this.createPendingIntent(manageId,intent)
        //Invoke the intent after the specified number of seconds (ms).
        alarmManager!!.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            System.currentTimeMillis() + (delaySeconds*1000),
            pendingIntent
        )
    }
}

class CalendarTrigger(
    private val context: Context,
    private val year: Int? = null,
    private val month: Int? = null,
    private val day: Int? = null,
    private val hour: Int? = null,
    private val minute: Int? = null,
    private val second: Int? = null,
    private val weekday: Int? = null,
    private val weekOfMonth: Int? = null,
    private val repeatType: String = "",
    private val adjustEndOfMonth: Boolean? = null,

) : NotificationTrigger {
    private var calendar: Calendar
    init {
        calendar = Calendar.getInstance()
        calendar.time = Date()// Get current time.
        if(year!=null){
            calendar.apply {
                set(Calendar.YEAR,year.toInt())
            }
        }
        if(month!=null){
            calendar.apply {
                set(Calendar.MONTH,month.toInt()-1)
            }
        }
        if(day!=null){
            calendar.apply {
                set(Calendar.DATE,day.toInt())
            }
        }
        if(hour!=null){
            calendar.apply {
                set(Calendar.HOUR_OF_DAY,hour.toInt())
            }
        }
        if(minute!=null){
            calendar.apply {
                set(Calendar.MINUTE,minute.toInt())
            }
        }
        if(second!=null){
            calendar.apply {
                set(Calendar.SECOND,second.toInt())
            }
        }else{
            calendar.apply {
                set(Calendar.SECOND,0)
            }
        }
        if(weekday!=null && repeatType == "week"){
            calendar.apply {
                set(Calendar.DAY_OF_WEEK,weekday.toInt())
            }
        }
        if(weekOfMonth!=null && repeatType == "week"){
            calendar.apply {
                set(Calendar.WEEK_OF_MONTH,weekOfMonth.toInt())
            }
        }
        calendar.set(Calendar.MILLISECOND, 0)
    }

    class RepeatType{
        val year = "year"
        val month = "month"
        val day = "day"
        val week = "week"
        val weekOfMonth = "weekOfMonth"
    }

    //Same function TimerTrigger.
    fun cancelCalendar(manageId: String){
        val intent = this.createIntent(manageId)
        val pendingIntent = this.createPendingIntent(manageId,intent)
        //Create AlarmManager.
        val alarmManager = createAlarmManager()

        pendingIntent.cancel()//Release the PendingIntent for now
        alarmManager?.cancel(pendingIntent)//Clear the PendingIntent for safety.
    }

    //Same function TimerTrigger.
    private fun createAlarmManager(): AlarmManager?{
        return context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
    }

    private fun createIntent(manageId: String): Intent{
        return Intent(context, NotificationTriggerReceiver::class.java).apply {
            // Put Value to BroadCastReceiver
            putExtra("manageId", manageId) // Provide the ID for each notification.
            putExtra("trigger","calendar")
        }
    }

    private fun createPendingIntent(manageId: String,intent: Intent):PendingIntent{
        //Extract the number (notification ID part) from notification.getNotificationKey().
        val (channelId, notificationId) = manageId.split("__alier__")
        val requestCode = notificationId.toInt()
        return PendingIntent.getBroadcast(
            context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    @RequiresApi(Build.VERSION_CODES.M)
    override fun scheduleNotification(manageId: String) {
        val alarmManager = this.createAlarmManager()
        //Prepare an intent to call notification.send() when the time comes.
        val intent = this.createIntent(manageId)
        val pendingIntent = this.createPendingIntent(manageId,intent)
        setRepeatDate(repeatType)
        //Invoke the intent after the specified number of seconds (ms).
        alarmManager!!.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            calendar.timeInMillis,
            pendingIntent
        )
    }

    private fun setRepeatDate(repeatType: String){
        val now = Calendar.getInstance()
        //Check repeat type.
        //yearly
        if(repeatType == RepeatType().year && calendar.before(now)){
            //Check if the required data is defined.: month, day
            if(month==null||day==null){
                return
            }
            calendar = (now.clone() as Calendar).apply {
                add(Calendar.YEAR,1)
                set(Calendar.MILLISECOND, 0)
            }
            //End of month adjustment.
            if(adjustEndOfMonth == true){
                calendar = (now.clone() as Calendar).apply {
                    add(Calendar.MONTH, 1) // move next month.
                    set(Calendar.DAY_OF_MONTH, 1) // set first day at next month.
                    add(Calendar.DATE, -1) // Subtract one day from that to get the end of the month.
                    set(Calendar.MILLISECOND, 0)
                }
            }
        }else
        //monthly
        if(repeatType == RepeatType().month && calendar.before(now)){
            //Check if the required data is defined.: day
            if(day==null){
                return
            }
            calendar = (now.clone() as Calendar).apply {
                add(Calendar.MONTH,1)
                set(Calendar.MILLISECOND, 0)
            }
            //End of month adjustment.
            if(adjustEndOfMonth==true){
                calendar = (now.clone() as Calendar).apply {
                    add(Calendar.MONTH, 1)
                    set(Calendar.DAY_OF_MONTH, 1)
                    add(Calendar.DATE, -1)
                    set(Calendar.MILLISECOND, 0)
                }
            }
        }else
        //daily
        if(repeatType == RepeatType().day && calendar.before(now)){
            calendar = (now.clone() as Calendar).apply {
                add(Calendar.DATE,1)
                set(Calendar.MILLISECOND, 0)
            }
        }else
        //weekly
        if(repeatType == RepeatType().week && calendar.before(now)){
            if(weekday==null){return}
            calendar =(now.clone() as Calendar).apply {
                add(Calendar.WEEK_OF_YEAR, 1)
                set(Calendar.MILLISECOND, 0)
            }
        }else
        //week of month
        if(repeatType == RepeatType().weekOfMonth && calendar.before(now)){
            if(weekday==null||weekOfMonth==null){return}
            calendar =  (now.clone() as Calendar).apply {
                add(Calendar.MONTH, 1)
                set(Calendar.DAY_OF_MONTH, 1)
                set(Calendar.DAY_OF_WEEK, weekday.toInt())
                set(Calendar.DAY_OF_WEEK_IN_MONTH, weekOfMonth.toInt())
                set(Calendar.MILLISECOND, 0)
            }
        }else
        //use test
        if(repeatType == "minute" && calendar.before(now)){
            //Set the current date and time, then add one minute.
            // The BroadcastReceiver re-registers the alarm every year,
            // so there should be no difference from the pre-configured value.
            calendar = (now.clone() as Calendar).apply {
                if (second != null) {
                    set(Calendar.SECOND, second)
                }
                set(Calendar.MILLISECOND, 0)
                add(Calendar.MINUTE, 1)
            }
        }
    }

    private fun printCalendarInfo(calendar: Calendar) {
        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH) + 1
        val day = calendar.get(Calendar.DAY_OF_MONTH)
        val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK)
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        val minute = calendar.get(Calendar.MINUTE)
        val second = calendar.get(Calendar.SECOND)
        val millis = calendar.get(Calendar.MILLISECOND)
        val weekOfMonth = calendar.get(Calendar.WEEK_OF_MONTH)

        val dayOfWeekStr = when (dayOfWeek) {
            Calendar.SUNDAY    -> "Sun"
            Calendar.MONDAY    -> "Mon"
            Calendar.TUESDAY   -> "Tue"
            Calendar.WEDNESDAY -> "Wen"
            Calendar.THURSDAY  -> "Thu"
            Calendar.FRIDAY    -> "Fri"
            Calendar.SATURDAY  -> "Sat"
            else -> "none"
        }

        AlierLog.d(3700,"Calendar Info")
        AlierLog.d(3700,"Year: $year")
        AlierLog.d(3700,"Month: $month")
        AlierLog.d(3700,"day: $day")
        AlierLog.d(3700,"week: $dayOfWeekStr ($dayOfWeek)")
        AlierLog.d(3700,"Time: %02d:%02d:%02d.%03d".format(hour, minute, second, millis))
        AlierLog.d(3700,"weekOfMonth: $weekOfMonth")
    }

}