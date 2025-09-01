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

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.icu.number.SimpleNotation
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.annotation.RequiresApi
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.util.UUID
import androidx.datastore.preferences.preferencesDataStore
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.suredesigns.alier.BaseMainActivity.Companion.eventHandler
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.io.IOException

//TODO: Later change to manage fixed values using an enum or similar.
//Class NotificationBase : BroadcastReceiver is called by IntermediateActivity.
open class NotificationBase(): BroadcastReceiver() {
    open var context: Context? = null

    enum class TriggerType {
        timer,
        calendar,
        silent // TODO: later Implement.
    }

    //Get data for notification from the JS side.
    internal open fun createNotification(payload: MutableMap<String,Any>, trigger: MutableMap<String,Any>){}
    //Be ready to notification on specified occasion.
    open fun scheduleNotification(manageId: String = "",trigger:MutableMap<String,Any> = mutableMapOf()): MutableMap<String,String>{ return  mutableMapOf()
    }
    open fun prepareNotification(context: Context,manageId:String){}//AndroidVersion
    //Issue notification in each subclass.
    open fun send(context: Context,manageId: String){}
    open fun deleteNotification(context: Context? = null,manageId: String){}
    //Get userInfo data property.  Necessary at BroadcastReceiver.
    protected open fun getData():MutableMap<String, String>{ return mutableMapOf() }
    //Necessary at BroadcastReceiver.
    protected open fun getScheme():String?{ return null }
    //Necessary at BroadcastReceiver.
    open fun getRepeat():MutableMap<String, Boolean> { return mutableMapOf() }
    //Send NotificationBanner tapped Event to JS side.
    open fun sendNotificationEventToJS(context: Context?,params: Any){
        val message = mapOf("id" to "notified", "param" to params)
        eventHandler.post("notified",message)
    }
    //TODO: This function was omitted in 4/28/2025.
    //open fun updateNotification(manageId: String,payload: MutableMap<String,Any>, trigger: MutableMap<String,Any>){}

    //Android Only.
    //Get Self: Necessary at BroadcastReceiver.
    protected open fun getNotificationInstance(): NotificationBase{ return this }
    //Implemented by user as needed.
    override fun onReceive(context: Context?, intent: Intent?) {
        //Get Notification Info from Intent.
        val data=this.extractNotificationInfo(intent)
        if(data.containsKey("data")){
            val _data = MapAndJSONFormatter.jsonToMutableMap(data["data"].toString())
            data["data"] = _data
        }
        this.tappedBanner(data)
    }
    //Implemented by user as needed.
    open fun tappedBanner(data: MutableMap<String, Any>){}

    //Get Notification Info from Intent at onReceive Method.
    open fun extractNotificationInfo(intent: Intent?):MutableMap<String, Any>{return mutableMapOf()
    }
    fun createIntent(): Intent{
        return Intent(context,this.createLaunch())
    }
    //Get SubClass Necessary at use Intent.
    fun createLaunch(): Class<out BroadcastReceiver> {
        return this::class.java
    }
}


