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

import { FlagSet } from "./FlagSet.js";
import getPropertyDescriptor from "./GetPropertyDescriptor.js";
import isEquivalent from "./isEquivalent.js";
import { TaskQueue } from "./TaskQueue.js";
import { html, render, listener } from "./Render.js";

/**
 * @typedef {object} CustomElementPropertyDescriptor
 * An object describing the corresponding property.
 * 
 * @property {string} name
 * The property name.
 * 
 * @property {any?} default
 * The default value of the property.
 * 
 * @property {boolean} noSync
 * A boolean indicatting whether or not the property is synchronized
 * with the corresponding attribute whenever the property being changed.
 * 
 * By default, this property is set to `false`.
 * 
 * @property {boolean} boolean
 * A boolean indicating whether or not the property is used as a flag.
 * 
 * By default, this property is set to `false`.
 * 
 * @property {string} attribute
 * A string representing the name of the attribute corresponding to
 * the property.
 * 
 * By default, this is set to the lowercased property name,
 * or for the property name starting with `aria` followed by
 * an uppercase letter (i.e. the property name matches `/^aria[A-Z]/`).
 * set to the corresponding WAI-ARIA attribute name.
 * 
 * @property {((
 *      target: AlierCustomElement,
 *      value : any
 * ) => boolean)?} validate
 * A function to be invoked when the corresponding property is modified.
 * 
 * @property {((
 *      target  : AlierCustomElement,
 *      oldValue: any,
 *      newValue: any
 * ) => void)?} onChange
 * A function to be invoked after modification of the corresponding
 * property is applied.
 * 
 * @property {(attribute: string?) => any} asProp
 * A function to be invoked when the attribute corresponinding to
 * the property is modified.
 * 
 * The function is used as an attribute-to-property value conversion
 * function. i.e., it is passed the attribute's value as an argument
 * and it returns the new value of the corresponding property.
 * 
 * By default, the attribute's value is used as-is.
 * 
 * @property {(property: any) => string} asAttr
 * A function to be invoked when the corresponding property is modified.
 * If a validator is defined for the property, this function is called
 * only when the validator confirms the given value is valid.
 * 
 * The function is used as an attribute-to-property value conversion
 * function. i.e., it is passed the property's value as an argument
 * and it returns the new value of the corresponding attribute.
 * 
 * By default, the property's value is just converted to a string.
 */

/**
 * @typedef {({
 *  [propertyName: string]: CustomElementPropertyDescriptor
 * })} CustomElementPropertyDescriptors
 * A set of `CustomElementPropertyDescriptor`s.
 */

/**
 * @typedef {({
 *  [attributeName: string]: CustomElementPropertyDescriptor
 * })} AttributePropertyDescriptorMap
 * An object mapping an attribute name to the associated
 * property descriptor.
 */

/**
 * @typedef {object} StateDescriptor
 * @property {({
 *      [eventName: string]: (
 *           (flagset: FlagSet, ...args: any) => FlagSet
 *      )
 * })} events
 * 
 * @property {boolean} init
 */

/**
 * @typedef {({
 *  [stateName: string]: StateDescriptor
 * })} StateDescriptors
 */

/**
 * @typedef {object} CustomElementDefinition
 * 
 * @property {CustomElementPropertyDescriptors} propertyDescriptors
 * A set of `CustomElementPropertyDescriptor`s.
 * 
 * @property {boolean} formAssociated
 * A boolean indicating whether or not the custom element class is
 * form-associated.
 * 
 * @property {ShadowRootInit} attachShadowOptions
 * An object used as options for `attachShadow()`.
 * 
 * @property {StateDescriptors?} states
 * 
 * @property {CSSStyleSheet[]?} styles
 */

/**
 * Copies the given object.
 * 
 * @param {any} o 
 * A value to copy.
 * 
 * @param {WeakMap<object, object>} refs 
 * A WeakMap used to detect circular references.
 * 
 * @returns {typeof o}
 * A copy object.
 */
const copy = (o, refs = new WeakMap()) => {
    if (o === null || typeof o !== "object") { return o; }

    //  Test whether or not to occur a circular reference.
    const ref = refs.get(o);
    if (ref != null) { return ref; }

    //  Copy as an array if it is an array.
    const o_ = Array.isArray(o) ? [ ...o ] : { ...o };

    //  Add a reference to the WeakMap.
    refs.set(o, o_);

    //  Object.keys() also works against arrays.
    for (const k of Object.keys(o_)) {
        const v = o_[k];
        //  Make a copy of the value if it is a non-null object.
        if (v !== null && typeof v === "object") {
            o_[k] = copy(v, refs);
        }
    }

    return o_;
};

/**
 * Convert property name to attribute name
 *
 * @param {string} propertyName
 * Property name to convert.
 * @returns {string}
 * A string converted to match the attribute name.
 */
