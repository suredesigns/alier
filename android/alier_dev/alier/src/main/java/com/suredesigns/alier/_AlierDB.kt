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

import android.database.Cursor
import android.database.SQLException
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.lang.IllegalArgumentException
import androidx.core.database.sqlite.transaction

private fun asSqlIdentifier(s: String): String {
    return if (s.matches(Regex("""^[_a-zA-Z][0-9_a-zA-Z]*$"""))) {
        s
    } else {
        "\"${s.replace("\"", "\"\"")}\""
    }
}

private fun asSqlString(s: String): String {
    return "'${s.replace("'", "''")}'"
}

private fun asSqlValue(rawValue: Any?): String {
    return when (rawValue) {
        is String  -> asSqlString(rawValue)
        is Number  -> rawValue.toString()
        is Boolean -> if (rawValue) { "1" } else { "0" }
        else       -> "NULL"
    }
}

/**
 * Gets records from the given cursor.
 *
 * @param cursor
 * An [Cursor] object to be used for obtaining records fetched from database.
 *
 * @return
 * An array of records.
 * Each record is represented as a [Map] and its keys are column names of
 * the associated table.
 *
 * If the given cursor is empty or closed, an empty array is returned.
 */
private fun getRecords(cursor: Cursor): Array<Map<String, Any?>> {
    if (cursor.isClosed) {
        return arrayOf()
    }
    if (!cursor.moveToFirst()) {
        return arrayOf()
    }

    val col_count = cursor.columnCount
    val column_names = cursor.columnNames

    return Array(cursor.count) {
        val record: MutableMap<String, Any?> = column_names.associateWith { null }.toMutableMap()

        for (col_index in 0 until col_count) {
            val col_name = cursor.getColumnName(col_index)
            record[col_name] = when (cursor.getType(col_index)) {
                Cursor.FIELD_TYPE_INTEGER -> cursor.getInt(col_index)
                Cursor.FIELD_TYPE_FLOAT   -> cursor.getFloat(col_index)
                Cursor.FIELD_TYPE_STRING  -> cursor.getString(col_index)
                Cursor.FIELD_TYPE_BLOB    -> cursor.getBlob(col_index)
                else -> null
            }
        }

        cursor.moveToNext()

        record.toMap()
    }
}
sealed class SQLResult(val status: Boolean) {
    abstract fun toMap(): Map<String, Any?>
}

data class SQLFailure(val message: String?): SQLResult(status = false) {
    override fun toMap(): Map<String, Any?> = if (message == null) {
        mapOf("status" to status)
    } else {
        mapOf("status" to status, "message" to message)
    }
}

data class SQLSuccess(
    val records: Array<Map<String, Any?>>?
) : SQLResult(status = true) {
    override fun toMap(): Map<String, Any?> = if (records == null) {
        mapOf("status" to status)
    } else {
        mapOf("status" to status, "records" to records)
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is SQLSuccess) return false
        return records.contentEquals(other.records)
    }

    override fun hashCode(): Int {
        return records.contentHashCode()
    }
}

enum class IndexOriginKind(val tag: String) {
    CREATE_INDEX("create-index"),
    UNIQUE("unique"),
    PRIMARY_KEY("primary-key")
    ;

    companion object {
        fun of(tag: String): IndexOriginKind {
            return entries.first { kind ->
                kind.tag.equals(tag, ignoreCase = true)
            }
        }
    }
}

enum class ActionKind(val tag: String) {
    SET_NULL("set-null"),
    SET_DEFAULT("set-default"),
    CASCADE("cascade"),
    RESTRICT("restrict"),
    NO_ACTION("no-action")
    ;

    companion object {
        fun of(tag: String): ActionKind {
            return entries.firstOrNull { kind ->
                kind.tag.equals(tag, ignoreCase = true)
            } ?: NO_ACTION
        }
    }
}