//Manage at Notification: SingleTon Class (Android Only ). Save permanently notification data.
// Save at DataStore.
class NotificationObjectManager {
    companion object {
        enum class SaveDataType {
            className,
            notificationInfo,
            notificationTrigger,
            notifiedFlag,
            mangeId
        }

        //A map for storing instances of the notification class.
        // Notifications are sent by calling the send method on temporarily stored notification objects.
        private var notificationObjMap: MutableMap<String, NotificationBase> = mutableMapOf()
        fun setNotificationObj(manageId: String,notificationObj: NotificationBase ){
            this.notificationObjMap.set(manageId,notificationObj)
        }
        fun getNotificationObj(manageId: String): NotificationBase? {
            return this.notificationObjMap.get(manageId)
        }
        fun deleteNotificationInstance(manageId: String){
            if(this.notificationObjMap.containsKey(manageId)){
                this.notificationObjMap.remove(manageId)
            }
        }

        //Manage subclasses.
        //Overwritten if key is existing.
        fun setClassName(context: Context,manageId: String,className: String){
            val classNames = getData(context,manageId,SaveDataType.className)
            classNames[manageId] = className
            //Save to DataStore.
            setData(context,manageId,SaveDataType.className,classNames)
        }
        fun getClassName(context: Context,manageId: String): String{
            val className = getData(context,manageId,SaveDataType.className)
            return className[manageId].toString()
        }
        fun deleteClassName(context: Context,manageId: String){
            val className = getData(context,manageId,SaveDataType.className)
            if(className.containsKey(manageId)){
                className.remove(manageId)
            }
            setData(context,manageId,SaveDataType.className,className)
        }

        //Manage NotificationInformation.
        //Overwritten if key is existing.
        fun setNotificationInfo(context: Context,manageId: String, data: String){
            val notificationInfo = getData(context,manageId,SaveDataType.notificationInfo)
            notificationInfo[manageId] = data
            setData(context,manageId,SaveDataType.notificationInfo,notificationInfo)
        }
        fun getNotificationInfo(context: Context,manageId: String):MutableMap<String,Any>{
            val data = getData(context,manageId,SaveDataType.notificationInfo)
            val info = MapAndJSONFormatter.jsonToMutableMap(data[manageId] as String)
            return info
        }
        fun deleteNotificationInfo(context: Context,manageId: String){
            val notificationInfo = getData(context,manageId,SaveDataType.notificationInfo)
            if(notificationInfo.containsKey(manageId)){
                notificationInfo.remove(manageId)
            }
            setData(context,manageId,SaveDataType.notificationInfo,notificationInfo)
        }

        //Manage Notified Flag.
        //Overwritten if key is existing.
        fun setNotifiedFlag(context: Context,manageId: String,flag: Boolean){
            //Get the value from the dataStore
            val flags = getData(context,manageId,SaveDataType.notifiedFlag)
            flags[manageId] = flag
            //Save to dataStore
            setData(context,SaveDataType.notifiedFlag.toString(),SaveDataType.notifiedFlag,flags)
        }
        //Get All Notified Flags.
        fun getNotifiedFlags(context: Context):MutableMap<String,Boolean>{
            val flags = getData(context,SaveDataType.notifiedFlag.toString(),SaveDataType.notifiedFlag)
            return flags as MutableMap<String, Boolean>
        }
        fun deleteNotifiedFlag(context: Context,manageId: String){
            val flags = getData(context,SaveDataType.notifiedFlag.toString(),SaveDataType.notifiedFlag)
            if(flags.containsKey(manageId)){
                flags.remove(manageId)
            }
            setData(context,SaveDataType.notifiedFlag.toString(),SaveDataType.notifiedFlag,flags)
        }

        //Manage Notification Trigger.
        //Overwritten if key is existing.
        fun setNotificationTrigger(context: Context,manageId: String,trigger: MutableMap<String, Any>){
            val data = getData(context,manageId,SaveDataType.notifiedFlag)
            data[manageId] = trigger
            setData(context,manageId,SaveDataType.notificationTrigger,trigger)
        }
        fun getNotificationTrigger(context: Context,manageId: String):MutableMap<String,Any>{
            val trigger = getData(context,manageId,SaveDataType.notificationTrigger)
            return trigger
        }
        fun deleteNotificationTrigger(context: Context,manageId: String){
            val trigger = getData(context,manageId,SaveDataType.notificationTrigger)
            if(trigger.containsKey(manageId)){
                trigger.remove(manageId)
            }
            setData(context,manageId,SaveDataType.notificationTrigger,trigger)
        }

        //TODO: save manageId and trigger type.


        //Get Data from DataStore.
        private fun getData(context: Context,manageId: String,dataType: SaveDataType):MutableMap<String,Any>{
            return runBlocking  {
                val data = NotificationDataStore.getValue(context, manageId,dataType.toString())
                if(data!=null){
                    return@runBlocking stringToMap(data)
                } else {
                    return@runBlocking mutableMapOf()
                }
            }
        }
        //Save Data to DataStore.
        private fun setData(context: Context,manageId: String,dataType: SaveDataType,data: MutableMap<String,Any>){
            runBlocking {
                NotificationDataStore.saveValue(context,manageId,dataType.toString(), mapToString(data))
            }
        }
        private fun mapToString(map: MutableMap<String, Any>): String {
            val jsonString = MapAndJSONFormatter.mutableMapToJSON(map).toString()
            return jsonString
        }
        private fun stringToMap(str: String): MutableMap<String, Any> {
            val jsonObject = JSONObject(str)
            val convertedMap = MapAndJSONFormatter.jsonObjectToMap(jsonObject)
            return convertedMap
        }
    }
}