const propertyToAttribute = (propertyName) => {
    return (
        /^aria[A-Z]/.test(propertyName) ?
            `aria-${propertyName.slice(4).toLowerCase()}` :
        /^acceptcharset$/i.test(propertyName) ?
            "accept-charset" :
            propertyName.toLowerCase()
    );
};

/**
 * A private key for accessing the target custom element's
 * `ElementInternals` interface.
 */
const _elementInternalsKey = Symbol("elementInternals");

/**
 * A private key for accessing the target custom element's
 * `ShadowRoot` interface.
 */
const _shadowRootKey       = Symbol("shadowRoot");

/**
 * A private key for accesing the target custom element's
 * properties.
 */
const _valuesKey          = Symbol("values");

/**
 * A private key for accesing the target custom element's
 * proxy.
 */
const _proxyKey          = Symbol("proxy");

class DataReference {

    /**
     * @constructor
     * Creates an object observing modification of the specific property
     * or attribute of both the host element and the target elements.
     * 
     * @param {AlierCustomElement} host 
     * The host element.
     * 
     * @param {string} name 
     * The label for the data.
     */
    constructor(host, name) {
        const host_ = host;
        const name_ = name;
        if (!(host_ instanceof AlierCustomElement)) {
            throw new TypeError("'host' is not an AlierCustomElement");
        } else if (typeof name_ !== "string") {
            throw new TypeError("'name' is not a string");
        }

        this.#host = host_;
        this.#name = name_;
    }

    /**
     * The label for the data.
     * @type {string}
     */
    get name() { return this.#name; }

    /**
     * Gets the value of the corresponding property.
     * 
     * @returns
     * The value of the corresponding property of the host element.
     */
    get() {
        return this.#host[this.#name];
    }

    /**
     * Observes the given element's property.
     * 
     * The target `DataReference` get to update the correspoinding
     * host's property when observing the target element's update.
     * 
     * To stop to observe the target element, use {@link unobserveProperty}.
     *  
     * @param {Element} targetElement 
     * An element to observe.
     * 
     * @param {string} propertyName
     * A string representing the name of the property to observe.
     * 
     * @returns {this}
     * The target `DataReference`.
     */
    observeProperty(targetElement, propertyName) {
        const target        = targetElement;
        const name          = propertyName;

        let   callbacks_map = DataReference.#prop_callbacks_map_set.get(target);

        if (!(target instanceof Element)) {
            throw new TypeError("'targetElement' is not an Element");
        } else if (typeof name !== "string") {
            throw new TypeError("'propertyName' is not a string");
        } else if (callbacks_map != null && callbacks_map.has(name)) {
            return this;
        }

        const host     = this.#host;
        const ref_name = this.#name;

        const desc = getPropertyDescriptor(target, name);

        let get;
        let set;
        let orig_get;
        let orig_set;
        if (desc != null && !("value" in desc)) {
            orig_get = desc.get;
            orig_set = desc.set;
            get = function() {
                return orig_get?.call(this);
            };
            set = function(value) {
                const old_value = this[name];
                if (isEquivalent(old_value, value)) {
                    return;
                }

                orig_set?.call(this, value);
                const new_value = this[name];

                if (!isEquivalent(old_value, new_value)) {
                    host[ref_name] = new_value;         
                }
            };
            Object.defineProperty(target, name, {
                configurable: true,
                enumerable  : false,
                get,
                set
            });
        } else {
            let curr_value = desc?.value;
            get = function() {
                return this === target ? curr_value : undefined;
            };
            set = function(value) {
                if (this === target) {
                    if (isEquivalent(curr_value, value)) {
                        return;
                    }

                    curr_value = value;
                    host[ref_name] = value;
                }
            };
            Object.defineProperty(target, name, {
                configurable: true,
                enumerable  : false,
                get,
                set
            });
        }

        let prev_value;
        /** @type { (ev: InputEvent) => void } */
        const input = ev => {
            const target = ev.currentTarget;
            const value  = target[name];
            if (!isEquivalent(value, prev_value)) {
                host[ref_name] = value;
                prev_value = value;
            }
        };

        //  Set callbacks to the callback map associated with the target element.
        const callbacks = { input, get, set, orig_get, orig_set };
        if (callbacks_map == null) {
            callbacks_map = new Map();
            DataReference.#prop_callbacks_map_set.set(target, callbacks_map);
        }
        callbacks_map.set(name, callbacks);

        //  Add an input event listener to the target element.
        target.addEventListener("input", input, { passive: true });

        return this;
    }

    /**
     * Unobserves the given element's property.
     * 
     * @param {Element} targetElement 
     * An element to unobserve.
     * 
     * @param {string} propertyName 
     * A string representing the name of the property to unobserve.
     * 
     * @returns {this}
     * The target `DataReference`.
     */
    unobserveProperty(targetElement, propertyName) {
        const target        = targetElement;
        const name          = propertyName;
        const callbacks_map = DataReference.#prop_callbacks_map_set.get(target);
        const callbacks     = callbacks_map?.get(name);

        //  Do nothing if the given arguments do not match the required types or
        //  the given pair of the target element and the property has already been observed
        //  by the target DataReference.
        if (!(target instanceof Element)) {
            return this;
        } else if (typeof name !== "string") {
            return this;
        } else if (callbacks == null) {
            return this;
        }

        const { input, get, set } = callbacks;

        //  Remove event listeners.
        target.removeEventListener("input", input);

        //  Remove getter / setter used for observing updates.
        const desc = Object.getOwnPropertyDescriptor(target, name);
        if (desc != null) {
            if (desc.get === get || desc.set === set) {
                if (desc.orig_get != null || desc.orig_set != null) {
                    const last_value = target[name];
                    delete target[name];
                    target[name] = last_value;
                } else {
                    delete target[name];
                }
            }
        }

        return this;
    }

    /**
     * Observes the given element's attribute.
     * 
     * The target `DataReference` get to update the correspoinding
     * host's attribute when observing the target element's update.
     * 
     * To stop to observe the target element, use {@link unobserveAttribute}.
     *  
     * @param {Element} targetElement 
     * An element to observe.
     * 
     * @param {string} attributeName 
     * A string representing the name of the attribute to observe.
     * 
     * @returns {this}
     * The target `DataReference`.
     */
    observeAttribute(targetElement, attributeName) {
        const attr_ref_map_set = DataReference.#attr_ref_map_set;
        const target           = targetElement;
        const name             = attributeName;

        let   attr_ref_map     = attr_ref_map_set.get(target);

        if (!(target instanceof Element)) {
            throw new TypeError("'targetElement' is not an Element");
        } else if (typeof name !== "string") {
            throw new TypeError("'attributeName' is not a string");
        } else if (attr_ref_map?.get(name) === this) {
            return this;
        }

        if (attr_ref_map == null) {
            attr_ref_map = new Map();
            attr_ref_map_set.set(target, attr_ref_map);
        }

        attr_ref_map.set(name, this);

        DataReference.#mutation_observer.observe(target, {
            attributeFilter: [ ...attr_ref_map.keys() ]
        });