data class IndexSchema(
    val name: String,
    val unique: Boolean,
    val origin: IndexOriginKind,
    val columns: Array<String>,
    val where: String?
) {
    constructor(name: String, jsonObject: JSONObject): this(
        name    = name,
        unique  = jsonObject.optBoolean("unique"),
        origin  = IndexOriginKind.of(jsonObject.getString("origin")),
        columns = jsonObject.getJSONArray("columns").run {
            Array(length()) { i -> getString(i) }
        },
        where   = jsonObject.opt("partial") as? String
    )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is IndexSchema) return false

        if (unique != other.unique) return false
        if (name != other.name) return false
        if (origin != other.origin) return false
        if (!columns.contentEquals(other.columns)) return false
        if (where != other.where) return false

        return true
    }

    override fun hashCode(): Int {
        var result = unique.hashCode()
        result = 31 * result + name.hashCode()
        result = 31 * result + origin.hashCode()
        result = 31 * result + columns.contentHashCode()
        result = 31 * result + (where?.hashCode() ?: 0)
        return result
    }
}

data class ForeignKeySchema(
    val from: String,
    val table: String,
    val to: String,
    val onUpdate: ActionKind,
    val onDelete: ActionKind
) {
    constructor(from: String, jsonObject: JSONObject): this(
        from     = from,
        table    = jsonObject.getString("table"),
        to       = jsonObject.getString("to"),
        onUpdate = ActionKind.of(jsonObject.optString("onUpdate")),
        onDelete = ActionKind.of(jsonObject.optString("onDelete"))
    )
}

data class ColumnSchema(
    val name: String,
    val type: String,
    val unique: Boolean,
    val nullable: Boolean,
    val defaultValue: Any?,
    val foreignKey: ForeignKeySchema?
) {
    constructor(name: String, jsonObject: JSONObject): this(
        name = name,
        type = jsonObject.getString("type"),
        unique = jsonObject.optBoolean("unique"),
        nullable = jsonObject.optBoolean("nullable"),
        defaultValue = jsonObject.opt("defaultValue"),
        foreignKey = when (val fk = jsonObject.optJSONObject("foreignKey")) {
            null -> null
            else -> ForeignKeySchema(name, fk)
        }
    )
}

data class TableSchema(
    val name: String,
    val primaryKey: Array<String>?,
    val indexes: Map<String, IndexSchema>?,
    val columns: Map<String, ColumnSchema>
) {
    constructor(jsonObject: JSONObject): this(
        name = jsonObject.getString("name"),
        primaryKey = when (val pk: Any? = jsonObject.opt("primaryKey")) {
            null -> null
            is JSONArray -> pk.run {
                Array(length()) { i -> getString(i) }
            }
            is String -> Regex("""[_a-zA-Z][_a-zA-Z0-9]*|"(?:[^"]|"")*"""")
                .findAll(pk)
                .toList().run { Array(size) { i -> this[i].value } }
            else -> null
        },
        indexes = when (val indexes = jsonObject.optJSONObject("indexes")) {
            null -> null
            else -> indexes.keys()
                .asSequence()
                .associateWith { k -> IndexSchema(k, indexes.getJSONObject(k)) }
        },
        columns = jsonObject.getJSONObject("columns").run {
            this.keys()
                .asSequence()
                .associateWith { k -> ColumnSchema(k, this.getJSONObject(k)) }
        }
    )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is TableSchema) return false

        if (name != other.name) return false
        if (!primaryKey.contentEquals(other.primaryKey)) return false
        if (indexes != other.indexes) return false
        if (columns != other.columns) return false

        return true
    }

    override fun hashCode(): Int {
        var result = name.hashCode()
        result = 31 * result + primaryKey.contentHashCode()
        result = 31 * result + indexes.hashCode()
        result = 31 * result + columns.hashCode()
        return result
    }
}

data class DatabaseSchema(
    val tables: Array<TableSchema>
) {
    constructor(jsonObject: JSONObject): this(
        tables = jsonObject.getJSONArray("tables").run {
            Array(length()) { i -> TableSchema(getJSONObject(i)) }
        }
    )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is DatabaseSchema) return false

        return tables.contentEquals(other.tables)
    }

    override fun hashCode(): Int {
        return tables.contentHashCode()
    }
}