//A data store for managing manageId and the corresponding class information.
object NotificationDataStore {
    private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "notification_registry")

    suspend fun saveValue(context: Context,manageId: String,saveDataType: String ,value: String) {
        context.dataStore.edit { data ->
            data[stringPreferencesKey(saveDataType+manageId)] = value
        }
    }
    suspend fun getValue(context: Context,manageId: String, saveDataType: String): String? {
        val value = context.dataStore.data.firstOrNull()?.get(stringPreferencesKey(saveDataType+manageId))
        return value
    }
}

//Since directly starting a BroadcastReceiver from a notification tap is not recommended,
// this is a temporary Activity used to work around that restriction.

//Attention: Can not directly launch from BroadcastReceiver of onCreate from BaseMainActivity.
//-> Cause bt error: Directly launch from BroadcastReceiver when ForeGround.
class IntermediateActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Create an intermediate Intent to communicate the notification tap to the BroadcastReceiver.
        val className = this.intent.getStringExtra("class_name")//launch target class name.
        //Set NotificationData to intermediate Intent.
        val notificationData = this.intent.getStringExtra("manage_id") ?: return

        //An Intent to launch the main Activity.
        if (isTaskRoot) {
            //If the app is completely closed,
            // launch BaseMainActivity. From BaseMainActivity, call the BroadcastReceiver.
            val mainIntent = Intent(this, BaseMainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            mainIntent.putExtra("class_name",this.intent.getStringExtra("class_name"))
            mainIntent.putExtra("manage_id",notificationData)
            mainIntent.putExtra("notification","received")
            //Launch BaseMainActivity.
            startActivity(mainIntent)
        } else {
            //When the app is running: Call the BroadcastReceiver.
            var classInfo = NotificationBase::class.java
            if(className != null){
                classInfo = Class.forName(className) as Class<NotificationBase>
            }
            val notificationIntent = Intent(this, classInfo).apply {
                action = "com.example.NOTIFICATION_CLICKED"
            }
            notificationIntent.putExtra("manage_id",notificationData)
            //Launch BaseMainActivity.
            sendBroadcast(notificationIntent)
        }
        //Finish intermediate Intent.
        finish()
    }

}

//DefaultNotification
open class DefaultNotification : NotificationBase() {
    override var context: Context? = null // Android Only.
    private var title: String = ""
    private var message: String = ""
    private var channelId: String = ""
    private var data: MutableMap<String, String> = mutableMapOf()
    private var badge: Int = 0
    private var sound: String? = "default"
    private var image: String? = null
    private var scheme: String? = null
    private var icon: String? = null// Android Only.
    private var repeatNotification: MutableMap<String,Boolean> = mutableMapOf("timer" to false, "calendar" to false)
    //Necessary when updating or removing a notification. Automatically generated.
    private var notificationId: Int? = null//uuid
    private var subClassName: String//Android Only.
    private var notificationInfo: String = ""//Android Only.
    private var channelImportance = NotificationManager.IMPORTANCE_DEFAULT//Android Only.
    private var notificationPriority = NotificationCompat.PRIORITY_DEFAULT//Android Only.
    //Properties for creating notifications.
    private lateinit var manager:NotificationManagerCompat//Android Only.
    private lateinit var notificationBuilder: NotificationCompat.Builder//Android Only.