        return this;
    }

    /**
     * Unobserves the given element's attribute.
     * 
     * @param {Element} targetElement 
     * An element to unobserve.
     * 
     * @param {string} attributeName 
     * A string representing the name of the attribute to unobserve.
     * 
     * @returns {this}
     * The target `DataReference`.
     */
    unobserveAttribute(targetElement, attributeName) {
        const target       = targetElement;
        const name         = attributeName;
        const attr_ref_map = DataReference.#attr_ref_map_set.get(target);
        const ref          = attr_ref_map?.get(name);

        //  Do nothing if the given arguments do not match the required types or
        //  the given pair of the target element and the attribute has already been observed
        //  by the target DataReference.
        if (!(target instanceof Element)) {
            return this;
        } else if (typeof name !== "string") {
            return this;
        } else if (ref !== this) {
            return this;
        }

        attr_ref_map?.delete(name);

        const mutation_observer = DataReference.#mutation_observer;
        mutation_observer.observe(target, {
            attributeFilter: [ ...attr_ref_map.keys() ]
        });

        //  Schedule refreshObserver
        queueMicrotask(() => {
            //  Refresh the MutationObserver if the number of the observed targets
            //  can be reduced to a half or less.
            DataReference.#refreshObserver(0.5);
        });

        return this;
    }

    /**
     * Refreshes the `MutationObserver`.
     * 
     * @param {number} threshold 
     * A number in 0.0 to 1.0 representing the threshold to refresh
     * the `MutationObserver`.
     * 
     * If the ratio of the population of effectively unobserved elements
     * to the population of the observed elements reaches at
     * the threshold, then remove the effectively unobserved elements
     * from observed elements.
     */
    static #refreshObserver(threshold) {
        const threshold_ =  !Number.isFinite(threshold) ?
                //  Apply the default threshold
                0.5 :
                //  Clamp the given threshold between 0.0 and 1.0
                Math.max(0.0, Math.min(threshold, 1.0))
        ;

        const attr_ref_map_set = DataReference.#attr_ref_map_set;
        const mo_target_wrefs  = DataReference.#mo_target_wrefs;
        /** @type {[Element, string[]][]} */
        const target_filter_pairs   = [];

        let unobserved_count = 0;
        for (const observed_target_wref of mo_target_wrefs) {
            const observed_target = observed_target_wref.deref();
            //  Update the weak ref set if the target has already been GCed.
            if (observed_target == null) {
                mo_target_wrefs.delete(observed_target_wref);
                continue;
            }

            const attr_ref_map = attr_ref_map_set.get(observed_target);
            if (attr_ref_map == null || attr_ref_map.size <= 0) {
                unobserved_count++;
                continue;
            }
            target_filter_pairs.push([ observed_target, [ ...attr_ref_map.keys() ] ]);
        }

        const observed_count = mo_target_wrefs.size;
        //  Refresh the MutationObserver if the unobserved count reaches the threshold.
        if (Math.trunc(observed_count * threshold_) <= unobserved_count) {
            const mutation_observer = DataReference.#mutation_observer;
            const mutation_callback = DataReference.#mutation_callback;

            //  takeRecords() must be done before invoking disconnect()
            //  because disconnect() cleans the mutation records up.
            const records = mutation_observer.takeRecords();

            //  Disconnect the mutation observer.
            //  Because MutationObserver does not implement `unobserve` method,
            //  we need to disconnect and then observe again.
            mutation_observer.disconnect();

            if (records.length > 0) {
                mutation_callback(records);
            }

            for (const [ observed_target, filter ] of target_filter_pairs.values()) {
                mutation_observer.observe(observed_target, { attributeFilter: filter });
            }
        }
    }

    /** @type {AlierCustomElement} */
    #host;

    /** @type {string} */
    #name;

    /** @type {MutationCallback} */
    static #mutation_callback = records => {
        const target_reference_map = DataReference.#attr_ref_map_set;
        for (const record of records) {
            const {
                attributeName     : name,
                attributeNamespace: namespace,
                target
            } = record;

            if (name == null) { continue; }
            if (namespace != null) { continue; }

            const ref = target_reference_map.get(target)?.get(name);
            if (ref == null) { continue; }

            const host = ref.#host;
            const ref_name = ref.#name;
            const new_value = target.getAttribute(name);
            if (new_value != null) {
                host.setAttribute(ref_name, new_value);
            } else {
                host.removeAttribute(ref_name);
            }
        }
    };

    /**
     * @template T
     * @typedef PropertyCallbacks
     * @property {(ev: InputEvent) => void} input 
     * @property {() => T} get
     * @property {(value: T) => void} set
     * @property {(() => T) | undefined} orig_get
     * @property {((value: T) => void) | undefined} orig_set
     */
    /**
     * @type {WeakMap<Element, Map<string, PropertyCallbacks<any>>>}
     */
    static #prop_callbacks_map_set = new WeakMap();

    /**
     * A `WeakMap` mapping target elements to a `Map` mapping 
     * attribute names to `DataReference`s.
     * 
     * @type {WeakMap<Element, Map<string, DataReference>>}
     */
    static #attr_ref_map_set = new WeakMap();

    /**
     * `MutationObserver` used for observing mutations of observed elements.
     * 
     * @type {MutationObserver}
     */
    static #mutation_observer = new MutationObserver(this.#mutation_callback);

    /**
     * A set of `WeakRef`s of target elements observed by the 
     * `MutationObserver`.
     * @type {Set<WeakRef<Element>>}
     * */
    static #mo_target_wrefs = new Set();
}