class _AlierDB(activity: BaseMainActivity) {
    private var _activity: BaseMainActivity = activity
    private var _helper_dict: MutableMap<String, _DBOpenHelper> = mutableMapOf()

    fun addDB(
        name: String,
        version: Int,
        onConfigure: OnConfigure? = null,
        onCreate: OnCreate? = null,
        onUpgrade: OnUpgrade? = null,
        onDowngrade: OnDowngrade? = null,
        onOpen: OnOpen? = null
    ) {
        _helper_dict[name] = _DBOpenHelper(
            applicationContext = _activity.applicationContext,
            name = name,
            factory = null,
            version = version,
            onConfigure = onConfigure,
            onCreate = onCreate,
            onUpgrade = onUpgrade,
            onDowngrade = onDowngrade,
            onOpen = onOpen
        )
    }

    fun close() {
        for (helper in _helper_dict.values) {
            helper.close()
        }
    }

    fun createDatabaseFromSchema(name: String, schemaJson: String) {
        val db     = _getWritableDatabase(name)
        val schema = DatabaseSchema(JSONObject(schemaJson))

        db.transaction {
            for (table in schema.tables) {
                val column_definitions = table.columns.values.map {
                    var column_definition = "${it.name} ${it.type}"
                    if (it.unique) {
                        column_definition += " "
                        column_definition += "UNIQUE"
                    }
                    if (!it.nullable) {
                        column_definition += " "
                        column_definition += "NOT NULL"
                    }
                    if (it.defaultValue != null) {
                        column_definition += " "
                        column_definition += asSqlValue(it.defaultValue)
                    }
                    val fk = it.foreignKey
                    if (fk != null) {
                        val table_ = asSqlIdentifier(fk.table)
                        val to_    = asSqlIdentifier(fk.to)
                        column_definition += " "
                        column_definition += "REFERENCES $table_($to_)"
                        column_definition += when (fk.onUpdate) {
                            ActionKind.SET_NULL    -> " " + "SET NULL"
                            ActionKind.SET_DEFAULT -> " " + "SET DEFAULT"
                            ActionKind.CASCADE     -> " " + "CASCADE"
                            ActionKind.RESTRICT    -> " " + "RESTRICT"
                            ActionKind.NO_ACTION   -> ""  //  no need for setting NO ACTION explicitly
                        }
                        column_definition += when (fk.onDelete) {
                            ActionKind.SET_NULL    -> " " + "SET NULL"
                            ActionKind.SET_DEFAULT -> " " + "SET DEFAULT"
                            ActionKind.CASCADE     -> " " + "CASCADE"
                            ActionKind.RESTRICT    -> " " + "RESTRICT"
                            ActionKind.NO_ACTION   -> ""  //  no need for setting NO ACTION explicitly
                        }
                    }

                    column_definition
                }
                val table_constraints = mutableListOf<String>()
                val primary_key = table.primaryKey
                if (primary_key != null) {
                    val pk = primary_key.joinToString(",") { asSqlIdentifier(it) }
                    table_constraints.add("PRIMARY KEY ($pk)")
                }

                execSQL(
                    """
                    |CREATE TABLE IF NOT EXISTS ${asSqlIdentifier(table.name)} (
                    |   ${column_definitions.joinToString("\n")}
                    |   ${table_constraints.joinToString(",")}
                    |);
                    """.trimMargin()
                )
            }
        }
    }

    /**
     * @param name
     * A string representing the target database name.
     *
     * @param mode
     * A string representing transaction mode.
     *
     * This argument must be either one of the following:
     *
     * -    `"exclusive"`
     * -    `"immediate"`
     *
     * @throws IllegalArgumentException
     * When the specified database is not found.
     *
     * @throws SQLException
     * When
     * -    there is an on-going transaction, or
     * -    the given transaction mode is unknown
     */
    fun startTransaction(name: String, mode: String) {
        val db = _getWritableDatabase(name)

        //  Prevent unintended transaction nesting.
        //  SQLiteDatabase supports transaction nesting but SQLite itself does not.
        //  To keep compatibility with other platform such as iOS,
        //  check whether or not there is an on-going transaction here.
        if (db.inTransaction()) {
            throw SQLException("Transaction already started")
        }

        when (mode.lowercase()) {
            "immediate" -> db.beginTransactionNonExclusive()
            "exclusive" -> db.beginTransaction()
            else -> throw SQLException("Unknown transaction mode is specified: $mode")
        }
    }