    private lateinit var trigger: MutableMap<String,Any>

    init {
        this.subClassName = this::class.qualifiedName.toString()
    }

    //Property set relationship: use apply so that it can be implemented in the method chain.
    fun setTitle(title: String) = apply { this.title = title }//must
    fun setMessage(message: String) = apply { this.message = message }//must
    fun setChannelId(id:String) = apply {this.channelId = id}//must
    fun setData(data: MutableMap<String, String>) = apply { this.data = data }
    fun setBadge(badge: Int) = apply { this.badge = badge }
    fun setSound(soundUri: String?) = apply { this.sound = soundUri }
    fun setImage(image: String) = apply { this.image = image }
    fun setScheme(scheme: String) = apply { this.scheme = scheme }
    fun setRepeat(key: String,value: Boolean) = apply {
        this.repeatNotification[key] = value
    }
    //Use by trigger
    fun setChannelImportance(channelImportance: Int) = apply { this.channelImportance = channelImportance }//Android only
    fun setIcon(icon: String?) = apply { this.icon = icon }//Android only
    fun setContext(context: Context) = apply { this.context = context }

    //Receive and set the data to be used in the notification from JS.
    public override fun createNotification(payload: MutableMap<String,Any>, trigger: MutableMap<String,Any>){
        this.trigger = trigger
        this.setTitle(payload["title"] as String)
        this.setMessage(payload["message"] as String)
        //caution: Use In Android, the manageId from the JS side is used as the channelId.
        this.setChannelId(payload["manageId"] as String)
        if(payload.containsKey("data")) {
            this.setData(payload["data"] as MutableMap<String, String>)
        }
        if(payload.containsKey("badge")) {
            val _duble = payload["badge"] as Number
            this.setBadge(_duble.toInt())
        }
        if(payload.containsKey("sound")){
            this.setSound(payload["sound"] as String)
        }
        if(payload.containsKey("image")){
            this.setImage(payload["image"] as String)
        }
        if(payload.containsKey("scheme")) {
            this.setScheme(payload["scheme"] as String)
        }
        if(payload.containsKey("icon")){
            this.setIcon(payload["icon"] as String)
        }
        //Check repeat property
        if(trigger.containsKey("timer")){
            val timerInfo = this.trigger["timer"] as MutableMap<String,Any>
            this.setRepeat("timer",timerInfo["repeat"] as Boolean)
        }
        if(trigger.containsKey("calendar")){
            val calendarInfo = trigger["calendar"] as MutableMap<String,Any>
            if(calendarInfo.containsKey("repeatType")){
                this.setRepeat("calendar",true)
            }
        }

        //The route for reconfiguration after instance release. But not the best method
        if(trigger.containsKey("type")){
            if(trigger["type"] == "timer"){
                val info = trigger["timer"] as MutableMap<String,Any>
                this.setRepeat("timer",info["repeat"] as Boolean)
            }
            if(trigger["type"] == "calendar"){
                val info = trigger["calendar"] as MutableMap<String,Any>
                this.setRepeat("calendar",info.containsKey("repeatType"))
            }
        }
        this.notificationInfo = MapAndJSONFormatter.mutableMapToJSON(payload).toString()
    }

