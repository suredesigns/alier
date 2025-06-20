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

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper

fun interface OnConfigure {
    fun invoke(db: SQLiteDatabase?)
}

fun interface OnCreate {
    fun invoke(db: SQLiteDatabase)
}

fun interface OnUpgrade {
    fun invoke(db: SQLiteDatabase, oldVersion: Int, newVersion: Int)
}

fun interface OnDowngrade {
    fun invoke(db: SQLiteDatabase, oldVersion: Int, newVersion: Int)
}

fun interface OnOpen {
    fun invoke(db: SQLiteDatabase?)
}

class _DBOpenHelper
    /**
     * @constructor
     * Creates a new [_DBOpenHelper].
     *
     * @param applicationContext
     * An application [Context] used to get the database paths
     *
     * @param name
     * A string representing the database file name or `null` for an in-memory database.
     *
     * @param factory
     * A [SQLiteDatabase.CursorFactory] used for creating cursor objects
     * or `null` for using the default factory.
     *
     * @param version
     * An integer representing the database version.
     * This must be greater than or equal to 1 (`version >= 1`).
     *
     * @param onConfigure
     * A callback function invoked before creating / upgrading / downgrading the database.
     *
     * By default, this function do nothing.
     *
     * @param onCreate
     * A callback function invoked when creating the database.
     *
     * This function is invoked if the database does not exist yet.
     * A transaction begins before this process and ends after this process.
     *
     * @param onUpgrade
     * A callback function invoked when upgrading the database.
     *
     * This function is invoked if the database **already exists** and
     * the given version is **newer** than the existing database version.
     * A transaction begins before this process and ends after this process.
     *
     * @param onDowngrade
     * A callback function invoked when downgrading the database.
     *
     * This function is invoked if the database **already exists** and
     * the given `version` is **older** than the existing database version.
     * A transaction begins before this process and ends after this process.
     *
     * By default, `SQLiteException` is thrown when downgrading.
     *
     * @param onOpen
     * A callback function invoked **after** creating / upgrading / downgrading the database.
     */
    constructor(
        applicationContext: Context,
        name: String?,
        factory: SQLiteDatabase.CursorFactory?,
        version: Int,
        onConfigure: OnConfigure? = null,
        onCreate: OnCreate? = null,
        onUpgrade: OnUpgrade? = null,
        onDowngrade: OnDowngrade? = null,
        onOpen: OnOpen? = null
    ) :
    SQLiteOpenHelper(applicationContext, name, factory, version),
    AutoCloseable
{
    private val _on_configure = onConfigure
    private val _on_create    = onCreate
    private val _on_upgrade   = onUpgrade
    private val _on_downgrade = onDowngrade
    private val _on_open      = onOpen

    override fun onConfigure(db: SQLiteDatabase?) {
        //  super.onConfigure() does nothing
        _on_configure?.invoke(db)
    }

    override fun onCreate(db: SQLiteDatabase) {
        _on_create?.invoke(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        _on_upgrade?.invoke(db, oldVersion, newVersion)
    }

    override fun onDowngrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (_on_downgrade == null) {
            //  This is effectively the same thing as super.onDowngrade() implementation.
            //  However, in order to erase fictitious complexity,
            //  throw an exception by hands instead using the super class's method here.
            throw SQLiteException("Cannot downgrade the database from version $oldVersion to $newVersion")
        }
        _on_downgrade.invoke(db, oldVersion, newVersion)
    }

    override fun onOpen(db: SQLiteDatabase?) {
        //  super.onOpen() does nothing
        _on_open?.invoke(db)
    }
}