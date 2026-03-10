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

/**
 * Converts the given string to a value of the given type.
 *
 *  @param {string} s a string representing a serialized value
 *  @param {function} ctor a destination type
 */
const _strto = (s, ctor) => {
    if (typeof s !== "string") {
        return s;
    }
    switch (ctor) {
        case BigInt: {
            return BigInt(s);
        }
        case Boolean: {
            return s === "true" ? true : s === "false" ? false : s;
        }
        case Number: {
            //  Number(" ") returns 0 instead of NaN. Hence testing whether or not s is spaces/empty before type conversion.
            if (/^\s*$/.test(s)) {
                return s;
            }
            const n = Number(s);
            return Number.isNaN(n) ? s : n;
        }
        case String: {
            return s;
        }
        case null: {
            return s;
        }
        case undefined: {
            return s;
        }
        default: {
            return s;
        }
    }
};

/**
 * The binding source to observe a value.
 * @template T
 * @typedef Subject<T>
 * @property {() => T} getValue Get the value from binding source.
 * @property {(newValue: T) => boolean} setValue Set the value to binding source.
 */

/**
 * @template T
 * @typedef Observer<T>
 * @property {(source: Subject) => boolean} onDataBinding
 * @property {(newValue: T) => boolean} setValue
 */

const CONNECTOR_SOURCE = Symbol("connector_source");
const CONNECTOR_TARGET = Symbol("connector_target");

/**
 * @template T
 * @interface
 */
class Connector {
    #source;
    #target;

    get [CONNECTOR_SOURCE]() {
        return this.#source;
    }

    get [CONNECTOR_TARGET]() {
        return this.#target.deref();
    }

    /**
     * Connect binding source and target
     * @param {ObservableValue<T>} source Binding source
     * @param {Observer<T>} target Binding target
     */
    constructor(source, target) {
        this.#source = source;
        this.#target = new WeakRef(target);
    }

    /**
     * Get the observed value from binding source.
     * @returns {T}
     */
    getValue() {}

    /**
     * Set value as observed to binding source.
     * @param {T} newValue
     * If bind with two way, update binding source with new value.
     * Otherwise, no effect to binding source, and recover source value to binding target.
     * @returns {boolean} Is updated.
     */
    setValue() {}
}

/**
 * @template T
 */
class TwoWayConnector extends Connector {
    getValue() {
        return this[CONNECTOR_SOURCE].getValue();
    }

    /**
     * @override
     * @param {T} newValue Update binding source with new value.
     * @returns {boolean} Is updated.
     */
    setValue(newValue) {
        return this[CONNECTOR_SOURCE].setValue(newValue);
    }
}

/**
 * @template T
 */
class OneWayConnector extends Connector {
    getValue() {
        return this[CONNECTOR_SOURCE].getValue();
    }

    /**
     * @override
     * @param {T} newValue
     * No effect to binding source because of one way, recover source value to binding target.
     * @returns {false} Always false.
     */
    setValue(newValue) {
        const target = this[CONNECTOR_TARGET];
        if (target === undefined) {
            return false;
        }

        const current_value = this[CONNECTOR_SOURCE].getValue();
        const target_value_equiv = _strto(newValue, current_value?.constructor);
        if (current_value === target_value_equiv) {
            return false;
        }

        target.setValue(current_value);

        return false;
    }
}

/**
 * @template {string|boolean|number|bigint|symbol} T
 */
class ObservableValue {
    /** @type {T} */
    #value;

    /** @type {boolean} */
    #allows_two_way;

    /** @type {Set<TwoWayConnector|OneWayConnector>} */
    #connectors = new Set();

    get allowsTwoWay() {
        return this.#allows_two_way;
    }

    /**
     * Observe a value.
     * Synchronize the value with bound objects.
     * @param {T} value Initialize with this to observe.
     * @param {boolean} allowsTwoWay
     * Wheather or not to allow two way binding. Defaults to `false`.
     */
    constructor(value, allowsTwoWay = false) {
        if (
            value === undefined ||
            typeof value === "object" ||
            typeof value === "function"
        ) {
            throw new TypeError("value is not undefined or object");
        }
        if (typeof allowsTwoWay !== "boolean") {
            throw new TypeError(`${allowsTwoWay} is not a boolean`);
        }

        this.#allows_two_way = allowsTwoWay;
        this.setValue(value);
    }

    /**
     * Bind object to observe specific value.
     * @param {Observer<T>} target Target object to observe this.
     * @param {boolean} twoWay Defaults to `this.allowsTwoWay`.
     * @returns {boolean} Success to bind `this`.
     */
    bindData(target, twoWay = this.allowsTwoWay) {
        let error_message;
        if (target === null || typeof target !== "object") {
            error_message = `target is not a non-null object`;
        } else if (typeof twoWay !== "boolean") {
            error_message = `${twoWay} is not a boolean`;
        } else if (
            typeof target.onDataBinding !== "function" ||
            typeof target.setValue !== "function"
        ) {
            error_message =
                "target is not implemented to 'onDataBinding' and 'setValue'";
        } else if ("source" in target && target.source != null) {
            if (this.#connectors.has(target.source)) {
                Alier.Sys.loge(
                    0,
                    `${this.constructor.name}::${this.bindData.name}()`,
                    "target is already bound with this source",
                );
                return true;
            }
            error_message = "target is already bound with other source";
        }

        if (error_message) {
            Alier.Sys.loge(
                0,
                `${this.constructor.name}::${this.bindData.name}()`,
                error_message,
            );
            return false;
        }

        /** @type {Connector<T>} */
        const connector =
            twoWay && this.allowsTwoWay
                ? new TwoWayConnector(this, target)
                : new OneWayConnector(this, target);

        try {
            target.onDataBinding(connector);
        } catch (err) {
            Alier.Sys.loge(
                0,
                `${this.constructor.name}::${this.bindData.name}()`,
                `failed to execute ${target.onDataBinding.name}:`,
                err,
            );
            return false;
        }

        if (target.source !== connector) {
            Alier.Sys.loge(
                0,
                `${this.constructor.name}::${this.bindData.name}()`,
                "target doesn't have source",
            );
            return false;
        }

        const current_value = this.getValue();
        try {
            target.setValue(current_value);
        } catch (err) {
            Alier.Sys.loge(
                0,
                `${this.constructor.name}::${this.bindData.name}()`,
                "failed to setValue:",
                err,
            );
            return false;
        }

        this.#connectors.add(connector);

        return true;
    }

    /**
     * Get value to be observed.
     * @returns {T}
     */
    getValue() {
        return this.#value;
    }

    /**
     * Set the value to be observed.
     * @param {T} newValue Update with this.
     * @returns {boolean} Is updated.
     */
    setValue(newValue) {
        const old_value = this.getValue();
        const new_value = _strto(newValue, old_value?.constructor);

        if (old_value === new_value) {
            return false;
        }

        const be_update =
            typeof old_value === typeof new_value || old_value == null;
        if (be_update) {
            this.#value = new_value;
        }

        const current_value = this.getValue();
        this.#connectors.forEach((connector) => {
            const target = connector[CONNECTOR_TARGET];
            if (target === undefined) {
                this.#connectors.delete(connector);
            } else {
                target.setValue(current_value);
            }
        });

        return be_update;
    }
}

export { ObservableValue };