    @RequiresApi(Build.VERSION_CODES.M)
    override fun scheduleNotification(manageId: String, trigger:MutableMap<String,Any>): MutableMap<String,String>{
        this.context ?: throw IllegalStateException("Context is not set.")
        val idMap: MutableMap<String,String> = mutableMapOf()
        if(!trigger.isEmpty()){
            this.trigger = trigger
        }
        //Trigger detection.
        if(this.trigger.containsKey("timer")){
            var timerManageId = ""
            if(manageId != ""){
                timerManageId = manageId
            }else{
                //Create notificationId.
                this.notificationId =  UUID.randomUUID().hashCode()
                //Create ManageId.
                timerManageId = this.channelId + "__alier__" + this.notificationId
            }
            //When no value is specified.
            if(this.trigger["timer"].toString() == "{}"){
                return idMap
            }
            //Create TimerTriggerClass instance.
            val timerInfo = this.trigger["timer"] as MutableMap<String,Any>
            val numberTime = timerInfo["seconds"] as Number
            val time = numberTime.toLong()
            val timerTrigger = TimerTrigger(this.context!!,time)

            timerTrigger.scheduleNotification(timerManageId)
            idMap["timer"] = timerManageId
            //Save trigger information. Android Only.
            val saveTriggerInfo: MutableMap<String,Any> = mutableMapOf()
            saveTriggerInfo["type"] = "timer"
            saveTriggerInfo["timer"] = timerInfo
            NotificationObjectManager.setNotificationTrigger(context!!,timerManageId,saveTriggerInfo)
            //Save self. Android Only.
            NotificationObjectManager.setNotificationObj(timerManageId, this)
            //Save subclass name. Android Only.
            NotificationObjectManager.setClassName(context!!,timerManageId,this.subClassName)
            //Save notification information. Android Only.
            NotificationObjectManager.setNotificationInfo(context!!,timerManageId,this.notificationInfo)
        }
        if(this.trigger.containsKey("calendar")){
            var calendarManageId = ""
            if(manageId != ""){
                calendarManageId = manageId
            }else{
                //Create notificationId.
                this.notificationId =  UUID.randomUUID().hashCode()
                //Create manageId.
                calendarManageId = this.channelId + "__alier__" + this.notificationId
            }

            class ItemName {
                var year = "year"
                var month = "month"
                var day = "day"
                var hour = "hour"
                var minute = "minute"
                var second = "second"
                var weekday = "weekday"
                var weekOfMonth = "weekOfMonth"
                var repeatType = "repeatType"
                var adjustEndOfMonth = "adjustEndOfMonth"
            }
            //When no value is specified.
            if(this.trigger["calendar"].toString() == "{}"){
                return idMap
            }
            val calendarInfo = this.trigger["calendar"] as MutableMap<String,Any>
            //When mandatory fields are left empty.
            if(!calendarInfo.containsKey(ItemName().hour) || !calendarInfo.containsKey(ItemName().minute)){
                return mutableMapOf()
            }
            idMap["calendar"] = manageId
            var year: Int? = null
            var month: Int? = null
            var day: Int? = null
            var hour: Int? = null
            var minute: Int? = null
            var second: Int? = null
            var weekday: Int? = null
            var weekOfMonth: Int? = null
            var repeatType = ""
            var adjustEndOfMonth: Boolean? = null

            //Check include some calendar trigger keys.
            if(calendarInfo.containsKey(ItemName().year)){
                val _number = calendarInfo[ItemName().year] as Number?
                year = _number?.toInt()
            }
            if(calendarInfo.containsKey(ItemName().month)){
                val _number = calendarInfo[ItemName().month] as Number?
                month = _number?.toInt()
            }
            if(calendarInfo.containsKey(ItemName().day)){
                val _number = calendarInfo[ItemName().day] as Number?
                day = _number?.toInt()
            }
            if(calendarInfo.containsKey(ItemName().hour)){
                val _number = calendarInfo[ItemName().hour] as Number?
                hour = _number?.toInt()
            }
            if(calendarInfo.containsKey(ItemName().minute)){
                val _number = calendarInfo[ItemName().minute] as Number?
                minute = _number?.toInt()
            }
            if(calendarInfo.containsKey(ItemName().second)){
                val _number = calendarInfo[ItemName().second] as Number?
                second = _number?.toInt()
            }
            if(calendarInfo.containsKey(ItemName().weekday)){
                val _number = calendarInfo[ItemName().weekday] as Number?
                weekday = _number?.toInt()
            }
            if(calendarInfo.containsKey(ItemName().weekOfMonth)){
                val _number = calendarInfo[ItemName().weekOfMonth] as Number?
                weekOfMonth = _number?.toInt()
            }
            if(calendarInfo.containsKey(ItemName().repeatType)){
                repeatType = calendarInfo[ItemName().repeatType].toString()
            }
            if(calendarInfo.containsKey(ItemName().adjustEndOfMonth)){
                adjustEndOfMonth = calendarInfo[ItemName().adjustEndOfMonth] as Boolean
            }
            //Create Trigger.
            val calendarTrigger = CalendarTrigger(
                this.context!!,
                year, month, day, hour, minute, second, weekday, weekOfMonth, repeatType, adjustEndOfMonth
            )
            calendarTrigger.scheduleNotification(calendarManageId)
            idMap["calendar"] = calendarManageId
            //Save trigger information. Android only.
            val saveTriggerInfo: MutableMap<String,Any> = mutableMapOf()
            saveTriggerInfo["type"] = "calendar"
            saveTriggerInfo["calendar"] = calendarInfo
            NotificationObjectManager.setNotificationTrigger(context!!,calendarManageId,saveTriggerInfo)
            //Save self. Android only.
            NotificationObjectManager.setNotificationObj(calendarManageId, this)
            //Save subclass name. Android only.
            NotificationObjectManager.setClassName(context!!,calendarManageId,this.subClassName)
            //Save notification information. Android only.
            NotificationObjectManager.setNotificationInfo(context!!,calendarManageId,this.notificationInfo)
        }
        return idMap
    }