class CustomElementProxy {
    constructor(host) {
        if (!(host instanceof AlierCustomElement)) {
            throw new TypeError("'host' is not an AlierCustomElement");
        }

        for (let proto = host;
            proto != AlierCustomElement.prototype;
            proto = Object.getPrototypeOf(proto)
        ) {
            const descriptors = Object.getOwnPropertyDescriptors(proto);
            for (const k of Object.keys(descriptors)) {
                const descriptor = descriptors[k];
                if (
                    typeof descriptor.get === "function" ||
                    typeof descriptor.set === "function" ||
                    (
                        ("value" in descriptor) &&
                        typeof descriptor.value !== "function"
                    )
                ) {
                    Object.defineProperty(this, k, {
                        configurable: true,
                        enumerable  : true,
                        writable    : false,
                        value       : new DataReference(host, k)
                    });
                }
            }
        }
    }
}

class StateMap {
    /**
     * 
     * @param {AlierCustomElement} target 
     * @param {ElementInternals} internals 
     * @param {StateDescriptors} states 
     */
    constructor(target, internals, states) {
        if (!(target instanceof AlierCustomElement)) {
            throw new TypeError("'target' is not an AlierCustomElement");
        }
        const init_states = Object.fromEntries(Object.entries(states)
            .map(([k, v]) => [k, v.init])
        );
        const flagset = new FlagSet(init_states);
        const prev_flagset = new FlagSet(init_states);

        for (const [ state_name, flag ] of flagset) {
            const events = states[state_name].events;
            if (flag.valueOf()) {
                internals.states.add(state_name);
            }
            /**
             * @type {({
             *  [event_name: string]: (...args) => void
             * })}
             */
            const state = {};
            for (const event_name of Object.keys(events)) {
                const event = events[event_name];
                state[event_name] = function (...args) {
                    event(flagset, ...args);

                    const diff = flagset.difference(prev_flagset);
                    if (diff.length > 0) {
                        const changed_states = Object.fromEntries(diff);
                        for (const [flag_name, current_state] of diff) {
                            prev_flagset[flag_name].toggle();
                            if (current_state) {
                                internals.states.add(flag_name);
                            } else {
                                internals.states.delete(flag_name);
                            }
                        }
                        target.dispatchStateChange(changed_states);
                    }
                };
            }

            Object.defineProperty(this, state_name, {
                configurable: false,
                enumerable  : true,
                writable    : false,
                value       : state
            });
        }

        Object.preventExtensions(this);
    }