    /**
     * Commits the database state and then ends the transaction.
     *
     * @param name
     * A string representing the target database
     *
     * @throws IllegalArgumentException
     * When the specified database is not found
     *
     * @throws SQLException
     * When there is no on-going transaction
     */
    fun commit(name: String) {
        _endTransaction(name, doCommit = true)
    }

    /**
     * Rolls back the database state to the previous state
     * at the beginning of the current transaction and then
     * ends the transaction.
     *
     * @param name
     * A string representing the target database
     *
     * @throws IllegalArgumentException
     * When the specified database is not found
     *
     * @throws SQLException
     * When there is no on-going transaction
     */
    fun rollback(name: String) {
        _endTransaction(name, doCommit = false)
    }

    /**
     * Puts a new savepoint on the current transaction.
     *
     * @param name
     * A string representing the target database.
     *
     * @param savepoint
     * A string representing the target savepoint.
     *
     * This argument is converted as an SQL identifier and so
     * there is no need for adding escape sequences manually.
     *
     * @throws IllegalArgumentException
     * When the specified database is not found
     *
     * @throws SQLException
     * When there is no on-going transaction
     */
    fun putSavepoint(name: String, savepoint: String) {
        val db = _getWritableDatabase(name)
        if (!db.inTransaction()) {
            throw SQLException("There is no on-going transaction")
        }

        db.execSQL("SAVEPOINT ${asSqlIdentifier(savepoint)}")
    }

    /**
     * Rolls back the database state to the specified savepoint
     * on the current transaction.
     *
     * @param name
     * A string representing the target database.
     *
     * @param savepoint
     * A string representing the target savepoint.
     *
     * This argument is converted as an SQL identifier and so
     * there is no need for adding escape sequences manually.
     *
     * @throws IllegalArgumentException
     * When the specified database is not found
     *
     * @throws SQLException
     * When there is no on-going transaction
     */
    fun rollbackTo(name: String, savepoint: String) {
        val db = _getWritableDatabase(name)
        if (!db.inTransaction()) {
            throw SQLException("There is no on-going transaction")
        }

        db.execSQL("ROLLBACK TO ${asSqlIdentifier(savepoint)}")
    }

    /**
     * Executes the given SQL statement.
     *
     * @param name
     * A string representing the database name.
     *
     * @param statement
     * A string representing an SQL statement to execute.
     *
     * @param params
     * An array of parameters for the statement to execute.
     *
     * @return
     * A [SQLResult].
     * If the execution is succeeded, [SQLSuccess] is returned.
     * Otherwise, [SQLFailure] is returned.
     *
     * @throws IllegalArgumentException
     * When the database named [name] is not found
     */
    fun execute(name: String, statement: String, params: Array<Any?>): SQLResult {
        val statement_ = statement.trim()
        val command = """^[a-zA-Z]{0,6}\b""".toRegex().find(statement_)?.value?.uppercase() ?: ""

        if (command == "SELECT") {
            val db = _getWritableDatabase(name)
            val args = Array(params.size) { i ->
                params[i].toString()
            }

            var result: SQLResult

            try {
                db.rawQuery(statement_, if (args.isEmpty()) { null } else { args }).use { cursor ->
                    result = SQLSuccess(records = getRecords(cursor))
                }
            } catch (e: Exception) {
                result = SQLFailure(message = e.localizedMessage)
            }

            return result
        } else {
            val db = _getWritableDatabase(name)
            //  bindArgs for execSQL accepts Array<Long | Double | String | ByteArray | null>.
            //  To conform to this requirement, convert any integrals to Long,
            //  any floats to Double, and others to String except the values typed as
            //  Long, Double, String, ByteArray, or null.
            val args = Array(size = params.size) { i ->
                when (val v = params[i]) {
                    null        ,
                    is Long     ,
                    is Double   ,
                    is String   ,
                    is ByteArray   -> v
                    is Byte        -> v.toLong()
                    is Short       -> v.toLong()
                    is Int         -> v.toLong()
                    is UByte       -> v.toLong()
                    is UShort      -> v.toLong()
                    is UInt        -> v.toLong()
                    is Float       -> v.toDouble()
                    is Iterable<*> -> if (v.all { it is Byte || it is UByte }) { v } else { v.toString() }
                    else           -> v.toString()
                }
            }

            var result: SQLResult

            try {
                if (args.isEmpty()) {
                    db.execSQL(statement_)
                } else {
                    db.execSQL(statement_, args)
                }
                result = SQLSuccess(records = null)
            } catch (e: Exception) {
                result = SQLFailure(message = e.localizedMessage)
            }

            return result
        }
    }