    @RequiresApi(Build.VERSION_CODES.O)
    @SuppressLint("LaunchActivityFromNotification")
    //This is the core of the notification sending process.
    override fun prepareNotification(context: Context,manageId:String) {
        this.context ?: throw IllegalStateException("Context not set!")
        // 1.Create notification channel.
        val channel: NotificationChannel
        val channelName = this.channelId + "_" + this.title
        channel = NotificationChannel(this.channelId, channelName, this.channelImportance)
        if(this.badge<=0){
            channel.setShowBadge(false)
        }
        //2. Create notification manager.
        this.manager = NotificationManagerCompat.from(this.context!!)
        this.manager.createNotificationChannel(channel)

        //3. Prepare intent.
        //Use BroadcastReceiver to allow calling callNotificationAction through NotificationManager.
        val intent = Intent(context, IntermediateActivity::class.java)//Specify receiver.
        val classInfo = createLaunch() //Class information is called by IntermediateActivity.
        val requestCode = System.currentTimeMillis().toInt()//for PendingIntent(Handle multiple different notifications.)
        //Set values to pass when starting the Intent.
        intent.putExtra("manage_id", createIntentData(manageId,data,scheme))//Value to be passed when notifying.
        intent.putExtra("class_name",classInfo.name)//Information to call another Intent from the  IntermediateActivity.
        val pendingIntent: PendingIntent = PendingIntent.getActivity(context, requestCode, intent,  PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        //Notification content registration
        //Register notification information.
        notificationBuilder = NotificationCompat.Builder(this.context!!, channelId)
            .setContentTitle(this.title)
            .setContentText(this.message)
            .setPriority(this.notificationPriority)
            //Set the intent to be triggered when the user taps the notification.
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)//auto delete
            // Setting where notifications are displayed.
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        if(this.sound!=null){
            notificationBuilder.setSound(Uri.parse(this.sound))
        }
        if(this.badge>0){
            notificationBuilder.setNumber(this.badge)
        }
        if(this.image != null){
            val assets = context.assets
            try {
                val inputStream = assets.open(this.image!!)
                val bitmap = BitmapFactory.decodeStream(inputStream)
                notificationBuilder
                    .setLargeIcon(bitmap)
                    .setStyle(NotificationCompat.BigPictureStyle()
                        .bigPicture(bitmap).bigLargeIcon(bitmap))//bitmap only.
            } catch (error: IOException) {}
        }

        //Set Icon.
        notificationBuilder.setSmallIcon(R.drawable._library_ic_launcher_foreground)
        if(this.icon != null){
            val iconId = context!!.getResources().getIdentifier(this.icon!!,"drawable",context!!.getPackageName())
            if(iconId != 0){
                notificationBuilder.setSmallIcon(iconId)
            }
        }
    }