    *[Symbol.iterator]() {
        yield* this.entries();
    }

    *keys() {
        for (const state_name in this) {
            if (!Object.hasOwn(this, state_name)) { continue; }
            yield state_name;
        }
    }

    *values() {
        for (const state_name of this.keys()) {
            yield this[state_name];
        }
    }

    *entries() {
        for (const state_name of this.keys()) {
            yield [ state_name, this[state_name] ];
        }
    }
}

/**
 * @class
 * 
 * Base class for all custom HTML elements provided by the Alier framework.
 * 
 * This class is a derivative of {@link HTMLElement}.
 * So any restrictions or behavioural properties can be applied this class.
 * 
 * As with `HTMLElement`, direct invocation of the constructor is not allowed.
 * To create an instance, you should register a constructor in 
 * {@link https://developer.mozilla.org/docs/Web/API/CustomElementRegistry/define | CustomElementRegistry}
 * before instantiation and instantiate via an appropriate DOM API such as 
 * {@link https://developer.mozilla.org/docs/Web/API/Document/createElement | document.createElement}.
 */
class AlierCustomElement extends HTMLElement {
    /**
     * A string representing an object's class name.
     * 
     * This function is invoked via `Object.prototype.toString()`.
     */
    get [Symbol.toStringTag]() { return this.constructor.name; }

    /**
     * A list of attributes to observe changes.
     * 
     * `attributeChangedCallback()` will be invoked only if the modified
     * attribute is listed here.
     * 
     * You can add attributes to the list by defining the static
     * property `propertyDescriptor` in your class.
     * 
     * In addition, if the class is form-associated, i.e. it has the
     * static property `formAssociated` and its value is `true`,
     * the `form` attribute is implicitly added to the list to observe. 
     */
    static get observedAttributes() {
        const definition = AlierCustomElement.#getDefinition(this);
        if (definition == null) {
            // This won't happen during evaluating `use()` because `#saveDefinition()`
            // is always invoked before registering the target custom element class.
            return [];
        }
        const {
            formAssociated: form_associated,
            propertyDescriptors: property_descs,
        } = definition;

        const attributes =
            Object.values(property_descs).map(({ attribute }) => attribute);

        if (form_associated) {
            attributes.push("form");
        }

        return attributes;
    }

    /**
     * Is invoked when an attribute listed in the `observedAttributes`
     * is changed.
     * 
     * @param {string} name 
     * A string representing a name of the attribute being changed.
     * 
     * @param {string?} oldValue 
     * An optional string representing the previous value of
     * the modified attribute.
     * 
     * This parameter is set to `null` if the attribute is previously
     * not set.
     * 
     * @param {string?} newValue 
     * An optional string representing the current value of
     * the modified attribute.
     * 
     * This parameter is set to `null` when the attribute is removed.
     * 
     * @param {string?} namespace 
     * An optional string representing a namespace of the attribute.
     */
    attributeChangedCallback(name, oldValue, newValue, namespace) {
        if (namespace != null) {
            //  namespaced attribute is not supported.
            return;
        }
        const prop = this.#attrPropMap[name];
        if (prop == null) { return; }

        this.initialize(); // this will be evaluated at most once.

        const as_prop    = prop.asProp;
        const no_sync    = prop.noSync;
        const old_attr_v = oldValue;
        const new_attr_v = newValue;

        if (!no_sync) {
            const prop_name  = prop.name;
            const on_change  = prop.onChange;
            const old_prop_v = this[prop_name];
            let new_prop_v;

            if (new_attr_v != null) {
                try {
                    new_prop_v = as_prop(new_attr_v);
                } catch (e) {
                    console.error(`<${this.tagName}>: Failed to set the property corresponding to the attribute "${name}"`, e);
                    if (old_attr_v != null) {
                        console.info(`<${this.tagName}>: restored the attribute "${name}" value to "${old_attr_v}"`);
                        this.setAttribute(name, old_attr_v);
                    } else {
                        console.info(`<${this.tagName}>: restored the attribute "${name}" value to null`);
                        this.removeAttribute(name);
                    }
                    //  A thrown error cannot be caught by application codes,
                    //  hence it will not be rethrown.
                    return;
                }

                this[prop_name] = new_prop_v;
            } else {
                /**
                 * @type {Map<string, any>}
                 */
                const values = this[_valuesKey];
                new_prop_v = prop.default;

                // Bypass accessor to prevent setting attribute to default value
                values.set(prop_name, new_prop_v);
            }

            if (on_change != null) {
                try {
                    on_change(this, old_prop_v, new_prop_v);
                } catch (e) {
                    console.error(`<${this.tagName}>: Error occurred to call onChange for attribute ${name}`, e);
                }
            }
        }

        this.#update();
    }