    /**
     * Inserts records into the specified table.
     *
     * @param name
     * a string representing the database name
     *
     * @param table
     * A string representing the table name to insert records into.
     *
     * @param batchSize
     * A positive integer representing a batch size.
     *
     * The batch size limits the number of records per single INSERT statement.
     * The given records are split into a sequence of batches and then execute an INSERT statement
     * for each batch.
     *
     * @param records
     * An array of records to be inserted.
     *
     * @return
     * [SQLSuccess] if succeeded, otherwise [SQLFailure].
     */
    fun insert(name: String, table:String, batchSize: Int, records: Array<Array<Any?>>): SQLResult {
        if (batchSize <= 0) {
            throw IllegalArgumentException("batchSize must be greater than 0")
        }
        if (records.isEmpty()) {
            return SQLSuccess(null)
        }
        val (min_record_size, record_size) = records.fold(0 to 0) { min_max, record ->
            val (min_, max_) = min_max
            val sz = record.size
            if (max_ < sz) {
                min_ to sz
            } else if (min_ > sz) {
                sz to max_
            } else {
                min_max
            }
        }
        if (record_size <= 0) {
            throw IllegalArgumentException("Given records are empty")
        }
        if (min_record_size != record_size) {
            throw IllegalArgumentException("Record size mismatch: $record_size is expected but $min_record_size")
        }

        var first = 0
        var last  = if (batchSize > records.size) { records.size } else { batchSize }
        var batch = records.sliceArray(0.until(last))

        val table_ = asSqlIdentifier(table)

        var result: SQLResult
        _getWritableDatabase(name).use { db ->
            try {
                db.transaction {
                    while (records.size - first >= batchSize) {
                        val values = batch.joinToString(",") { record ->
                            record.joinToString(",", "(", ")") { v -> asSqlValue(v) }
                        }

                        execSQL("""INSERT INTO $table_ VALUES $values;""")

                        first += batch.size
                        last  += batchSize
                        batch = records.sliceArray(first.until(last))
                    }
                    if (first < records.size) {
                        batch = records.sliceArray(first.until(records.size))
                        val values = batch.joinToString(",") { record ->
                            record.joinToString(",", "(", ")") { v -> asSqlValue(v) }
                        }

                        execSQL("""INSERT INTO $table_ VALUES $values;""")
                    }
                }
                result = SQLSuccess(null)
            } catch (e: Exception) {
                result = SQLFailure(e.localizedMessage)
            }
        }

        return result
    }

    /**
     * Gets the specified database opened as writable.
     *
     * @throws IllegalArgumentException
     * When the specified database is not found
     */
    private fun _getWritableDatabase(name: String): SQLiteDatabase {
        return _helper_dict[name]?.writableDatabase ?:
        throw IllegalArgumentException("Database \"$name\" is not found")
    }

    private fun _endTransaction(name: String, doCommit: Boolean) {
        val db = _getWritableDatabase(name)
        if (!db.inTransaction()) {
            throw SQLException("There is no on-going transaction")
        }
        try {
            if (doCommit) {
                db.setTransactionSuccessful()
                //  this will throw an exception but it can be ignored safely.
            }
        } finally {
            db.endTransaction()
        }
    }
}