    //Send Notification to System. Called by TriggerClass side.
    @SuppressLint("MissingPermission")
    @RequiresApi(Build.VERSION_CODES.O)
    override fun send(context: Context,manageId: String){
        // Check notification permission.
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return@send
        }
        //Send local push notification.
        val (channelId_, notificationId) = manageId.split("__alier__")
        manager.notify(notificationId.toInt(), notificationBuilder.build())
    }

    override fun deleteNotification(context: Context?, manageId: String){
        if(context==null){ return }
        //Release trigger.
        GlobalScope.launch {
            //Get the notification type (notification information) registered in the dataStore.
            val trigger = NotificationObjectManager.getNotificationTrigger(context, manageId)
            val triggerType = trigger["type"] as String

            if(triggerType == NotificationBase.TriggerType.timer.toString()){
                //Create timer trigger instance.
                val timerTrigger = TimerTrigger(context,0)
                timerTrigger.cancelTimer(manageId)
            }else
                if(triggerType == NotificationBase.TriggerType.calendar.toString()){
                    //Create calendar trigger instance.
                    val calendarTrigger = CalendarTrigger(context)
                    calendarTrigger.cancelCalendar(manageId)
            }

            //Remove the target notification from the Map that stores the instance of the notification class.
            //Remove the derived class name.
            //Delete the notification information.
            //Remove the notification issuance management flag.
            //Delete the trigger.
            NotificationObjectManager.deleteNotificationInstance(manageId)
            NotificationObjectManager.deleteClassName(context!!,manageId)
            NotificationObjectManager.deleteNotificationInfo(context!!,manageId)
            NotificationObjectManager.deleteNotifiedFlag(context!!,manageId)
            NotificationObjectManager.deleteNotificationTrigger(context!!,manageId)

            val (channelId_, notificationId) = manageId.split("__alier__")
            val channelId = channelId_.dropLast(1)
            //Delete registered notification.
            NotificationManagerCompat.from(context!!).cancel(notificationId.toInt())
            //Delete registered notification channel.
            NotificationManagerCompat.from(context!!).deleteNotificationChannel(channelId)
            //Initialize notification information.
            initializeNotificationInfo()
        }
    }

    open fun initializeNotificationInfo(){
        this.setTitle("")
        this.setMessage("")
        this.setChannelId("")
        this.setData(mutableMapOf())
        this.setBadge(0)
        this.setSound("default")
        this.image = null
        this.scheme = null
        this.icon = null// Android only.
        this.repeatNotification = mutableMapOf("timer" to false, "calendar" to false)
        this.notificationId = null//uuid
        this.notificationInfo = ""// Android only.
    }

    override fun getNotificationInstance(): NotificationBase { return this }
    override fun getData():MutableMap<String, String>{return this.data}
    override fun getScheme(): String?{return this.scheme}
    override fun getRepeat(): MutableMap<String,Boolean> {
        return this.repeatNotification
    }

    //Create data to pass to the Intent: Default notification version.
    private fun createIntentData(manageId: String, data: MutableMap<String, String>, scheme: String?):String{
        val dataMap = mutableMapOf<String, Any>()
        val dataJSONString = MapAndJSONFormatter.mutableMapToJSON(data as MutableMap<String, Any>).toString()
        dataMap.set("manageId",manageId)
        dataMap.set("data",dataJSONString)
        dataMap.set("scheme",scheme ?: "")
        val jsonObject = (dataMap as Map<*, *>?)?.let { JSONObject(it) }
        val jsonString = jsonObject.toString()
        return jsonString
    }

    //Get notification information from the intent in onReceive.
    override fun extractNotificationInfo(intent: Intent?):MutableMap<String, Any>{
        if(intent==null){ return  mutableMapOf() }
        //Extract notification information when application user tapped notification.
        val notificationData = intent.getStringExtra("manage_id") ?: return mutableMapOf()
        return MapAndJSONFormatter.jsonToMutableMap(notificationData)
    }
}