    connectedCallback() {
        if (!this.isConnected) { return; }

        this.initialize(); // this will be evaluated at most once.
        this.#update();
    }

    constructor() {
        super();
        const definition = AlierCustomElement.#getDefinition(new.target);
        if (definition == null) {
            throw new TypeError("Illegal constructor");
        }

        const {
            formAssociated     : form_associated,
            attachShadowOptions: attach_shadow_options,
            propertyDescriptors: property_descriptors,
            states,
            styles
        } = definition;

        const attr_prop_map = Object.fromEntries(
            Object.values(property_descriptors).map(prop => [prop.attribute, prop])
        );

        const internals = (states != null || form_associated) ?
            this.attachInternals() :
            null
        ;

        let states_ = null;
        if (states != null) {
            states_ = new StateMap(this, internals, states);
        }

        const shadow_root = this.attachShadow(attach_shadow_options);
        if (styles != null) {
            shadow_root.adoptedStyleSheets.push(...styles);
        }

        this[_elementInternalsKey] = internals;
        this[_shadowRootKey]       = shadow_root;
        this.#attrPropMap          = attr_prop_map;
        this.#states               = states_;
        this[_proxyKey]            = new CustomElementProxy(this);
    }

    get states() {
        return this.#states;
    }

    
    /**
     * Renders the content under the shadow root.
     * 
     * This function is invoked when the host element is connected
     * to a document.
     * 
     * @param {CustomElementProxy} it 
     * A proxy object providing `DataReference` objects.
     * 
     * @returns {({
     *      strings: string[],
     *      values: any[]
     * })?}
     */
    // eslint-disable-next-line no-unused-vars
    render(it) {}

    /**
     * Initializes the target custom element.
     * 
     * This function will be invoked when {@link initialize()} function
     * is invoked.
     * 
     * @param {ShadowRoot} shadowRoot 
     * A shadow root of the target element.
     * 
     * @param {ElementInternals?} internals 
     * An interface allowing the target element to participate in
     * HTML forms.
     * 
     * The `ElementInternal` object is given only for a form-associated
     * element. For non form-associated elements, `null` is given instead.
     */
    // eslint-disable-next-line no-unused-vars
    onInitialize(shadowRoot, internals) {}

    /**
     * Initializes the target custom element.
     * 
     * This function invokes {@link onInitialize()} function if
     * the target custom element has not been initialized yet.
     * 
     * This function is automatically called when the following cases:
     * -    the element connected to a document ({@link connectedCallback()})
     * -    the element's attribute is modified ({@link attributeChangedCallback()})
     */
    initialize() {
        if (!this.#initialized) {
            this.onInitialize(this[_shadowRootKey], this[_elementInternalsKey]);
            this.#initialized = true;
        }
    }

    /**
     * Dispatches a `statechange` event to the target element. 
     * 
     * @param {({
     *  [stateName: string]: boolean
     * })} changedStates 
     * An object representing a set of changed states.
     */
    dispatchStateChange(changedStates) {
        if (changedStates === null || typeof changedStates !== "object") {
            throw new TypeError("'changedStates' is not a non-null object");
        }

        const event = new CustomEvent("statechange", { detail: { changedStates } });

        return this.dispatchEvent(event);
    }

    /**
     * Prepares to use the target class,
     * 
     * More precisely, this function registers the target class
     * to the global custom element registry, `customElements`
     * if the class is not registered yet.
     * 
     * This function requires the followings:
     * 
     * - the target class has the static property `tagName`
     * - the `tagName` is a valid tag name
     * - the target class is registered as a custom element whose name
     *   is the same as `tagName`
     * 
     * @throws {TypeError}
     * If the static property `tagName` is not a string.
     * 
     * @throws {DOMException}
     * 
     * In either of the following cases:
     * 
     * - `NotSupportedError`:
     *   The tag name has already been used for a different custom
     *   element class.
     * - `SyntaxError`:
     *   The tag name is not a valid custom element name.
     */
    static use() {
        const tag_name = this.tagName;
        if (typeof tag_name !== "string") {
            throw new TypeError(`${this.name}.use: tagName is not a string`);
        }
        
        const registered = customElements.get(tag_name);
        if (registered === this) {
            //  already registered
            return;
        } else if (registered != null) {
            //  tag name is already used by another class.
            throw new DOMException(`${this.name}.use: tag name <${tag_name}> has already been used for a different custom element class`, "NotSupportedError");
        }

        AlierCustomElement.#saveDefinition(this);
        AlierCustomElement.#addAccessors(this);

        customElements.define(tag_name, this);
    }

