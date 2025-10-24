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


class Flag {
    /**
     * @type {FlagSet}
     */
    #flagset;
    /**
     * @type {boolean}
     */
    #value;
    /**
     * 
     * @param {boolean} value 
     * @param {FlagSet} flagset 
     */
    constructor(value, flagset) {
        this.#value = value === true;
        this.#flagset = flagset;
    }

    valueOf() {
        return this.#value;
    }

    toString() {
        return String(this.#value);
    }

    toJSON() {
        return this.valueOf();
    }

    set() {
        this.#value = true;
        return this.#flagset;
    }

    unset() {
        this.#value = false;
        return this.#flagset;
    }

    toggle() {
        this.#value = !this.#value;
        return this.#flagset;
    }
}

/**
 * A class used for managing a set of fixed flags.
 */
class FlagSet {
    /**
     * @constructor
     * 
     * @param {({
     *  [flagName: string]: boolean
     * }) | FlagSet} flags
     * A set of flags with their initial values.
     */
    constructor(flags) {
        const flags_ = flags;
        if (flags_ === null || typeof flags_ !== "object") {
            throw new TypeError("'initialStates' is not a non-null object");
        }

        if (flags_ instanceof FlagSet) {
            for (const [ flag_name, init_value ] of flags_.entries()) {
                Object.defineProperty(this, flag_name, {
                    configurable: false,
                    enumerable  : true,
                    writable    : false,
                    value       : new Flag(init_value.valueOf(), this)
                });
            }
        } else {
            for (const flag_name of Object.keys(flags_)) {
                const init_value = flags_[flag_name];
                Object.defineProperty(this, flag_name, {
                    configurable: false,
                    enumerable  : true,
                    writable    : false,
                    value       : new Flag(init_value, this)
                });
            }
        }
    }

    /**
     * Makes an array of the target `FlagSet`'s entries differ from
     * the given `FlagSet`. 
     * 
     * @param {FlagSet} other 
     * A `FlagSet` to compare with the target `FlagSet`.
     * 
     * @returns {[ string, boolean ][]}
     * An array of entries differ from the given `FlagSet`.
     */
    difference(other) {
        const diff = [];

        for (const flag_name of this.keys()) {
            const lhs = this[flag_name].valueOf();
            const rhs = other[flag_name].valueOf();
            if (lhs !== rhs) {
                diff.push([flag_name, lhs]);
            }
        }

        return diff;
    } 
    
    /**
     * Sets the specified flag.
     * 
     * @param {string} flagName 
     * A string representing a name of the flag to set.
     * 
     * @returns {this}
     * The target flagset.
     */
    set(flagName) {
        const flag_name = flagName;
        if (typeof flag_name !== "string") { return this; }

        const flag = this[flag_name];

        return (flag instanceof Flag) ?
            flag.set() :
            this
        ;
    }

    /**
     * Unsets the specified flag.
     * 
     * @param {string} flagName 
     * A string representing a name of the flag to unset.
     * 
     * @returns {this}
     * The target flagset.
     */
    unset(flagName) {
        const flag_name = flagName;
        if (typeof flag_name !== "string") { return this; }

        const flag = this[flag_name];

        return (flag instanceof Flag) ?
            flag.unset() :
            this
        ;
    }

    /**
     * Toggles the specified flag.
     * 
     * @param {string} flagName 
     * A string representing a name of the flag to toggle.
     * 
     * @returns {this}
     * The target flagset.
     */
    toggle(flagName) {
        const flag_name = flagName;
        if (typeof flag_name !== "string") { return this; }

        const flag = this[flag_name];

        return (flag instanceof Flag) ?
            flag.toggle() :
            this
        ;
    }

    /**
     * Clears all flags.
     */
    clear() {
        for (const flag of this.values()) {
            flag.unset();
        }

        return this;
    }

    /**
     * Applies the given callback for each flags in the target set.
     * 
     * @param {(flag: Flag, flagName: string, flagset: FlagSet) => void} callback
     * A callback function to apply to the flags.
     * 
     * @param {any} thisArg 
     * A this argument used for the callback.
     */
    forEach(callback, thisArg) {
        for (const [flag_name, flag] of this) {
            callback.call(thisArg, flag, flag_name, this);
        }
    }

    /**
     * Creates an iterator for the target set.
     * 
     * This is equivalent to the {@link entries() | `entries()`} function.
     * 
     * @returns {IterableIterator<[string, Flag]>}
     */
    *[Symbol.iterator]() {
        yield* this.entries();
    }

    /**
     * Creates an iterable of the flags in the target set.
     * 
     * @returns {IterableIterator<string>}
     */
    *keys() {
        for (const flag_name in this) {
            if (!Object.hasOwn(this, flag_name)) { continue; }

            yield flag_name;
        }
    }

    /**
     * Creates an iterable of the flags in the target set.
     * 
     * @returns {IterableIterator<Flag>}
     */
    *values() {
        for (const flag_name of this.keys()) {
            yield this[flag_name];
        }
    }

    /**
     * Creates an iterable of the key-value pairs in the target set.
     * 
     * @returns {IterableIterator<[string, Flag]>}
     */
    *entries() {
        for (const flag_name of this.keys()) {
            yield [ flag_name, this[flag_name] ];
        }
    }
}

export { FlagSet };