class MapAndJSONFormatter{
    companion object {
        //Translate JSON Stringify to MutableMap.
        fun jsonToMutableMap(jsonString: String): MutableMap<String, Any> {
            //to JSON
            val jsonObject = JSONObject(jsonString)
            return jsonObjectToMap(jsonObject)
        }

        //Convert nested objects recursively into a MutableMap.
        fun jsonObjectToMap(jsonObject: JSONObject): MutableMap<String, Any> {
            val map = mutableMapOf<String, Any>()
            //Get value from json.
            for (key in jsonObject.keys()) {
                val value = jsonObject.get(key)
                //Check if it's a JSON object.
                map[key] = when (value) {
                    is JSONObject -> jsonObjectToMap(value) // translate recursively
                    else -> value
                }
            }
            return map
        }

        //Translate MutableMap to JSON.
        fun mutableMapToJSON(map: MutableMap<String,Any>): JSONObject{
            val jsonObject = JSONObject()
            for ((key, value) in map) {
                jsonObject.put(key, when (value) {
                    is Map<*, *> -> mutableMapToJSON(value as MutableMap<String, Any>)  // translate recursively
                    else -> value
                })
            }
            return jsonObject
        }
    }
}

// The class provided by Alier.
class SimpleDefaultNotification: DefaultNotification(){
    override fun tappedBanner(data: MutableMap<String, Any>) {
        sendNotificationEventToJS(context,data)
    }
}

open class SimpleNotificationManager(context: Context){
    val context: Context
    //TODO: This is unnecessary because there is a companion object.
    private val notificationMap: MutableMap<String, NotificationBase> = mutableMapOf()
    init{
        this.context = context
        //Clean up the notification management map for notifications that have been triggered.
        val notificationFlags = NotificationObjectManager.getNotifiedFlags(context)
        for(flag in notificationFlags){
            //Remove only the ones that were triggered.
            if(flag.value){
                deleteNotification(context,flag.key)
            }
        }
    }

    public fun createNotification(payload: MutableMap<String,Any>?, trigger: MutableMap<String,Any>?): MutableMap<String,String>{
        if(payload == null || trigger == null){
            return mutableMapOf()
        }
        val simpleNotification = SimpleDefaultNotification()
        simpleNotification.createNotification(payload!!,trigger!!)
        simpleNotification.setContext(this.context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationIdMap = simpleNotification.scheduleNotification()
            for(id in notificationIdMap){
                //TODO: This is unnecessary because there is a companion object.
                notificationMap[id.value] = simpleNotification
            }
            return  notificationIdMap
        }else{
            return mutableMapOf()
        }
    }

    public fun deleteNotification(context: Context? = null,notificationId: String){
        //When the key exists in the map.
        if(this.notificationMap.containsKey(notificationId)) {
            val notificationInstance = this.notificationMap[notificationId]
            var _context = notificationInstance!!.context
            if(_context==null && context==null){
                return
            }else
            if(_context==null) {
                _context = context
            }
            notificationInstance?.deleteNotification(_context,notificationId)
            //Delete instance.
            notificationMap.remove(notificationId)
        }else{
            val simpleNotification = SimpleDefaultNotification()
            if(context==null){
                return
            }
            //Release trigger.
            simpleNotification.deleteNotification(context,notificationId)
        }
    }
    //This is an iOS-only function, so it does nothing,
    // but for safety reasons it can be called from the JS side.
    public fun setBadgeNumber(number: Number){}
}