    #update() {
        const tagged_html = this.render(this[_proxyKey]);
        if (tagged_html != null) {
            render(tagged_html, this[_shadowRootKey]);
        }
    }

    /**
     * @param {typeof AlierCustomElement} ctor 
     */
    static #addAccessors(ctor) {
        const definition = AlierCustomElement.#getDefinition(ctor);
        const properties = definition?.propertyDescriptors;
        if (properties != null) {
            const proto = ctor.prototype;
            for (const k of Object.keys(properties)) {
                const prop      = properties[k];
                const default_  = prop.default;
                const attribute = prop.attribute;
                const no_sync   = prop.noSync;
                const boolean_  = prop.boolean;
                const as_attr   = prop.asAttr;
                const validate  = prop.validate;

                const existing_prop = Object.getOwnPropertyDescriptor(proto, k);
                if (existing_prop != null) {
                    console.warn(
                        `${ctor.name} (<${ctor.tagName}>): property "${k}" has already been defined. The existing property is overwritten.`,
                        existing_prop
                    );
                }

                const get = function() {
                    /** @type {Map<string, any>} */
                    const values = this[_valuesKey];
                    return values.get(k) ?? (values.set(k, default_), default_);
                };
                /** @type {WeakSet<AlierCustomElement>} */
                const mutated_instances = new WeakSet();
                const set = function(v) {
                    const new_prop_v = boolean_ ? (v != null ? !!v : false) : v;
                    /**
                     * @type {Map<string, any>}
                     */
                    const values = this[_valuesKey];

                    //  Tests whether or not the property is modified.
                    const old_prop_v = this[k];
                    if (isEquivalent(old_prop_v, new_prop_v)) { return; }

                    //  Validates the new value if a validator is given.
                    if (validate != null && !validate(this, new_prop_v)) { return; }

                    //  Updates the property.
                    values.set(k, new_prop_v);

                    if (!no_sync && !mutated_instances.has(this)) {
                        mutated_instances.add(this);
                        //  Reflect the update to the attribute.
                        if (boolean_) {
                            AlierCustomElement.#taskQueue.add(() => {
                                mutated_instances.delete(this);

                                const current_prop_v = this[k];
                                const has = this.hasAttribute(attribute);
                                if (has && !current_prop_v) {
                                    this.removeAttribute(attribute);
                                } else if (!has && current_prop_v) {
                                    this.setAttribute(attribute, "");
                                }
                            }, TaskQueue.Priority.NORMAL);
                        } else {
                            AlierCustomElement.#taskQueue.add(() => {
                                mutated_instances.delete(this);

                                const current_prop_v = this[k];
                                const new_attr_v =
                                    current_prop_v != null ? as_attr(current_prop_v) : null;

                                if (new_attr_v != null) {
                                    const old_attr_v = this.getAttribute(attribute);
                                    if (old_attr_v !== new_attr_v) {
                                        this.setAttribute(attribute, new_attr_v);
                                    }
                                } else if (this.hasAttribute(attribute)) {
                                    this.removeAttribute(attribute);
                                }
                            }, TaskQueue.Priority.NORMAL);
                        }
                    }

                    this.#update();
                };

                Object.defineProperty(proto, k, {
                    configurable: true,
                    enumerable  : false,
                    get,
                    set
                });
            }
        }

        AlierCustomElement.#addFormAssociatedFeaturesIfNeeded(ctor);
    }

    /**
     * @param {typeof AlierCustomElement} ctor 
     */
    static #addFormAssociatedFeaturesIfNeeded(ctor) {
        const definition = AlierCustomElement.#getDefinition(ctor);
        const form_associated = definition?.formAssociated;
        if (form_associated !== true) {
            //  the target class is not form-associated.
            return;
        }

        const proto = ctor.prototype;

        const form_props = {
            form: {
                configurable: true,
                enumerable  : false,
                get() {
                    /** @type {ElementInternals} */
                    const internals = this[_elementInternalsKey];
                    return internals.form;
                }
            },
            validationMessage: {
                configurable: true,
                enumerable  : false,
                get() {
                    /** @type {ElementInternals} */
                    const internals = this[_elementInternalsKey];
                    return internals.validationMessage;
                }
            },
            validity: {
                configurable: true,
                enumerable  : false,
                get() {
                    /** @type {ElementInternals} */
                    const internals = this[_elementInternalsKey];
                    return internals.validity;
                }
            },
            willValidate: {
                configurable: true,
                enumerable  : false,
                get() {
                    /** @type {ElementInternals} */
                    const internals = this[_elementInternalsKey];
                    return internals.willValidate;
                }
            },
            checkValidity: {
                configurable: true,
                enumerable  : false,
                writable    : true,
                value: function checkValidity() {
                    /** @type {ElementInternals} */
                    const internals = this[_elementInternalsKey];
                    return internals.checkValidity();
                }
            },
            reportValidity: {
                configurable: true,
                enumerable  : false,
                writable    : true,
                value: function reportValidity() {
                    /** @type {ElementInternals} */
                    const internals = this[_elementInternalsKey];
                    return internals.reportValidity();
                }
            },
            setCustomValidity: {
                configurable: true,
                enumerable  : false,
                writable    : true,
                value: function setCustomValidity(message) {
                    /** @type {ElementInternals} */
                    const internals = this[_elementInternalsKey];
                    return message !== "" ?
                        internals.setValidity({ customError: true }, message) :
                        internals.setValidity({})
                    ;
                }
            },
        };

        for (const k of Object.keys(form_props)) {
            const existing_prop = Object.getOwnPropertyDescriptor(proto, k);
            if (existing_prop) {
                console.warn(
                    `${ctor.name} (<${ctor.tagName}>): property "${k}" has already been defined. The existing property is overwritten.`,
                    existing_prop
                );
            }
        }

        Object.defineProperties(proto, form_props);
    }

    /**
     * Saves the definition of the given custom element class.
     * 
     * @param {typeof AlierCustomElement} ctor 
     * The custom element constructor.
     */
    static #saveDefinition(ctor) {
        const form_associated       = ctor.formAssociated === true;
        const attach_shadow_options = copy(ctor.attachShadowOptions ?? {});
        const external_styles_url   = Array.isArray(ctor.externalStyles) ?
            copy(ctor.externalStyles) :
            null
        ; 
        const styles_text           = typeof ctor.styles === "string" ?
            ctor.styles :
            null
        ;

        let styles = null;
        if (external_styles_url != null) {
            styles = external_styles_url
                .filter(url => (typeof url === "string" && url.length > 0))
                .map(url => {
                    const sheet   = new CSSStyleSheet();
                    const promise = Alier.Sys.loadText(url);

                    promise.then(rules => {
                        return sheet.replace(rules);
                    }, error => {
                        const index = styles.indexOf(sheet);
                        if (index >= 0) {
                            styles.splice(index, 1);
                        }
                        console.error(`${ctor.name}: Error occurred during loading "${url}"`, error);
                    });

                    return sheet;
                })
            ;
        }
        if (styles_text != null) {
            if (styles == null) {
                styles = [];
            }
            const sheet = new CSSStyleSheet();
            styles.push(sheet);

            sheet.replaceSync(styles_text);
        }

        if (attach_shadow_options?.mode == null) {
            attach_shadow_options.mode = "closed";
        }

        const property_descriptors = copy(ctor.propertyDescriptors ?? {});
        for (const k of Object.keys(property_descriptors)) {
            const prop = property_descriptors[k];

            prop.name     = k;
            prop.boolean  = prop.boolean === true;
            prop.noSync   = prop.noSync === true;
            prop.asAttr   = typeof prop.asAttr === "function" ?
                prop.asAttr : prop.boolean ?
                (x => x ? "" : null) :
                (x => x != null ? String(x) : null)
            ;
            prop.validate = typeof prop.validate === "function" ?
                prop.validate :
                null
            ;
            prop.onChange = typeof prop.onChange === "function" ?
                prop.onChange :
                null
            ;
            prop.asProp   = typeof prop.asProp === "function" ?
                prop.asProp : prop.boolean ?
                (x => x != null) :
                (x => x)
            ;
            if (prop.attribute == null) {
                prop.attribute = propertyToAttribute(k);
            }
            if (prop.boolean) {
                prop.default = false;
            }
        }

        /**
         * @type {StateDescriptors?}
         */
        let states = ctor.states;
        if (states != null) {
            states = copy(states);
            for (const k of Object.keys(states)) {
                const state  = states[k];
                state.init = state.init === true;

                const events = state.events;
                for (const event_name of Object.keys(events)) {
                    const event = events[event_name];
                    if (typeof event !== "function") {
                        delete events[event_name];
                        continue;
                    }
                }
            }
        }

        const definition = {
            formAssociated     : form_associated,
            attachShadowOptions: attach_shadow_options,
            propertyDescriptors: property_descriptors,
            states             : states,
            styles             : styles,
        };

        AlierCustomElement.#classDefinitions.set(ctor, definition);
    }

    /**
     * Gets the definition of the given custom element class.
     * 
     * @param {typeof AlierCustomElement} ctor 
     * The custom element constructor.
     * 
     * @returns {CustomElementDefinition | undefined}
     * The definition of the custom element class.
     */
    static #getDefinition(ctor) {
        return AlierCustomElement.#classDefinitions.get(ctor);
    }

    /**
     * @template {typeof AlierCustomElement} T
     * @type {WeakMap<T, CustomElementDefinition>}
     */
    static #classDefinitions = new WeakMap();

    [_valuesKey] = new Map();

    /**
     * @type {AttributePropertyDescriptorMap}
     */
    #attrPropMap;

    /**
     * @type {StateMap?}
     */
    #states = null;

    /** @type {boolean} */
    #initialized = false;

    /**
     * A proxy used for rendering processes.
     * @type {CustomElementProxy}
     */
    [_proxyKey];

    static #taskQueue = new TaskQueue({
        windowTimeWeight: 0.8,
        residenceTimeThresholdInMilliseconds: 100,
    });
}

export { AlierCustomElement, listener, html };
