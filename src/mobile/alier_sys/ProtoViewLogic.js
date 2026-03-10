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

import { AlierCustomElement } from "./AlierCustomElement.js";
import entriesOf from "./entriesOf.js";
import getPropertyDescriptor from "./GetPropertyDescriptor.js";
import isEmpty from "./isEmpty.js";
import getPrimaryProperty from "./getPrimaryProperty.js";

/**
 * Tests whether or not the given two arrays are the same.
 *
 * @param {any[]} lhs
 * An array to be compared with the right-hand-side term.
 *
 * @param {any[]} rhs
 * An array to be compared with the left-hand-side term.
 *
 * @returns {boolean}
 * `true` if the `lhs` and `rhs` are the same array. `false` otherwise.
 */
const _isSameArray = (lhs, rhs) => {
    if (!Array.isArray(lhs) || !Array.isArray(rhs)) { return false; }
    if (lhs.length !== rhs.length) { return false; }
    if (lhs === rhs) { return true; }

    const keys = new Set();
    for (const i in lhs) {
        if (!Object.hasOwn(lhs, i)) { continue; }
        if (!Object.hasOwn(rhs, i)) { return false; }
        keys.add(i);
    }

    for (const i in rhs) {
        if (!Object.hasOwn(rhs, i)) { continue; }
        if (!keys.has(i)) { return false; }
    }

    for (const i of keys) {
        if (lhs[i] !== rhs[i]) { return false; }
    }

    return true;
}

/**
 * Creates an `AggregateError` with flattened errors.
 *
 * If the given errors contains `AggregateError`s, this function
 * replaces each of them with its `errors` property entries.
 *
 * @param {Error[]} errors
 * An array of errors to be flattened.
 *
 * This function modifies the given array in-place if it contains
 * one or more `AggregateError`s.
 * Hence, the array should be writable and extensible.
 * In addition, to avoid causing unexpected behavior, you should not
 * reuse the array for any other purpose.
 *
 * @param {string} message
 * A string representing a message for an `AggregateError` to be created.
 *
 * @returns {AggregateError}
 * an `AggregateError`.
 */
const _makeFlatAggregateError = (errors, message) => {
    const errors_ = errors;

    if (!Array.isArray(errors_)) { return errors_; }

    for (let i = 0; i < errors_.length;) {
        const e = errors_[i];
        if (e instanceof AggregateError) {
            errors_.splice(i, 1, ...e.errors);
        } else {
            i++;
        }
    }

    const messages = [message ?? ""];
    for (const e of errors_) {
        if (!(e instanceof Error)) { continue; }

        if (e.stack == null) {
            messages.push(`${e.constructor.name}: ${e.message}`);
        } else {
            messages.push(e.stack);
        }
    }

    return new AggregateError(errors_, messages.join("\n\t"));
};

/**
 * Matches invalid characters in the given identifier.
 *
 * @param {string} s
 * a string representing an identifier
 *
 * @returns {({
 *      prefix: string | undefined,
 *      body: ({
 *          index: number,
 *          value: string
 *      })[] | undefined
 * })}
 * an object representing the match result
 * if the given argument is a string, `undefined` otherwise.
 *
 * The returned match result has either or both of the `prefix` property
 * and the `body` property.
 *
 * -    The `prefix` property has the invalid prefix character of
 *      the given identifier if matched, `undefined` otherwise.
 * -    The `body` property has an array of `{ index, value }`s
 *      if matched, `undefined` otherwise.
 *      Where `value` represents a matched invalid characters
 *      in the given identifier and `index` represents an index of
 *      the corresponding matched invalid characters in the identifier.
 */
const _matchInvalidIdentifier = (() => {
    const invalid_prefix_expr = /^[^$_\p{ID_Start}]/u;
    const valid_prefix_expr   = /^[$_\p{ID_Start}]/u;
    const invalid_body_expr   = /[^$\u200c\u200d\p{ID_Continue}]+?/ug;

    return (s) => {
        if (typeof s !== "string") { return undefined; }
        if (s.length === 0) { return { prefix: "", body: undefined }; }

        const prefix_match = invalid_prefix_expr.exec(s);
        const prefix = prefix_match?.[0];

        const body = prefix == null ?
            s.replace(valid_prefix_expr, "") :
            s.slice(prefix.length)
        ;
        const offset = s.length - body.length;
        const body_matches = [];

        for (const m of body.matchAll(invalid_body_expr)) {
            body_matches.push({
                index: m.index + offset,
                value: m[0]
            });
        }

        return {
            prefix,
            body: body_matches.length > 0 ? body_matches : undefined
        }
    };
})();

/**
 * Tests whether or not the given value is a valid identifier.
 *
 * Where an identifier being valid means that it is a string which is
 * allowed to be used as a variable name.
 * Since almost every Unicode characters not collected in ASCII is
 * valid as part of a variable name,
 * the set of valid identifiers is much vaster than you might think.
 *
 * @see
 * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#identifiers| developer.mozilla.org - MDN Docs - Lexical grammar # identifiers}
 *
 * @param {string} s
 * an identifier to be tested.
 *
 * @returns {boolean}
 * `true` if the given identifier `s` is valid, `false` otherwise.
 */
const _isValidIdentifier = (s) => {
    const m = _matchInvalidIdentifier(s);

    return (m != null && m.prefix == null && m.body == null);
};

/**
 * Gets a set of property names of the given object.
 *
 * Unlike {@link Object.getOwnPropertyNames},
 * this function retrieves all properties defined in the given object's
 * prototype chain.
 *
 * @param {object} o
 * an object.
 *
 * @returns {Set<string>}
 * a set of property names of the given object `o`.
 */
const _getPropertyNames = (o) => {
    /** @type {string[]} */
    const names = [];
    for (let proto = o; proto != null; proto = Object.getPrototypeOf(proto)) {
        names.splice(names.length, 0, ...Object.getOwnPropertyNames(proto));
    }
    return new Set(names);
}

/**
 * special property names used for ProtoViewLogic's internal functionality.
 */
const CustomKeys$ELEMENT_OWNER           = Symbol("alier-viewlogic-element_owner")
    , CustomKeys$ELEMENT_NAME            = Symbol("alier-viewlogic-element_name")
    , CustomKeys$ELEMENT_CACHED_INDEX    = Symbol("alier-viewlogic-element_cached_index")
    , CustomKeys$ELEMENT_EVENT_LISTENERS = Symbol("alier-viewlogic-element_event_listeners")
;

class ProtoViewLogic {
    /**
     * Class name included in the result of `Object.prototype.toString()`
     */
    get [Symbol.toStringTag]() { return this.constructor.name; }

    /**
     * ProtoViewLogic's name.
     *
     * @type {string?}
     */
    get name() { return this.#name; }

    /**
     * ProtoViewLogic's parent.
     *
     * @returns {ProtoViewLogic?}
     */
    get parent() { return this.#parent; }

    /**
     * A callback function invoked whenever a message is posted to
     * the target ProtoViewLogic.
     *
     * @param {Messenger} message
     * A message object.
     *
     * @returns {Promise<boolean>}
     * whether or not the given message is consumed.
     * `true` if the message is consumed, `false` otherwise.
     *
     * @see
     * - {@link ProtoViewLogic.prototype.message}
     * - {@link ProtoViewLogic.prototype.post}
     * - {@link ProtoViewLogic.prototype.broadcast}
     */
    // eslint-disable-next-line no-unused-vars
    async messageHandler(message) { return false; }

    /**
     * creates a message
     *
     * @param {string?} id
     * primary identifier of the message to be made.
     *
     * @param {string?} code
     * secondary identifier of the message to be made.
     *
     * @param {any?} param
     * Extra parameters of the message to be made.
     *
     * @returns {({
     *      id: string?,
     *      code: string?,
     *      param:any?,
     *      origin: this
     * })}
     * a message.
     *
     * @see
     * - {@link ProtoViewLogic.prototype.post}
     * - {@link ProtoViewLogic.prototype.messageHandler}
     */
    message(id, code, param) {
        return Alier.message(id, code, param, this);
    }

    /**
     * @async
     * Posts a message to the target {@link ProtoViewLogic}.
     *
     * The posted message is passed as an argument of
     * the target `ProtoViewLogic`'s {@link messageHandler}.
     *
     * If the message is not delivered to a handler or not consumed
     * by a handler, it is reposted to the target `ProtoViewLogic`'s
     * {@link parent}.
     * If the target `ProtoViewLogic` does not have a parent,
     * this function returns `false`.
     *
     * @param {object} message
     * A message to post.
     *
     * @param {string?} message.id
     * The primary identifier of the message.
     *
     * @param {string?} message.code
     * The secondary identifier of the message.
     *
     * @param {any?} message.param
     * An optional parameter object of the message.
     *
     * @param {object} message.origin
     * The original sender of the message.
     *
     * @param {object} options
     * A collection of optional arguments.
     *
     * @param {boolean} [options.discardDuplicates=false]
     * A boolean indicating whether or not to discard a message if duplicated.
     * Duplicates are discarded if the parameter is `true`.
     *
     * By default, this parameter is set to `false`.
     *
     * @returns {Promise<boolean>}
     * A Promise that resolves to a boolean which indicates
     * whether or not the posted message has been consumed.
     * `true` if the message has been consumed,
     * `false` otherwise.
     *
     * @throws {TypeError}
     * -  when the given argument `message` is not a non-null object.
     *
     * @see
     * - {@link post}
     * - {@link messageHandler}
     */
    async post(message, options) {
        if (message === null || typeof message !== "object") {
            throw new TypeError(`${message} is not a non-null object`);
        }

        const discardDuplicates = options?.discardDuplicates ?? false;

        if (discardDuplicates && this.isProcessing(message)) { return false; }

        const message_ = (message instanceof Messenger) ?
            message :
            // set the target property to the message.
            new Messenger({ ...message, target: this })
        ;

        this.#markAsInProgress(message);

        const handler_result = this.messageHandler(message_);

        handler_result.then(() => {
            this.#clearAsInProgress(message);
        });

        const delivered      = (await message_.waitUntilDelivered()) ?? (await handler_result);
        const consumed       = typeof delivered !== "boolean" || delivered;

        return consumed || (this.parent?.post(message_, options) ?? consumed);
    }

    /**
     * @async
     *
     * Broadcasts a message to the target {@link ProtoViewLogic}'s
     * descendants.
     *
     * The broadcasted message is passed as an argument of the target
     * `ProtoViewLogic`'s {@link messageHandler}.
     *
     * If the message is not delivered to a handler or
     * not consumed by a handler, it is reposted to the target
     * `ProtoViewLogic`'s {@link parent}.
     * If the target `ProtoViewLogic` does not have a parent,
     * this function returns `false`.
     *
     * The message is processed by each of the target `ProtoViewLogic`'s
     * children,
     * and then it is processed by each of the grandchildren
     * if their parent has not processed the message,
     * and then it is processed by each of the great-grandchildren
     * if their parent has not processed the message,
     * and so on.
     *
     * @param {object} message
     * A message to broadcast.
     *
     * @param {string?} message.id
     * The primary identifier of the message.
     *
     * @param {string?} message.code
     * The secondary identifier of the message.
     *
     * @param {any?} message.param
     * An optional parameter object of the message.
     *
     * @param {object} message.origin
     * The original sender of the message.
     *
     * @returns {Promise<boolean>}
     * A Promise that resolves to a boolean which indicates
     * whether or not the posted message has been consumed.
     * `true` if the message has been consumed, `false` otherwise.
     *
     * @throws {TypeError}
     * -  when the given argument `message` is not a non-null object.
     * @throws {AggregateError}
     * -  when some of the descendants failed to handle the message.
     */
    async broadcast(message) {
        if (message === null || typeof message !== "object") {
            throw new TypeError(`${message} is not a non-null object`);
        }

        const message_ = (message instanceof Messenger) ?
            message :
            // set the target property to the message.
            new Messenger({ ...message, target: this })
        ;

        /**
         * @param {ProtoViewLogic} vl
         * @returns {ProtoViewLogic[]}
         */
        const expand = (vl) => {
            const children = Object.values(vl.getRelatedViewLogics())
                .flat(1)
            ;
            const viewLogics = Object.values(vl.getRelatedElements())
                .flat(1)
                .map(element => element.logic)
                .filter(logic => (logic instanceof ProtoViewLogic))
            ;
            return [...children, ...viewLogics];
        };
        const queue  = expand(this);
        /**
         * @type {Error[]}
         */
        const errors = [];
        let   accumulated_result = false;

        while (queue.length > 0) {
            /**
             * @type {[ProtoViewLogic, Promise<boolean>][]}
             */
            const consumed = [];

            while (queue.length > 0) {
                const m = new Messenger(message_);
                /** @type {ProtoViewLogic} */
                const child = queue.shift();
                try {
                    const handler_result = child.messageHandler(m);
                    const delivered      = m.waitUntilDelivered().then(consumed => {
                        return consumed ?? handler_result.then(
                            result => {
                                return typeof result !== "boolean" || result;
                            },
                            error => {
                                errors.push(error);

                                // stop propagation
                                return true;
                            }
                        );
                    });
                    consumed.push([child, delivered]);
                } catch (e) {
                    errors.push(e);

                    // stop propagation
                    consumed.push([child, Promise.resolve(true)]);
                }
            }

            const results = await Promise.all(consumed.map(([, result]) => result));

            for (const i of results.keys()) {
                if (!results[i]) {
                    queue.push(...expand(consumed[i][0]));
                } else if (!accumulated_result) {
                    accumulated_result = true;
                }
            }
        }

        if (errors.length > 0) {
            throw _makeFlatAggregateError(errors, "Errors occur during broadcasting");
        }

        return accumulated_result;
    }

    /**
     * Determining if a message is in progress.
     *
     * @param {({ id?: string, code?: string })} message
     * @returns {boolean} `true` if the message is in processing,
     * `false` otherwise.
     */
    isProcessing(message) {
        if (message === null || typeof message !== "object") { return false };
        return this.#messages.get(message.id)?.get(message.code) != null;
    }

    /**
     * Marking the message in progress.
     *
     * @param {({ id?: string, code?: string })} message
     */
    #markAsInProgress(message){
        const { id, code } = message;
        const messages_ = this.#messages;
        let code_map = messages_.get(id);
        if (code_map == null) {
            code_map = new Map();
            messages_.set(id, code_map);
        }
        code_map.set(code, message);
    }

    /**
     * Clear the message when the process is complete.
     *
     * @param {({ id?: string, code?: string })} message
     */
    #clearAsInProgress(message){
        const { id, code } = message;
        const messages_ = this.#messages;
        let code_map = messages_.get(id);
        if (code_map != null) {
            code_map.delete(code);
            if (code_map.size === 0) {
                messages_.delete(id);
            }
        }
    }

    /**
     * Collects values of a specified property or attribute from
     * the elements related to the target `ProtoViewLogic`.
     *
     * @param {string?} key
     * An optional string representing the name of a property or
     * an attribute to collect.
     *
     * @returns {({
     *      [element_name: string]: any?
     * })}
     * An object mapping each element's name to the value of
     * the corresponding property, if available; otherwise, the attribute.
     * If neither exists, the value will be null.
     *
     * If the property name is not specified, this function
     * returns an object mapping each element's name to
     * the corresponding element itself instead.
     */
    collectAttributes(key) {
        const related_elements = this.getRelatedElements();

        if (typeof key !== "string") {
            return related_elements;
        }

        const o = Object.create(null);
        for (const [k, v] of Object.entries(related_elements)) {
            if (Array.isArray(v)) {
                o[k] = v.map(x => ((key in x) ?
                        x[key] :
                    x.hasAttribute(key) ?
                        x.getAttribute(key) :
                        null
                ));
            } else {
                o[k] = (key in v) ?
                        v[key] :
                    v.hasAttribute(key) ?
                        v.getAttribute(key) :
                        null
                ;
            }
        }

        return o;
    }

    /**
     * Gets a set of the primary values of the elements related with
     * the target ProtoViewLogic.
     *
     * @returns {({
     *  [element_name: string]: any | any[]
     * })} An object mapping elements to their primary values.
     */
    curateValues() {
        const value_map = Object.create(null);

        const related_element_map = this.getRelatedElements();
        /**
         * @param {Element | Element[]} element_or_array
         */
        const get_element_value_of = element_or_array => {
            if (Array.isArray(element_or_array)) {
                const data = element_or_array.map(get_element_value_of);
                return data.some(x => x != null) ? data : undefined;
            }
            const element = element_or_array;
            const { node, key } = getPrimaryProperty(element);
            if (node === element && key === "value") {
                if (node instanceof HTMLSelectElement) {
                    return node.multiple ?
                        [...node.selectedOptions].map((option) => option.value) :
                        (node.value ?? "")
                    ;
                } else if (node instanceof HTMLInputElement) {
                    const node_type = node.type;
                    return (node_type === "radio" || node_type === "checkbox") ?
                        node.checked :
                        node.value
                    ;
                } else {
                    return node.value;
                }
            } else if (node != null) {
                return node[key];
            } else if (element.value != null) {
                return element.value;
            } else {
                return;
            }
        };

        for (const element_name in related_element_map) {
            const element_or_array = related_element_map[element_name];
            const value = get_element_value_of(element_or_array);
            if (value != null) {
                value_map[element_name] = value;
            }
        }

        return value_map;
    }

    /**
     * Updates the primary properties of the target ProtoViewLogic's own
     * elements related by using {@link relateElements}.
     *
     * If the attribute `data-primary` is not defined or its value is
     * empty on the target element, `value` property is used as
     * the primary property of that element.
     * Otherwise, the value of the `data-primary` attribute is
     * treated as the primary property name.
     *
     * Note that, the primary properties are not restricted on
     * the elements own properties.
     * If the `data-primary` attribute has the value containing
     * dots (`.`), the `data-primary` value is treated as
     * a sequence of properties separated with dots.
     * For example, let `e` is the target element and
     * `e.dataset.primary` is set to `"foo.bar"`, then
     * the `e`'s primary property is `e.foo.bar` and eventually
     * `e.foo` is an object.
     *
     * This function and {@link onDataBinding} are used for
     * data synchronization cooperating with {@link ObservableObject}s.
     * If the target `ProtoViewLogic` is bound with some `ObservableObject`,
     * then the result of update will be reflected to that
     * `ObservableObject` and other binding targets.
     * In this case, this function invokes the binding source's
     * `reflectValues()` and the latter's return value is used as
     * the former's return value.
     *
     * @param {(
     *  { [element_name: string]: any } |
     *  Iterable<[string, any]>
     * )} nameValuePairs
     * A plain object or an iterable of name-value pairs.
     *
     * @returns {{ [element_name: string]: any } | Map<string, any>}
     * Pairs of element names and values that are the same as those given in the
     * argument.
     *
     * @throws {TypeError}
     * when the argument `elementValuePairs` is not a non-null object.
     *
     * @see
     * -  {@link ObservableObject}
     * -  {@link ObservableObject.prototype.bindData}
     * -  {@link ProtoViewLogic.prototype.onDataBinding}
     */
    reflectValues(nameValuePairs) {
        if (nameValuePairs === null || typeof nameValuePairs !== "object") {
            throw new TypeError(`${nameValuePairs} is not a non-null object`);
        }

        const pairs = nameValuePairs;

        const is_binding = (
            this.source !== null &&
            typeof this.source === "object" &&
            typeof this.source.reflectValues === "function"
        );
        /** @type { { [element_name: string]: any | any[] } | undefined }  */
        const updated_values = is_binding ? Object.create(null) : undefined;

        /**
         * @param {object} node
         * @param {string} source_key
         * @param {any} new_value
         * @returns {({ updated: true, current_value: any } | { updated: false })}
         */
        const default_reflect_value = (node, source_key, new_value) => {
            const old_value = node[source_key];
            if (old_value === new_value) {
                return { updated: false };
            }

            node[source_key] = new_value;

            const current_value = node[source_key];
            const updated = old_value !== current_value;

            return updated ?
                { updated, current_value } :
                { updated: false }
            ;
        };
        /**
         * @param {Element | Element[]} element_or_array
         * @param {any} new_value
         * @param {boolean} is_binding
         * @returns {({ updated: true, current_value: any } | { updated: false })}
         */
        const reflect_value = (element_or_array, new_value, is_binding) => {
            if (Array.isArray(element_or_array)) {
                if (!Array.isArray(new_value)) {
                    return { updated: false };
                }
                const elements    = element_or_array;
                const new_values  = new_value;

                const updated_arr = is_binding ? new Array(elements.length) : undefined;

                const len = Math.min(elements.length, new_values.length);
                for (let i = 0; i < len; i++) {
                    if (!Object.hasOwn(elements, i) || !Object.hasOwn(new_values, i)) { continue; }
                    const new_value_ = new_values[i];
                    const element    = elements[i];
                    const { updated, current_value } = reflect_value(element, new_value_, is_binding);
                    if (updated_arr != null && updated) {
                        updated_arr[i] = current_value;
                    }
                }

                return updated_arr?.some(() => true) ?
                    { updated: true, current_value: updated_arr } :
                    { updated: false }
                ;
            }
            const element = element_or_array;
            const { node, key } = getPrimaryProperty(element);

            if (node === element && key === "value") {
                if (node instanceof HTMLSelectElement) {
                    if (node.multiple) {
                        // new value must be a non-null object here.
                        if (new_value === null || typeof new_value !== "object") {
                            return { updated: false };
                        }

                        /** @type {Map<string, HTMLOptionElement>} */
                        const option_map = new Map();
                        for (const option of node.options) {
                            option_map.set(option.value, option);
                        }
                        const values = Object.create(null);

                        //  requires non null-object.
                        for (const k in new_value) {
                            const option  = option_map.get(k);
                            if (option != null) {
                                const selected = !!new_value[k];
                                option.selected = selected;
                                values[k] = selected;
                            }
                        }

                        const updated = !isEmpty(values);
                        return updated ?
                            { updated, current_value: values } :
                            { updated: false }
                        ;
                    } else {
                        return default_reflect_value(node, key, new_value);
                    }
                } else if (
                    (node instanceof HTMLInputElement) &&
                    (node.type === "radio" || node.type === "checkbox")
                ) {
                    return default_reflect_value(node, "checked", !!new_value);
                } else {
                    return default_reflect_value(node, key, new_value);
                }
            } else if (node != null) {
                return default_reflect_value(node, key, new_value);
            } else if (element.value != null) {
                return default_reflect_value(element, "value", new_value);
            }
            return { updated: false };
        };

        for (const [element_name, new_value] of entriesOf(pairs)) {
            /** @type {Element|Element[]} */
            const element_or_array = this[element_name];

            if (!this.hasOwnElement(element_or_array)) { continue; }

            const { updated, current_value } = reflect_value(element_or_array, new_value, is_binding);
            if (is_binding && updated) {
                updated_values[element_name] = current_value;
            }
        }

        if (is_binding) {
            this.source.reflectValues(updated_values);
        }

        return pairs;
    }

    /**
     * A callback function invoked when the target `ProtoViewLogic` is bound
     * with an `ObservableObject`.
     *
     * This function and {@link reflectValues} are used for
     * data synchronization cooperating with {@link ObservableObject}s.
     *
     * @throws {TypeError} When:
     *
     * -   a related element does not implement `onDataBinding()`
     *     function.
     * -   some of components of a related element array does not
     *     implement `onDataBinding()` function.
     *
     * @see
     * - {@link ObservableObject}
     * - {@link ObservableObject.prototype.bindData}
     * - {@link ProtoViewLogic.prototype.reflectValues}
     */
    onDataBinding(source) {

        const original_source = this.source;

        this.source = source;

        /**
         * Watch event to reflect value.
         * @param {Element} node Related element with "value" property as primary.
         */
        const watch_input_event = (node) => {
            const tag_name = node.tagName.toLowerCase();
            switch (tag_name) {
            case "input":
            {
                const node_type = node.type;

                if (node_type === "radio") {
                    const radio = node;

                    radio.addEventListener("input", (event) => {
                        const target = event.currentTarget;
                        const element_name = target[CustomKeys$ELEMENT_NAME];

                        if (typeof element_name !== "string") {
                            return;
                        }

                        const owner        = target[CustomKeys$ELEMENT_OWNER];
                        const target_ref   = owner?.[element_name];

                        if (typeof owner?.source?.reflectValues !== "function") {
                            return;
                        }

                        const reflected_values = Object.create(null);

                        const radio_group = [...target.getRootNode().querySelectorAll(
                            `input[type="radio"][name=${CSS.escape(target.name)}]`
                        )].filter((other) => {
                            return (other !== target && other[CustomKeys$ELEMENT_OWNER] === owner);
                        });

                        for (const other of radio_group) {
                            const other_name = other[CustomKeys$ELEMENT_NAME];
                            if (typeof other_name !== "string") { continue; }

                            const other_ref  = owner[other_name];
                            if (other_ref === other) {
                                reflected_values[other_name] = other.checked;
                            } else if (Array.isArray(other_ref)) {
                                const words = ProtoViewLogic.#parseId(other.id);
                                const index = Number(words[words.length - 1]);
                                if (Number.isSafeInteger(index) && other_ref[index] === other) {
                                    const checked = reflected_values[other_name] ?? [];
                                    checked[index] = other.checked;
                                    reflected_values[other_name] = checked;
                                }
                            }
                        }

                        if (target_ref === target) {
                            reflected_values[element_name] = target.checked;

                            owner.source.reflectValues(reflected_values);
                        } else if (Array.isArray(target_ref)) {
                            const words = ProtoViewLogic.#parseId(target.id);
                            const index = Number(words[words.length - 1]);
                            if (Number.isSafeInteger(index) && target_ref[index] === target) {
                                const checked  = reflected_values[element_name] ?? [];

                                checked[index] = target.checked;
                                reflected_values[element_name] = checked;

                                owner.source.reflectValues(reflected_values);
                            }
                        }
                    }, { passive: true });
                } else if (node_type === "checkbox") {
                    const checkbox = node;

                    checkbox.addEventListener("input", (event) => {
                        //  ELEMENT_NAME and ELEMENT_OWNER should be taken on each calls
                        //  because they may be changed after registering this listener
                        //  function.
                        //  If they can be assumed as constants after registration,
                        //  you can store them into external local variables, however,
                        //  that assumption is untrue.
                        const target       = event.currentTarget;
                        const element_name = target[CustomKeys$ELEMENT_NAME];

                        if (typeof element_name !== "string") {
                            return;
                        }

                        const owner        = target[CustomKeys$ELEMENT_OWNER];
                        const target_ref   = owner?.[element_name];

                        if (typeof owner?.source?.reflectValues !== "function") {
                            return;
                        }

                        const reflected_values = Object.create(null);

                        if (target_ref === target) {
                            reflected_values[element_name] = target.checked;

                            owner.source.reflectValues(reflected_values);
                        } else if (Array.isArray(target_ref)) {
                            const words = ProtoViewLogic.#parseId(target.id);
                            const index = Number(words[words.length - 1]);
                            if (Number.isSafeInteger(index) && target_ref[index] === target) {
                                const checked = [];
                                checked[index] = target.checked;
                                reflected_values[element_name] = checked;

                                owner.source.reflectValues(reflected_values);
                            }
                        }
                    }, { passive: true });
                } else {
                    const input = node;

                    input.addEventListener("input", (event) => {
                        const target = event.currentTarget;
                        const element_name = target[CustomKeys$ELEMENT_NAME];

                        if (typeof element_name !== "string") {
                            return;
                        }

                        const owner        = target[CustomKeys$ELEMENT_OWNER];
                        const target_ref   = owner?.[element_name];

                        if (typeof owner?.source?.reflectValues !== "function") {
                            return;
                        }

                        const reflected_values = Object.create(null);

                        if (target_ref === target) {
                            reflected_values[element_name] = target.value;

                            owner.source.reflectValues(reflected_values);
                        } else if (Array.isArray(target_ref)) {
                            const words = ProtoViewLogic.#parseId(target.id);
                            const index = Number(words[words.length - 1]);
                            if (Number.isSafeInteger(index) && target_ref[index] === target) {
                                const values = [];
                                values[index] = target.value;
                                reflected_values[element_name] = values;

                                owner.source.reflectValues(reflected_values);
                            }
                        }
                    }, { passive: true });
                }

                break;
            }
            case "textarea":
            {
                const textarea = node;

                textarea.addEventListener("input", (event) => {
                    const target = event.currentTarget;
                    const element_name = target[CustomKeys$ELEMENT_NAME];

                    if (typeof element_name !== "string") {
                        return;
                    }

                    const owner        = target[CustomKeys$ELEMENT_OWNER];
                    const target_ref   = owner?.[element_name];

                    if (typeof owner?.source?.reflectValues !== "function") {
                        return;
                    }

                    const reflected_values = Object.create(null);

                    if (target_ref === target) {
                        reflected_values[element_name] = target.value;

                        owner.source.reflectValues(reflected_values);
                    } else if (Array.isArray(target_ref)) {
                        const words = ProtoViewLogic.#parseId(target.id);
                        const index = Number(words[words.length - 1]);
                        if (Number.isSafeInteger(index) && target_ref[index] === target) {
                            const values = [];
                            values[index] = target.value;
                            reflected_values[element_name] = values;

                            owner.source.reflectValues(reflected_values);
                        }
                    }
                }, { passive: true });

                break;
            }
            case "select":
            {
                const select = node;

                select.addEventListener("input", (event) => {
                    const target = event.currentTarget;
                    const element_name = target[CustomKeys$ELEMENT_NAME];

                    if (typeof element_name !== "string") {
                        return;
                    }

                    const owner        = target[CustomKeys$ELEMENT_OWNER];
                    const target_ref   = owner?.[element_name];

                    if (typeof owner?.source?.reflectValues !== "function") {
                        return;
                    }

                    const reflected_values = Object.create(null);

                    if (target_ref === target) {
                        if (target.multiple) {
                            const values = [...target.selectedOptions].map((option) => option.value);
                            reflected_values[element_name] = values;
                        } else {
                            reflected_values[element_name] = target.value;
                        }
                        owner.source.reflectValues(reflected_values);
                    } else if (Array.isArray(target_ref)) {
                        const words = ProtoViewLogic.#parseId(target.id);
                        const index = Number(words[words.length - 1]);
                        if (Number.isSafeInteger(index) && target_ref[index] === target) {
                            const value_list  = [];
                            if (target.multiple) {
                                const values = [...target.selectedOptions].map((option) => option.value);
                                value_list[index] = values;
                            } else {
                                value_list[index] = target.value;
                            }
                            reflected_values[element_name] = value_list;
                            owner.source.reflectValues(reflected_values);
                        }
                    }
                });

                break;
            }
            default:
                return;
            }

            const input_listener = node[CustomKeys$ELEMENT_EVENT_LISTENERS]?.input;
            if (input_listener != null) {
                //  move input_listener to last to keep consistency viewed from
                //  owner's messageHandler. input_listener posts a message to
                //  the owner and therefore synchronization must be done before
                //  the owner handles that message.
                node.removeEventListener("input", input_listener);
                node.addEventListener("input", input_listener);
            }
        };

        /**
         * Re-define setter to reflect value.
         * @param {Element} element Related element.
         * @param {{[key: string]: any}} node
         * The element itself or one of its descendants that has the property.
         * @param {string} key Primary property name.
         * @param {PropertyDescriptor} desc
         */
        const watch_setter = (element, node, key, desc) => {
            let value = node[key];

            const getter = desc.get ?? function () {
                return this === node ? value : undefined;
            };

            const set = desc.set ?? ((new_value) => { value = new_value; });

            const reflect = (element, new_value) => {
                const {
                    owner,
                    name: element_name,
                    index
                } = ProtoViewLogic.getRelationshipOf(element);

                if (owner?.source == null) { return; }

                let new_value_;
                if (index == null) {
                    new_value_ = new_value;
                } else {
                    new_value_ = new Array(owner[element_name].length);
                    new_value_[index] = new_value;
                }

                owner.source.reflectValues({ [element_name]: new_value_ });
            };

            const setter = function (new_value) {
                if (this !== node) { return; }
                set.call(this, new_value);
                reflect(element, new_value);
            };

            Object.defineProperty(node, key, {
                get: getter,
                set: setter,
            });
        };

        /**
         * Monitor the primary property of the given element.
         * Add event listener and redefine setter to reflect values to source.
         * @param {Element} element Related element.
         */
        const watch_primary_property = (element) => {
            let { node: node_, key: key_ } = getPrimaryProperty(element);
            if (node_ == null) {
                if (element.value != null) {
                    node_ = element;
                    key_ = "value";
                } else {
                    return;
                }
            }
            const node = node_, key = key_;
            const desc = getPropertyDescriptor(node, key);
            if (!desc.configurable && Object.hasOwn(node, key)) {
                return;
            }

            if (element === node && key === "value") {
                watch_input_event(node);
            }

            watch_setter(element, node, key, desc);
        };

        try {
            const related_elements = this.getRelatedElements();
            for (const k in related_elements) {
                /** @type {Element|Element[]} */
                const element_or_array = related_elements[k];

                if (element_or_array instanceof Element) {
                    const related_element = element_or_array;
                    watch_primary_property(related_element);
                } else {
                    const related_element_array = element_or_array;
                    for (const i in related_element_array) {
                        if (!Object.hasOwn(related_element_array, i)) { continue; }

                        const component = related_element_array[i];
                        watch_primary_property(component);
                    }
                }
            }
        } catch (e) {
            if (original_source == null) {
                delete this.source;
            } else {
                this.source = original_source;
            }
            throw e;
        }
    }

    /**
     * Collects elements to be used as UI components from
     * the given element and its descendants.
     *
     * @param {Element | Promise<Element>} rootElement
     * An element treated as root while collection
     * or a `Promise` that resolves to a root element.
     *
     * @param {((element: Element) => boolean)?} filter
     * An optional predicate function used for filtering elements
     * selected with the selectors `":defined[id]"`.
     *
     * By default, the predicate function returning `true` if
     * either the given element has the `data-ui-component` attribute or
     * the element is an instance of `AlierCustomElement`.
     *
     * @returns
     * an object having references to the collected elements.
     * Each of keys of this object is determined
     * by the given elements' id attributes.
     *
     * If the collected element has the id attribute containing
     * a pair of brackets, that element is stored as a component of
     * the corresponding array property of the return value with
     * the corresponding index.
     * In this case, the substring preceding the open bracket is
     * used for the property name and the substring surrounded with
     * the pair of the brackets is used for the index.
     *
     * For instance, if an element with `id="foo[0]"` is collected,
     * this element can be referenced as `return_value.foo[0]`,
     * where `return_value` is an object returned from this function.
     *
     * @throws {TypeError}
     * When:
     * -   the given object is not an Element
     * @throws {SyntaxError}
     * When a one of collected elements has the malformed `id` value.
     * The `id` attribute satisfying any of the following conditions is
     * regarded as malformed:
     *
     * -   `id` attribute contains a character not allowed to be used
     *     for identifiers in JavaScript Syntax.
     * -   `id` attribute contains a dot ".".
     * -   `id` attribute contains two or more pairs of brackets "[]"
     * -   `id` attribute is empty
     * -   `id` attribute has the same name as a property defined
     *     in the `ProtoViewLogic`'s prototype
     *
     * @see
     * - {@link ProtoViewLogic.prototype.relateElements}
     */
    collectElements(rootElement, filter) {
        if (rootElement instanceof Promise) {
            return rootElement.then(root => {
                return this.collectElements(root, filter);
            });
        } else if (!(rootElement instanceof Element)) {
            throw new TypeError(`'rootElement' is not an ${Element.name}`);
        } else if (filter != null && typeof filter !== "function") {
            throw new TypeError(`'filter' is not a function`);
        }

        const RESERVED_NAMES = Object.getOwnPropertyNames(Object.getPrototypeOf(this));

        const root    = rootElement;
        const filter_ = filter ?? (
            element => (
                element.hasAttribute("data-ui-component") ||
                (element instanceof AlierCustomElement)
            )
        );
        const elements = [];
        for (const element of root.querySelectorAll(":defined[id]")) {
            let passed = false;
            try {
                passed = filter_(element);
            } catch (cause) {
                throw new Error(
                    `${this.constructor.name}: collectElements: an error occurs in the given filter function (${cause.message})`,
                    { cause }
                );
            }
            if (passed) {
                elements.push(element);
            }
        }

        const element_map = Object.create(null);
        for (const e of elements) {
            const id = e.id;
            const path = ProtoViewLogic.#parseId(id);
            if (!path.every(x => Number.isInteger(Number(x)) || _isValidIdentifier(x))) {
                throw new SyntaxError(`Given id contains a character not allowed in an identifier: "${id}"`);
            } else if (path.length > 2 || (path.length === 2 && Number.isNaN(Number(path[1])))) {
                throw new SyntaxError("'id' attribute cannot contain '.' or two or more pairs of brackets '[]'");
            } else if (path.length === 0) {
                throw new SyntaxError("'id' attribute must have a non-empty value");
            } else if (RESERVED_NAMES.includes(path[0])) {
                throw new SyntaxError(`'${path[0]}' is already defined in the prototype of this`);
            }
            let cwd = element_map;
            let key = path.shift();
            //  Loop terminating conditions are as follows:
            //  -   path.length === 0: the last key of path was captured
            //  -   !(key in cwd)    : 'cwd' does not contain 'key'
            while (path.length > 0 && (key in cwd)) {
                cwd = cwd[key];
                key = path.shift();
            }
            //  It is guaranteed that type of 'key' is string here.
            //  reduce() just returns the given initial value 'e',
            //  so the following expression is equivalent to `cwd[key] = e` if the 'path' is empty.
            //
            //  If `cwd[key]` already has a value, it will be overwritten.
            cwd[key] = path.reverse().reduce((i, k) => {
                const ret = Number.isSafeInteger(Number(k)) ? [] : {};
                ret[k] = i;
                return ret;
            }, e);
        }
        return element_map;
    }

    /**
     * Gets a set of proper ancestors.
     *
     * @returns {Set<ProtoViewLogic>}
     * a set of proper ancestors of the target `ProtoViewLogic`.
     */
    getAncestors() {
        /** @type {Set<ProtoViewLogic>} */
        const ancestors = new Set();

        for (let p = this.#parent; p != null; p = p.#parent) {
            ancestors.add(p);
        }

        return ancestors;
    }

    /**
     * Tests whether or not the given object is either a `ProtoViewLogic`
     * or an array of `ProtoViewLogic`s which is owned by
     * the target `ProtoViewLogic`.
     *
     * @param {*} o
     * An object to be tested.
     *
     * @returns {boolean}
     * `true` if the given object is related with the target `ProtoViewLogic`,
     * `false` otherwise.
     */
    hasOwnChild(o) {
        const o_ = o;

        if (Array.isArray(o_)) {
            if (o_.length === 0) { return false; }
            //  quick test.
            //  if the target ProtoViewLogic has reference to the given array, then return true.
            {
                let first;
                for (const i in o_) {
                    if (!Object.hasOwn(o_, i)) { continue; }
                    first = o_[i];
                    break;
                }
                if (first instanceof ProtoViewLogic) {
                    const k = first.#name;
                    if (typeof k === "string" && this[k] === o_) { return true; }
                }
            }

            let array_key = "";
            //  due to every() skips empty slots, this works as expected for sparse arrays as well.
            return o_.every(v => {
                if (!(v instanceof ProtoViewLogic)) { return false; }
                if (v.#parent !== this) { return false; }

                const k = v.#name;
                if (typeof k !== "string") { return false; }

                if (array_key.length === 0) {
                    array_key = k;
                    return true;
                }
                return array_key === k;
            });
        } else {
            return (o_ instanceof ProtoViewLogic) && o_.#parent === this;
        }
    }

    /**
     * Tests whether or not the given object is either an `Element`
     * or an array of `Element`s which is owned by
     * the target `ProtoViewLogic`.
     *
     * @param {*} o
     * An object to be tested.
     *
     * @returns {boolean}
     * `true` if the given object is related with the target `ProtoViewLogic`,
     * `false` otherwise.
     */
    hasOwnElement(o) {
        const o_ = o;

        if (Array.isArray(o_)) {
            if (o_.length === 0) { return false; }
            //  quick test.
            //  if the target ProtoViewLogic has reference to the given array, then return true.
            {
                let first = null;
                for (const i in o_) {
                    if (!Object.hasOwn(o_, i)) { continue; }
                    first = o_[i];
                    break;
                }
                if (first instanceof Element) {
                    const k = first[CustomKeys$ELEMENT_NAME];
                    if (typeof k === "string" && this[k] === o_) { return true; }
                }
            }

            let array_key = "";
            //  due to every() skips empty slots, this works as expected for sparse arrays as well.
            return o_.every(v => {
                if (!(v instanceof Element)) { return false; }
                if (v[CustomKeys$ELEMENT_OWNER] !== this) { return false; }

                const k = v[CustomKeys$ELEMENT_NAME];
                if (typeof k !== "string") { return false; }

                const ref = this[k];
                if (!Array.isArray(ref)) { return false; }

                if (array_key.length === 0) {
                    array_key = k;
                } else if (array_key !== k) {
                    return false;
                }

                /** @type {number?} */
                const i = v[CustomKeys$ELEMENT_CACHED_INDEX];
                if (!Number.isInteger(i) || v !== ref[i]) {
                    const i = ref.indexOf(v);
                    if (i < 0) {
                        return false;
                    }
                    //  update index cache implicitly.
                    v[CustomKeys$ELEMENT_CACHED_INDEX] = i;
                }

                return true;
            });
        } else {
            if (!(o_ instanceof Element)) { return false; }
            if (o_[CustomKeys$ELEMENT_OWNER] !== this) { return false; }

            const k = o_[CustomKeys$ELEMENT_NAME];

            if (typeof k !== "string") { return false; }

            const ref = this[k];
            if (ref === o_) { return true; }
            if (!Array.isArray(ref)) { return false; }

            /** @type {number?} */
            const i = o_[CustomKeys$ELEMENT_CACHED_INDEX];
            if (!Number.isInteger(i) || o_ !== ref[i]) {
                const i = ref.indexOf(o_);
                if (i < 0) {
                    return false;
                }
                //  update index cache implicitly.
                o_[CustomKeys$ELEMENT_CACHED_INDEX] = i;
            }

            return true;
        }
    }

    /**
     * Gets a set of `ProtoViewLogic`s related to the target `ProtoViewLogic`.
     *
     * @returns {({
     *      [viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[]
     * })}
     * An object mapping each related `ProtoViewLogic` name to
     * the corresponding `ProtoViewLogic` or the array of `ProtoViewLogic`s.
     *
     * @see
     * -  {@link relateViewLogics}
     * -  {@link disrelateViewLogics}
     * -  {@link getRelatedElements}
     */
    getRelatedViewLogics() {
        /**
         * @type {({ [viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[] })}
         */
        const viewlogics = Object.create(null);

        for (const k in this) {
            if (!Object.hasOwn(this, k)) { continue; }

            const v = this[k];
            if (
                ((v instanceof ProtoViewLogic) && v.parent === this) ||
                (Array.isArray(v) && v.length > 0 && v.every(x => ((x instanceof ProtoViewLogic) && x.parent === this)))
            ) {
                viewlogics[k] = v;
            }
        }

        return viewlogics;
    }


    /**
     * Relates the given {@link ProtoViewLogic}s to the target `ProtoViewLogic`,
     * i.e., adds properties having a reference to a `ProtoViewLogic` or
     * an array of `ProtoViewLogic`s to the target `ProtoViewLogic`
     * with specified names.
     *
     * The related `ProtoViewLogic`s become capable of bubbling messages
     * they received to the target `ProtoViewLogic`.
     *
     * This function triggers that each of the `ProtoViewLogic`s added to
     * the target `ProtoViewLogic`s properties
     * sends a message with the id `"vl$connectionChanged"` to itself.
     * Details of the change of the target's state is described
     * in the `param` property of the message.
     *
     * The `param` property is an object having the following properties:
     *
     * -   `state`    : `"connected" | "moved" | "disconnected"`
     *     -   a string representing how is the target changed.
     *         Each of values represents the following cases:
     *         -   `"connected"`   : the target has no parent previously
     *         -   `"disconnected"`: the target has no parent currently,
     *         -   `"moved"`       : the target's parent is changed,
     * -   `oldParent`: `ProtoViewLogic?`
     *     -   the `ProtoViewLogic` previously connected as the target's parent.
     * -   `oldName`  : `string?`
     *     -   a string representing the target's name previously assigned to.
     * -   `newParent`: `ProtoViewLogic?`
     *     -   the `ProtoViewLogic` newly connected as the target's parent.
     * -   `newName`  : `string?`
     *     -   a string representing the target's name newly assigned to.
     *
     * This function also triggers that the target `ProtoViewLogic` sends
     * a message with the message id `"vl$propertiesModified"`
     * to itself.
     * The `param` property of the message is an object having
     * the following properties:
     *
     * -    `addedProperties`: `({ [property_name]: ProtoViewLogic | ProtoViewLogic[] })?`
     *     -    an object having properties added to the target `ProtoViewLogic`
     * -    `removedProperties`: `({ [property_name]: ProtoViewLogic | ProtoViewLogic[] })?`
     *     -    an object having properties removed from the target `ProtoViewLogic`
     *
     * @param {({
     *      [viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[]
     * }) | Promise<({
     *      [viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[]
     * })>} viewLogicMap
     * an Object representing a set of pairs of names and `ProtoViewLogic` or
     * names and arrays of `ProtoViewLogic`s.
     * Or a Promise that resolves to one of the aforementioned values.
     *
     * @returns {({
     *      [viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[]
     * }) | Promise<({
     *      [viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[]
     * })>}
     * an object containing `ProtoViewLogic`s or arrays of `ProtoViewLogic`s
     * which are not related to the target `ProtoViewLogic`.
     *
     * @throws {TypeError}
     * when the argument `viewLogicMap` is a non-null object
     * but `ProtoViewLogic`
     *
     * @throws {AggregateError}
     * when the following errors occur:
     *
     * -    `TypeError`     : when the argument `viewLogicMap` has
     *      a property whose value is neither an `ProtoViewLogic` nor an array.
     * -    `TypeError`     : when the argument `viewLogicMap` has
     *      a property whose value is an array but it contains
     *      an entry not being `ProtoViewLogic`.
     * -    `SyntaxError`   : when the argument `viewLogicMap` has
     *      a property whose name is an empty string.
     * -    `SyntaxError`   : when the argument `viewLogicMap` has
     *      a property whose name contains characters invalid for an identifier.
     * -    `SyntaxError`   : when the argument `viewLogicMap` has
     *      a property whose name is duplicated with one of
     *      the target `ProtoViewLogic`'s properties defined in its prototypes.
     * -    `SyntaxError`   : when the argument `viewLogicMap` has
     *      a property whose name is duplicated with one of
     *      the target `ProtoViewLogic`'s properties used for `Element`s
     *      or arrays of `Element`s.
     * -    `ReferenceError`: when the argument `viewLogicMap` refers
     *      the same ProtoViewLogic with two or more different keys
     * -    `ReferenceError`: when the argument `viewLogicMap` contains
     *      an ancestor of the target ProtoViewLogic
     *
     * @see
     * -  {@link messageHandler}
     * -  {@link post}
     * -  {@link broadcast}
     * -  {@link disrelateViewLogics}
     */
    relateViewLogics(viewLogicMap) {
        if (viewLogicMap instanceof Promise) {
            return viewLogicMap.then(viewlogic_map => {
                return this.relateViewLogics(viewlogic_map);
            });
        } else if (viewLogicMap instanceof ProtoViewLogic) {
            throw new TypeError("ProtoViewLogic cannot be used as a map of ProtoViewLogics");
        }

        const errors         = [];
        const RESERVED_NAMES = _getPropertyNames(Object.getPrototypeOf(this));
        const refs           = new WeakMap();
        const ancestors      = this.getAncestors();

        ancestors.add(this);

        /**
         * @type {({ [viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[] })}
         */
        const viewlogic_map = Object.assign(Object.create(null), viewLogicMap);
        /**
         * @type {({ [viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[] })}
         */
        const disrelated_viewlogics = Object.create(null);
        /**
         * @type {({ [viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[] })}
         */
        const related_viewlogics = Object.create(null);

        for (const k in viewlogic_map) {
            if (!Object.hasOwn(viewlogic_map, k)) { continue; }
            if (!_isValidIdentifier(k)) {
                const m      = _matchInvalidIdentifier(k);
                const prefix = m?.prefix;
                const body   = m?.body;
                if (prefix != null && prefix.length === 0) {
                    errors.push(new SyntaxError("Empty string is not allowed to be used as a property name"));
                } else {
                    let error_message = `For property "${k}": Given property name contains characters invalid for an identifier:\n`;
                    if (prefix != null) {
                        error_message += `Invalid prefix found: "${prefix}"\n`;
                    }
                    if (body != null) {
                        error_message += body.map(({ value, index }) => {
                            return `Invalid characters found at (${index}:${index + value.length - 1}): "${value}"`;
                        }).join("\n");
                    }
                    errors.push(new SyntaxError(error_message));
                }
            } else if (RESERVED_NAMES.has(k)) {
                errors.push(new SyntaxError(`For property "${k}": Given property name is reserved`));
            } else if (this.hasOwnElement(this[k])) {
                errors.push(new SyntaxError(`For property "${k}": Given property name is occupied by related elements`));
            }

            const viewlogic_or_array = viewlogic_map[k];

            if (this.hasOwnChild(viewlogic_or_array)) {
                const target = this[k];

                //  check whether or not viewlogic_or_array has the same name as k.
                if ((target === viewlogic_or_array) || _isSameArray(target, viewlogic_or_array)) {
                    //  already related with the target ProtoViewLogic as the same key.
                    delete viewlogic_map[k];
                    continue;
                }
            }

            if (errors.length === 0) {
                if (this[k] instanceof ProtoViewLogic) {
                    Object.assign(disrelated_viewlogics, this.disrelateViewLogics(this[k]));
                } else if (Array.isArray(this[k]) && this[k].some(x => (x instanceof ProtoViewLogic))) {
                    Object.assign(disrelated_viewlogics, this.disrelateViewLogics(this[k]));
                }
            }

            if (Array.isArray(viewlogic_or_array)) {
                const viewlogics = viewlogic_or_array;

                /**
                 * @type {Map<ProtoViewLogic, [ProtoViewLogic, string] | [null, null]>}
                 */
                const old_name_and_parents = new Map();

                for (const viewlogic of viewlogics) {
                    if (!(viewlogic instanceof ProtoViewLogic)) {
                        errors.push(new TypeError(`For property "${k}": array entry is not a ProtoViewLogic`));
                        continue;
                    } else if (ancestors.has(viewlogic)) {
                        errors.push(new ReferenceError(`For property "${k}": Given ProtoViewLogic is an ancestor of the target ProtoViewLogic`));
                        continue;
                    } else if (refs.has(viewlogic)) {
                        const prev_key = refs.get(viewlogic);
                        errors.push(new ReferenceError(`For property "${k}": Given ProtoViewLogic is already referred as "${prev_key}"`));
                        continue;
                    }

                    refs.set(viewlogic, k);

                    if (errors.length > 0) {
                        continue;
                    }

                    const old_parent = viewlogic.#parent;
                    /** @type {string} */
                    const old_name   = viewlogic.#name;

                    if (old_parent === this) {
                        //  rename
                        const disrelated_entry = old_parent.disrelateViewLogics(viewlogic)[old_name];

                        if (Array.isArray(disrelated_entry)) {
                            if (disrelated_viewlogics[old_name] == null) {
                                disrelated_viewlogics[old_name] = new Array(disrelated_entry.length);
                            }

                            const dest = disrelated_viewlogics[old_name];
                            for (const i in disrelated_entry) {
                                dest[i] = disrelated_entry[i];
                            }
                        } else {
                            disrelated_viewlogics[old_name] = disrelated_entry;
                        }
                    } else if (old_parent != null) {
                        //  moved from another ProtoViewLogic
                        old_parent.disrelateViewLogics(viewlogic);
                    }

                    //  update the given ProtoViewLogic instance
                    viewlogic.#parent = this;
                    viewlogic.#name   = k;

                    old_name_and_parents.set(viewlogic, [old_parent, old_name]);
                }

                if (errors.length > 0) {
                    continue;
                }

                //  Copying with spread syntax ([...arr]) erase empty slots with undefined
                //  and it is NOT expected. So copy by using reduce method here.
                this[k] = viewlogics
                    .reduce(
                        //  assign non-empty slot to the clone and then return the latter
                        (c, v, i) => (c[i] = v, c),
                        new Array(viewlogics.length)
                    )
                ;

                for (const [viewlogic, [old_parent, old_name]] of old_name_and_parents.entries()) {
                    viewlogic.#onConnectionChanged(old_parent, old_name, this, k);
                }

            } else if (viewlogic_or_array instanceof ProtoViewLogic) {
                const viewlogic = viewlogic_or_array;

                if (ancestors.has(viewlogic)) {
                    errors.push(new ReferenceError(`For property "${k}": Given ProtoViewLogic is an ancestor of the target ProtoViewLogic`));
                    continue;
                } else if (refs.has(viewlogic)) {
                    const prev_key = refs.get(viewlogic);
                    errors.push(new ReferenceError(`For property "${k}": Given ProtoViewLogic is already referred as "${prev_key}"`));
                    continue;
                }

                refs.set(viewlogic, k);

                if (errors.length > 0) {
                    continue;
                }

                const old_parent = viewlogic.#parent;
                /** @type {string} */
                const old_name   = viewlogic.#name;

                if (old_parent === this) {
                    //  rename
                    const disrelated_entry = old_parent.disrelateViewLogics(viewlogic)[old_name];
                    if (Array.isArray(disrelated_entry)) {
                        if (disrelated_viewlogics[old_name] == null) {
                            disrelated_viewlogics[old_name] = new Array(disrelated_entry.length);
                        }

                        const dest = disrelated_viewlogics[old_name];
                        for (const i in disrelated_entry) {
                            dest[i] = disrelated_entry[i];
                        }
                    } else {
                        disrelated_viewlogics[old_name] = disrelated_entry;
                    }
                } else if (old_parent != null) {
                    //  moved from another ProtoViewLogic
                    old_parent.disrelateViewLogics(viewlogic);
                }

                viewlogic.#parent = this;
                viewlogic.#name   = k;

                this[k] = viewlogic;
                viewlogic.#onConnectionChanged(old_parent, old_name, this, k);
            } else {
                errors.push(new TypeError(`For property "${k}": Given property has a value being neither a ProtoViewLogic nor an array of ProtoViewLogics`));
                continue;
            }

            related_viewlogics[k] = viewlogic_map[k];
            delete viewlogic_map[k];
        }

        if (errors.length > 0) {
            //  Restore the previous state wherever possible
            for (const k in related_viewlogics) {
                const related_viewlogic = related_viewlogics[k];
                //  Disrelate ProtoViewLogics being related with the target ProtoViewLogic
                //  during this function call.
                this.disrelateViewLogics(related_viewlogic);
            }

            //  Relate ProtoViewLogics being disrelated with the target ProtoViewLogic
            //  during this function call.
            this.relateViewLogics(disrelated_viewlogics);

            throw _makeFlatAggregateError(errors, "Given map of ProtoViewLogics have some errors");
        }

        this.#onPropertiesModified(related_viewlogics, disrelated_viewlogics);

        return Object.assign(viewlogic_map, disrelated_viewlogics);
    }

    /**
     * Disrelates the given {@link ProtoViewLogic}s from the target `ProtoViewLogic`.
     *
     * This function triggers that each of the `ProtoViewLogic`s removed from
     * the target `ProtoViewLogic`s properties sends a message
     * with the message id `"vl$connectionChanged"` to itself.
     * Details of the change of the target's state is described in
     * the `param` property of the message.
     *
     * The `param` property is an object having the following properties:
     *
     * -   `state`    : `"connected" | "moved" | "disconnected"`
     *     -   a string representing how is the target changed.
     *         Each of values represents the following cases:
     *         -   `"connected"`   : the target has no parent previously
     *         -   `"disconnected"`: the target has no parent currently,
     *         -   `"moved"`       : the target's parent is changed,
     * -   `oldParent`: `ProtoViewLogic?`
     *     -   the `ProtoViewLogic` previously connected as the target's parent.
     * -   `oldName`  : `string?`
     *     -   a string representing the target's name previously assigned to.
     * -   `newParent`: `ProtoViewLogic?`
     *     -   the `ProtoViewLogic` newly connected as the target's parent.
     * -   `newName`  : `string?`
     *     -   a string representing the target's name newly assigned to.
     *
     * This function also triggers that the target `ProtoViewLogic` sends
     * a message with the message id `"vl$propertiesModified"`
     * to itself.
     * The `param` property of the message is an object having
     * the following properties:
     *
     * -    `addedProperties`: `({ [property_name]: ProtoViewLogic | ProtoViewLogic[] })?`
     *     -    an object having properties added to the target `ProtoViewLogic`.
     *          In this case, this property is always `null`.
     * -    `removedProperties`: `({ [property_name]: ProtoViewLogic | ProtoViewLogic[] })?`
     *     -    an object having properties removed from the target `ProtoViewLogic`
     *
     * @param {null | string | ProtoViewLogic | ProtoViewLogic[]} relatedViewLogicOrItsName
     * @returns {({ [viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[]})}
     * @see
     * -  {@link relateViewLogics}
     */
    disrelateViewLogics(relatedViewLogicOrItsName) {
        if (relatedViewLogicOrItsName == null) {
            /**
             * @type {{[viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[] }}
             */
            const disrelated_viewlogics = Object.create(null);
            for (const k in this) {
                if (!Object.hasOwn(this, k)) { continue; }

                const v = this[k];
                if ((v instanceof ProtoViewLogic) || (Array.isArray(v) && v.some(x => (x instanceof ProtoViewLogic)))) {
                    Object.assign(disrelated_viewlogics, this.disrelateViewLogics(v));
                }
            }
            return disrelated_viewlogics;
        } else if (typeof relatedViewLogicOrItsName === "string") {
            if (Object.hasOwn(this, relatedViewLogicOrItsName)) {
                return this.disrelateViewLogics(this[relatedViewLogicOrItsName]);
            } else {
                throw new ReferenceError(`property "${relatedViewLogicOrItsName}" is not defined on this object`);
            }
        } else if (Array.isArray(relatedViewLogicOrItsName)) {
            let array_name = null;
            for (const vl of relatedViewLogicOrItsName) {
                if (!(vl instanceof ProtoViewLogic)) {
                    throw new TypeError(`${vl} is not a ProtoViewLogic`);
                } else if (vl.#parent !== this) {
                    throw new ReferenceError(`${vl} is not a target's child`);
                } else if (!Array.isArray(this[vl.#name])) {
                    throw new ReferenceError(`${vl} is related as non-array property of the target ProtoViewLogic`);
                } else if (array_name !== null && vl.#name !== array_name) {
                    throw new ReferenceError(
                        `Array must only contain ProtoViewLogics having the same name but different names ${vl.#name} and ${array_name} are found.`
                    );
                }

                if (array_name == null) {
                    array_name = vl.#name;
                }
            }
        } else if (!(relatedViewLogicOrItsName instanceof ProtoViewLogic)) {
            throw new TypeError(`${relatedViewLogicOrItsName} is not a ProtoViewLogic`);
        } else if (relatedViewLogicOrItsName.#parent !== this) {
            throw new ReferenceError(`${relatedViewLogicOrItsName} is not a target's child`);
        }

        /**
         * @type {{[viewlogic_name: string]: ProtoViewLogic | ProtoViewLogic[] }}
         */
        const disrelated_viewlogics = Object.create(null);

        if (Array.isArray(relatedViewLogicOrItsName)) {
            const related_viewlogics = relatedViewLogicOrItsName;

            const old_name = related_viewlogics[0].#name;

            /**
             * @type {(ProtoViewLogic|undefined)[]}
             */
            const packed_viewlogics = new Array(this[old_name].length);
            const indices = [];
            for (const u of related_viewlogics) {
                const index = this[old_name].indexOf(u);

                indices.push(index);

                packed_viewlogics[index] = u;

                u.#name   = null;
                u.#parent = null;

                delete this[old_name][index];
            }
            disrelated_viewlogics[old_name] = packed_viewlogics;

            let is_empty = true;
            for (const i in this[old_name]) {
                if (Object.hasOwn(this[old_name], i)) {
                    is_empty = false;
                    break;
                }
            }
            if (is_empty) {
                delete this[old_name];
            }

            for (const index of indices) {
                const u = packed_viewlogics[index];
                u.#onConnectionChanged(this, old_name, null, null);
            }
        } else if (Array.isArray(this[relatedViewLogicOrItsName.#name])) {
            const related_viewlogic = relatedViewLogicOrItsName;

            const old_name   = related_viewlogic.#name;

            /**
             * @type {(ProtoViewLogic|undefined)[]}
             */
            const packed_viewlogics = new Array(this[old_name].length);

            const index = this[old_name].indexOf(related_viewlogic);
            packed_viewlogics[index] = related_viewlogic;

            related_viewlogic.#name   = null;
            related_viewlogic.#parent = null;

            delete this[old_name][index];
            disrelated_viewlogics[old_name] = packed_viewlogics;

            let is_empty = true;
            for (const i in this[old_name]) {
                if (Object.hasOwn(this[old_name], i)) {
                    is_empty = false;
                    break;
                }
            }
            if (is_empty) {
                delete this[old_name];
            }

            related_viewlogic.#onConnectionChanged(this, old_name, null, null);
        } else {
            const related_viewlogic = relatedViewLogicOrItsName;

            const old_name          = related_viewlogic.#name;

            related_viewlogic.#name   = null;
            related_viewlogic.#parent = null;

            disrelated_viewlogics[old_name] = related_viewlogic;
            delete this[old_name];

            related_viewlogic.#onConnectionChanged(this, old_name, null, null);
        }

        this.#onPropertiesModified(null, disrelated_viewlogics);

        return disrelated_viewlogics;
    }

    /**
     * Gets a set of elements related to the target `ProtoViewLogic`.
     *
     * @returns {({
     *      [element_name: string]: Element | Element[]
     * })}
     * An object mapping each related `Element` name to
     * the corresponding `Element` or the array of `Element`s.
     *
     * @see
     * -  {@link relateElements}
     * -  {@link disrelateElements}
     * -  {@link getRelatedViewLogics}
     */
    getRelatedElements() {
        /**
         * @type {({ [element_name: string]: Element | Element[] })}
         */
        const elements = Object.create(null);

        for (const k in this) {
            if (!Object.hasOwn(this, k)) { continue; }

            const v = this[k];
            if (this.#isRelatedElement(v) || this.#isRelatedElementArray(v)) {
                elements[k] = v;
            }
        }

        return elements;
    }

    /**
     * Relates the given elements to the target `ProtoViewLogic`.
     * The related elements become capable of notifying occasion of
     * events to the target `ProtoViewLogic`.
     *
     * This function assigns the given elements to
     * the target `ProtoViewLogic` as an object,
     * i.e.  this function adds the properties having the same names and
     * the same values as the passed object to the target `ProtoViewLogic`.
     * Each of that properties is enumerable and writable and configurable.
     *
     * Each of the related elements posts a message to
     * its owner `ProtoViewLogic` by using {@link post}
     * whenever an event corresponding to it occurs.
     *
     * Which kind of events are notified is determined by
     * the `data-active-events` attribute of the related element.
     * The `data-active-events` attribute has a comma-separated list of
     * event types as a value.
     * If the related element's `data-active-events` attribute contains
     * one or more event types,
     * then the event listener corresponding to each of the listed event
     * typed is added to the related element
     * by invoking {@link addActiveEvents} function from
     * the target `ProtoViewLogic`.
     *
     * The related elements are modified by invoking {@link reflectValues}.
     * Which properties are to be modified is determined by
     * the `data-primary` attribute of the related elements.
     * If the `data-primary` attribute is defined and it has a value,
     * the property to be modified is indicated by
     * the `data-primary` attribute value.
     * Otherwise the `value` property is to be modified.
     * The `data-primary` has dot-separated words as its value.
     * Each of words represents a property name.
     * The words appeared after a dot represents a property of
     * an object indicated by the former words.
     * e.g. let `e` is a DOM element representing
     * `&lt;span data-primary="foo.bar"&gt;&lt;/span&gt;`
     * where it is expected that `e` has the property named `"foo"` and
     * `e.foo` is another object having the property named `"bar"`.
     *
     * The values of the primary properties of the related elements
     * can be gathered by invoking {@link curateValues}.
     * {@link reflectValues} and {@link curateValues} are used for
     * data synchronization with {@link ObservableObject}.
     * Whenever the `ObservableObject` binding with
     * the target `ProtoViewLogic` is modified,
     * or whenever the other binding targets bound with
     * that `ObservableObject` are modified,
     * the modification result is reflected to the elements related to
     * the target `ProtoViewLogic` by invoking the `ProtoViewLogic`'s
     * `reflectValues()`.
     *
     * @param {({
     *      [element_name: string]: Element | Element[]
     * }) | Promise<({
     *      [element_name: string]: Element | Element[]
     * })>} elementMap
     * an Object representing a set of pairs of names and Elements or
     * names and arrays of Elements.
     * Or a Promise that resolves to one of the aforementioned values.
     *
     * @returns {({
     *      [element_name: string]: Element | Element[]
     * }) | Promise<({
     *      [element_name: string]: Element | Element[]
     * })>}
     * an object containing Elements or arrays of Elements which are not
     * related to the target `ProtoViewLogic`.
     *
     * @throws {TypeError}
     * when the argument `elementMap` is a non-null object
     * but `ProtoViewLogic`
     *
     * @throws {AggregateError}
     * when some of the following errors occur:
     * -    `TypeError`     : when the given argument `elementMap`
     *      has a property whose value is neither an `Element`
     *      nor an array.
     * -    `TypeError`     : when the given argument `elementMap`
     *      has a property whose value is an array but it contains
     *      an entry not being `Element`.
     * -    `SyntaxError`   : when the given argument `elementMap`
     *      has a property whose name is an empty string.
     * -    `SyntaxError`   : when the given argument `elementMap`
     *      has a property whose name contains characters invalid for
     *      an identifier.
     * -    `SyntaxError`   : when the given argument `elementMap`
     *      has a property whose name is duplicated with one of the
     *      target `ProtoViewLogic`'s properties defined in its prototypes.
     * -    `SyntaxError`   : when the given argument `elementMap`
     *      has a property whose name is duplicated with one of the
     *      target `ProtoViewLogic`'s properties used for `ProtoViewLogic`s
     *      or arrays of `ProtoViewLogic`s.
     * -    `ReferenceError`: when the given argument `elementMap`
     *      refers the same Element with two or more different keys
     * -    `ReferenceError`: when the given `Element` has its name
     *      but its owner is not defined
     * -    `ReferenceError`: when the given `Element` has its owner
     *      but its name is not defined
     * -    `ReferenceError`: when the given `Element` refers
     *      a data object not being `ProtoViewLogic` as its owner
     * -    `ReferenceError`: when the given `Element` refers
     *      a `ProtoViewLogic` as its owner but the `ProtoViewLogic` does not
     *      own the `Element`
     *
     * @see
     * - {@link ViewLogic.prototype.collectElements}
     * - {@link ProtoViewLogic.prototype.disrelateElements}
     * - {@link ProtoViewLogic.prototype.getRelatedElements}
     */
    relateElements(elementMap) {
        if (elementMap instanceof Promise) {
            return elementMap.then(element_map => {
                return this.relateElements(element_map);
            });
        }
        //  reject if ProtoViewLogic is given as element map directly
        if (elementMap instanceof ProtoViewLogic) {
            throw new TypeError(`Instance of ${elementMap.constructor.name} is not allowed to be given as a parameter`);
        }

        const RESERVED_NAMES = _getPropertyNames(Object.getPrototypeOf(this));
        const refs           = new WeakMap();
        /**
         * @type {Error[]}
         */
        const errors         = [];

        /**
         * @type {({ [element_name: string]: Element | Element[] })}
         */
        const element_map         = Object.assign(Object.create(null), elementMap);
        /**
         * @type {({ [element_name: string]: Element | Element[] })}
         */
        const disrelated_elements = Object.create(null);
        /**
         * @type {({ [element_name: string]: Element | Element[] })}
         */
        const related_elements    = Object.create(null);
        /**
         * @type {Map<string, string[]>}
         */
        const events_activated = new Map();

        for (const k in element_map) {
            if (!Object.hasOwn(element_map, k)) { continue; }
            if (!_isValidIdentifier(k)) {
                const m      = _matchInvalidIdentifier(k);
                const prefix = m?.prefix;
                const body   = m?.body;
                if (prefix != null && prefix.length === 0) {
                    errors.push(new SyntaxError("Empty string is not allowed to be used as a property name"));
                } else {
                    let error_message = `For property "${k}": Given property name contains characters invalid for an identifier:\n`;
                    if (prefix != null) {
                        error_message += `Invalid prefix found: "${prefix}"\n`;
                    }
                    if (body != null) {
                        error_message += body.map(({ value, index }) => {
                            return `Invalid characters found at (${index}:${index + value.length - 1}): "${value}"`;
                        }).join("\n");
                    }
                    errors.push(new SyntaxError(error_message));
                }
            } else if (RESERVED_NAMES.has(k)) {
                errors.push(new SyntaxError(`For property "${k}": Given property name is reserved`));
            } else if (this.hasOwnChild(this[k])) {
                errors.push(new SyntaxError(`For property "${k}": Given property name is occupied by related ProtoViewLogic(s)`));
            }

            const element_or_array = element_map[k];

            if (this.hasOwnElement(element_or_array)) {
                const target = this[k];

                //  check whether or not element_or_array has the same name as k.
                if ((target === element_or_array) || _isSameArray(target, element_or_array)) {
                    //  already related with the target ProtoViewLogic as the same key.
                    delete element_map[k];
                    continue;
                }
            }

            if (errors.length === 0) {
                if (this[k] instanceof Element) {
                    Object.assign(disrelated_elements, this.disrelateElements(this[k]));
                } else if (Array.isArray(this[k]) && this[k].some(x => (x instanceof Element))) {
                    Object.assign(disrelated_elements, this.disrelateElements(this[k]));
                }
            }

            /**
             * @type {string[]}
             */
            const events_to_be_activated = [];

            if (Array.isArray(element_or_array)) {
                const element_array = element_or_array;

                //  To skip empty slots, use for-in instead of for-of
                for (const i in element_array) {
                    if (!Object.hasOwn(element_array, i)) { continue; }
                    if (!Number.isInteger(Number(i))) { continue; }

                    const element = element_array[i];

                    if (!(element instanceof Element)) {
                        errors.push(new TypeError(`For property "${k}": array entry is not an Element`));
                        continue;
                    } else if (refs.has(element)) {
                        const prev_key = refs.get(element);
                        errors.push(new ReferenceError(`For property "${k}": Given element is already referred as "${prev_key}"`));
                        continue;
                    }

                    refs.set(element, k);

                    /** @type {ProtoViewLogic?} */
                    const prev_owner = element[CustomKeys$ELEMENT_OWNER];

                    /** @type {string?} */
                    const prev_name  = element[CustomKeys$ELEMENT_NAME];

                    if (prev_owner != null) {
                        if (prev_name == null) {
                            errors.push(new ReferenceError(`For property "${k}": Given element has an owner but it has no name`));
                            continue;
                        } else if (!(prev_owner instanceof ProtoViewLogic)) {
                            errors.push(new ReferenceError(`For property "${k}": Given element has an invalid owner`));
                            continue;
                        } else if (!prev_owner.hasOwnElement(element)) {
                            errors.push(new ReferenceError(`For property "${k}": Given element has a ProtoViewLogic as an owner but it does not own the element`));
                            continue;
                        }
                    } else if (prev_name != null) {
                        errors.push(new ReferenceError(`For property "${k}": Given element has a name but it has no owner`));
                        continue;
                    }

                    if (errors.length > 0) {
                        continue;
                    }
                    {
                        //  The dataset property is HTMLElement or SVGElement's property.
                        //  If element is an Element but neither an HTMLElement nor SVGElement,
                        //  element.dataset is undefined and hence you should use
                        //  optional chain operator here.
                        //  NOTE:
                        //  AFAIK, in reality, Element must be either HTMLElement or SVGElement
                        //  and so using optional chain operator may be a little bit pedantic.
                        const dataset_active_events = element.dataset?.activeEvents;
                        if (dataset_active_events != null) {
                            events_to_be_activated.push(...dataset_active_events.split(",").map(s => s.trim()));
                        }
                    }

                    if (prev_owner === this) {
                        //  rename
                        const disrelated_entry = prev_owner.disrelateElements(element)[prev_name];
                        if (Array.isArray(disrelated_entry)) {
                            if (disrelated_elements[prev_name] == null) {
                                disrelated_elements[prev_name] = new Array(disrelated_entry.length);
                            }

                            const dest = disrelated_elements[prev_name];
                            for (const i in disrelated_entry) {
                                dest[i] = disrelated_entry[i];
                            }
                        } else {
                            disrelated_elements[prev_name] = disrelated_entry;
                        }
                    } else if (prev_owner != null) {
                        //  moved from another ProtoViewLogic
                        prev_owner.disrelateElements(element);
                    }

                    //  Update element's owner and element's id.
                    //  These properties are used for identifying whether or not an element
                    //  in question is owned by the target ProtoViewLogic.
                    //  Also, it allows the element to post a message with an event to the owner.
                    //  This is one of crucial functionalities of ProtoViewLogic and this framework.
                    //  NOTE:
                    //  property descriptor is treated as non-writable and non-enumerable by default.
                    element[CustomKeys$ELEMENT_OWNER] = this;
                    element[CustomKeys$ELEMENT_NAME]  = k;
                    element[CustomKeys$ELEMENT_CACHED_INDEX] = Number(i);
                }

                if (errors.length > 0) {
                    continue;
                }

                this[k] = [...element_array];
            } else if (element_or_array instanceof Element) {
                const element = element_or_array;

                if (refs.has(element)) {
                    const prev_key = refs.get(element);
                    errors.push(new ReferenceError(`For property "${k}": Given Element is already referred as "${prev_key}"`));
                    continue;
                }

                refs.set(element, k);

                /** @type {ProtoViewLogic?} */
                const prev_owner = element[CustomKeys$ELEMENT_OWNER];

                /** @type {string?} */
                const prev_name  = element[CustomKeys$ELEMENT_NAME];

                if (prev_owner != null) {
                    if (prev_name == null) {
                        errors.push(new ReferenceError(`For property "${k}": Given element has an owner but it has no name`));
                        continue;
                    } else if (!(prev_owner instanceof ProtoViewLogic)) {
                        errors.push(new ReferenceError(`For property "${k}": Given element has an invalid owner`));
                        continue;
                    } else if (!prev_owner.hasOwnElement(element)) {
                        errors.push(new ReferenceError(`For property "${k}": Given element has a ProtoViewLogic as an owner but it does not own the element`));
                        continue;
                    }
                } else if (prev_name != null) {
                    errors.push(new ReferenceError(`For property "${k}": Given element has a name but it has no owner`));
                    continue;
                }

                if (errors.length > 0) {
                    continue;
                }
                {
                    //  The dataset property is HTMLElement or SVGElement's property.
                    //  If element is an Element but neither an HTMLElement nor SVGElement,
                    //  element.dataset is undefined and hence you should use
                    //  optional chain operator here.
                    //  NOTE:
                    //  AFAIK, in reality, Element must be either HTMLElement or SVGElement
                    //  and so using optional chain operator may be a little bit pedantic.
                    const dataset_active_events = element.dataset?.activeEvents;
                    if (dataset_active_events != null) {
                        events_to_be_activated.push(...dataset_active_events.split(",").map(s => s.trim()));
                    }
                }

                if (prev_owner === this) {
                    //  rename
                    const disrelated_entry = prev_owner.disrelateElements(element)[prev_name];
                    if (Array.isArray(disrelated_entry)) {
                        if (disrelated_elements[prev_name] == null) {
                            disrelated_elements[prev_name] = new Array(disrelated_entry.length);
                        }

                        const dest = disrelated_elements[prev_name];
                        for (const i in disrelated_entry) {
                            dest[i] = disrelated_entry[i];
                        }
                    } else {
                        disrelated_elements[prev_name] = disrelated_entry;
                    }
                } else if (prev_owner != null) {
                    //  moved from another ProtoViewLogic
                    prev_owner.disrelateElements(element);
                }

                //  Update element's owner and element's id.
                //  These properties are used for identifying whether or not an element
                //  in question is owned by the target ProtoViewLogic.
                //  Also, it allows the element to post a message with an event to the owner.
                //  This is one of crucial functionalities of ProtoViewLogic and this framework.
                //  NOTE:
                //  property descriptor is treated as non-writable and non-enumerable by default.
                element[CustomKeys$ELEMENT_OWNER] = this;
                element[CustomKeys$ELEMENT_NAME]  = k;

                this[k] = element;
            } else {
                errors.push(new TypeError(`For property "${k}": Given property has a value being neither an Element nor an array of Elements`));
                continue;
            }

            if (errors.length > 0) {
                continue;
            }

            if (events_to_be_activated.length > 0) {
                const event_activated = this.addActiveEvents(k, ...events_to_be_activated);
                if (event_activated.length > 0) {
                    events_activated.set(k, event_activated);
                }
            }

            related_elements[k] = element_map[k];
            delete element_map[k];
        }

        if (errors.length > 0) {
            //  Restore the previous state wherever possible.
            for (const k in related_elements) {
                const related_element = related_elements[k];
                const events_to_be_inactivated = events_activated.get(k);
                if (events_to_be_inactivated != null) {
                    //  Inactivate event listeners being activated
                    //  during this function call.
                    this.removeActiveEvents(k, ...events_to_be_inactivated);
                }

                //  Disrelate elements being related with the target ProtoViewLogic
                //  during this function call.
                this.disrelateElements(related_element);
            }

            //  Relate elements being disrelated with the target ProtoViewLogic during this function call.
            this.relateElements(disrelated_elements);

            throw _makeFlatAggregateError(errors, "One or more Errors occur");
        }

        this.#onPropertiesModified(related_elements, disrelated_elements);

        return Object.assign(element_map, disrelated_elements);
    }

    /**
     * Disrelates the elements related to the target `ProtoViewLogic`
     * by using {@link relateElements},
     * i.e., deletes the properties having references to those elements
     * from the target `ProtoViewLogic`.
     *
     *
     * @param {Element | Element[] | string | null} relatedElementOrItsName
     * An `Element` or an array of `Element`s,
     * or a string representing a name of the target `ProtoViewLogic`'s
     * property which has an element or an array of elements,
     * or `null`.
     *
     * If `null` is given as this argument,
     * all the target `ProtoViewLogic`s properties referring elements
     * or arrays of elements are to be deleted.
     *
     * If the specific `Element` or an array of `Element`s is given
     * as this argument,
     * the property having a reference to the given `Element` or
     * array of `Element`s is to be deleted from the target `ProtoViewLogic`.
     *
     * If the property name is given as this argument,
     * the property having the same name as the given string which
     * refers to an `Element` or an array of `Element`s
     * is deleted from the target `ProtoViewLogic`.
     *
     * @returns {({ [element_name: string]: Element | Element[] })}
     * A plain object having properties which have the same name and
     * value as the properties deleted from the target `ProtoViewLogic`.
     *
     * @throws {ReferenceError}
     * When
     *
     * -   the target `ProtoViewLogic` did not have the property with
     *     the specified name
     * -   the target `ProtoViewLogic` did not have the given `Element` or
     *     array of `Elements`
     * @throws {TypeError}
     * When
     * -   the given argument {@link relatedElementOrItsName} is
     *     neither one of `null` or a `string` or an array of `Element`
     *     or an `Element`.
     *
     * @see
     * - {@link ProtoViewLogic.prototype.relateElements}
     * - {@link ProtoViewLogic.prototype.removeActiveEvents}
     */
    disrelateElements(relatedElementOrItsName) {

        if (relatedElementOrItsName == null) {
            /**
             * @type {({ [element_name: string]: Element | Element[] })}
             */
            const disrelated_elements = Object.create(null);

            for (const k in this) {
                if (!Object.hasOwn(this, k)) { continue; }

                const v = this[k];
                if (this.#isRelatedElement(v) || this.#isRelatedElementArray(v)) {
                    Object.assign(disrelated_elements, this.disrelateElements(v));
                }
            }

            return disrelated_elements;
        } else if (typeof relatedElementOrItsName === "string") {
            if (Object.hasOwn(this, relatedElementOrItsName)) {
                return this.disrelateElements(this[relatedElementOrItsName]);
            } else {
                throw new ReferenceError(`property "${relatedElementOrItsName}" is not defined on this object`);
            }
        } else if (Array.isArray(relatedElementOrItsName)) {
            if (!this.#isRelatedElementArray(relatedElementOrItsName)) {
                throw new ReferenceError(`${relatedElementOrItsName} is not owned by this ProtoViewLogic`);
            }
        } else if (!(relatedElementOrItsName instanceof Element)) {
            throw new TypeError(`${relatedElementOrItsName} is not an Element`);
        } else if (!this.#isRelatedElement(relatedElementOrItsName)) {
            throw new ReferenceError(`${relatedElementOrItsName} is not owned by this ProtoViewLogic`);
        }

        /**
         * @type {({ [element_name: string]: Element | Element[] })}
         */
        const disrelated_elements = Object.create(null);

        if (this.#isRelatedElementArrayComponent(relatedElementOrItsName)) {
            /**
             * @type {Element}
             */
            const array_component = relatedElementOrItsName;

            /**
             * @type {string}
             */
            const k = array_component[CustomKeys$ELEMENT_NAME];

            if (CustomKeys$ELEMENT_EVENT_LISTENERS in array_component) {
                this.removeActiveEvents(k, ...Object.keys(array_component[CustomKeys$ELEMENT_EVENT_LISTENERS]));
            }

            /**
             * @type {Element[]}
             */
            const target_array = this[k];

            /**
             * @type {Element[]}
             */
            const packed_elements = new Array(target_array.length);

            let index = array_component[CustomKeys$ELEMENT_CACHED_INDEX];
            if (!Number.isInteger(index) || array_component !== target_array[index]) {
                index = target_array.indexOf(array_component);
            }
            packed_elements[index] = array_component;
            delete array_component[CustomKeys$ELEMENT_CACHED_INDEX];
            delete array_component[CustomKeys$ELEMENT_NAME];
            delete array_component[CustomKeys$ELEMENT_OWNER];
            delete target_array[index];

            disrelated_elements[k] = packed_elements;

            let is_empty = true;
            for (const i in target_array) {
                if (Object.hasOwn(target_array, i)) {
                    is_empty = false;
                    break;
                }
            }
            if (is_empty) {
                delete this[k];
            }
        } else if (this.#isRelatedElement(relatedElementOrItsName)) {
            /**
             * @type {Element}
             */
            const related_element = relatedElementOrItsName;

            /**
             * @type {string}
             */
            const k = related_element[CustomKeys$ELEMENT_NAME];

            if (CustomKeys$ELEMENT_EVENT_LISTENERS in related_element) {
                this.removeActiveEvents(k, ...Object.keys(related_element[CustomKeys$ELEMENT_EVENT_LISTENERS]));
            }

            delete related_element[CustomKeys$ELEMENT_NAME];
            delete related_element[CustomKeys$ELEMENT_OWNER];
            disrelated_elements[k] = related_element;

            delete this[k];
        } else {
            /**
             * @type {Element[]}
             */
            const element_array = relatedElementOrItsName;

            /**
             * @type {string}
             */
            const k = element_array[0][CustomKeys$ELEMENT_NAME];

            if (CustomKeys$ELEMENT_EVENT_LISTENERS in element_array[0]) {
                this.removeActiveEvents(k, ...Object.keys(element_array[0][CustomKeys$ELEMENT_EVENT_LISTENERS]));
            }

            /**
             * @type {Element[]}
             */
            const target_array = this[k];

            /**
             * @type {Element[]}
             */
            const packed_elements = new Array(target_array.length);

            for (const element of element_array) {
                let index = element[CustomKeys$ELEMENT_CACHED_INDEX];
                if (!Number.isInteger(index) || element !== target_array[index]) {
                    index = target_array.indexOf(element);
                }
                packed_elements[index] = element;
                delete element[CustomKeys$ELEMENT_CACHED_INDEX];
                delete element[CustomKeys$ELEMENT_NAME];
                delete element[CustomKeys$ELEMENT_OWNER];
                delete target_array[index];
            }
            disrelated_elements[k] = packed_elements;

            let is_empty = true;
            for (const i in target_array) {
                if (Object.hasOwn(target_array, i)) {
                    is_empty = false;
                    break;
                }
            }
            if (is_empty) {
                delete this[k];
            }
        }

        this.#onPropertiesModified(null, disrelated_elements);

        return disrelated_elements;
    }

    /**
     * Add event listeners for the provided event types to an element
     * which is related with the target `ProtoViewLogic`.
     *
     * Each of the listeners posts a message to the owner of the element.
     * The message object has the following properties:
     *
     * -  `id`  : the property name used for referring the element
     *     from its owner.
     * -  `code`: event type of the listener
     * -  `param.event`: event object
     * -  `param.value`: value of event target
     *
     * Also each of listeners prevents to propagate the raised event.
     *
     * If already a listener is set for the given event type,
     * then this function do nothing for that type.
     *
     * @param {string} targetElementName
     * A string representing the target element's name
     *
     * @param  {...string} eventsToBeActivated
     * A list of event types to be activated.
     *
     * @returns {string[]}
     * A list of activated event types.
     *
     * @throws {ReferenceError}
     * When the target element `this[targetElement]` does not exist.
     *
     * @throws {TypeError}
     * When
     *
     * -   the target element is not related with the target ProtoViewLogic.
     * -   the given event type list contains a value not being a string.
     *
     * @see
     * - {@link ProtoViewLogic.prototype.removeActiveEvents}
     * - {@link ProtoViewLogic.prototype.relateElements}
     */
    addActiveEvents(targetElementName, ...eventsToBeActivated) {
        const target_element_name    = targetElementName;
        const events_to_be_activated = eventsToBeActivated;

        if (typeof target_element_name !== "string") {
            throw new TypeError(`${target_element_name} is not a string`);
        } else if (!(target_element_name in this) &&
            !this.#isRelatedElement(this[target_element_name]) &&
            !this.#isRelatedElementArray(this[target_element_name])
        ) {
            throw new ReferenceError(`property "${target_element_name}" is not defined on this object`);
        } else {
            for (const event_name of events_to_be_activated) {
                if (typeof event_name !== "string") {
                    throw new TypeError(`${event_name} is not a string`);
                }
            }
        }

        //  split event types if it contains commas.
        for (let i = events_to_be_activated.length - 1; i >= 0; i--) {
            const event_name = events_to_be_activated[i];
            if (event_name.includes(",")) {
                const event_names = event_name.split(",");
                for (let j = event_names.length - 1; j >= 0; j--) {
                    event_names[j] = event_names[j].trim();
                    if (event_names[j].length === 0) {
                        event_names.splice(j, 1);
                    }
                }
                events_to_be_activated.push(...event_names);
            } else {
                events_to_be_activated[i] = event_name.trim();
                if (events_to_be_activated[i].length === 0) {
                    events_to_be_activated.splice(i, 1);
                }
            }
        }

        //  sort event types and then remove duplicated items.
        events_to_be_activated.sort();
        events_to_be_activated.splice(0, events_to_be_activated.length, ...new Set(events_to_be_activated));

        if (events_to_be_activated.length === 0) {
            return [];
        }

        /**
         * @type {Element[]}
         */
        const target_elements  = (this[target_element_name] instanceof Element) ?
            [this[target_element_name]] :
            this[target_element_name]
        ;
        //  A set of event types which are activated during this function call.
        //  This value is used for the return value of this function.
        const activated_events = new Set();

        for (const element of target_elements) {
            {
                const listeners = element[CustomKeys$ELEMENT_EVENT_LISTENERS];
                //  Initialize the target element. Even if the ELEMENT_EVENT_LISTENERS property of
                //  the target element is already defined, it is overwritten to prevent to cause
                //  unexpected behavior if it is not a non-null object.
                if (listeners == null || typeof listeners !== "object") {
                    element[CustomKeys$ELEMENT_EVENT_LISTENERS] = Object.create(null);
                }
            }

            const listeners = element[CustomKeys$ELEMENT_EVENT_LISTENERS];
            for (const event_type of events_to_be_activated) {
                //  skip if the event is already active.
                if (event_type in listeners) { continue; }

                //  set listener.name as [event_type].
                const listener = {
                    /**
                     * @param {Event} event
                     */
                    [event_type]: async event => {
                        const origin = event.currentTarget;
                        const owner  = ProtoViewLogic.getOwnerOf(origin);
                        if (!(origin === element && owner instanceof ProtoViewLogic)) {
                            return;
                        }
                        const { node, key } = getPrimaryProperty(element);
                        const value = node?.[key] ?? element.value;
                        const msg = {
                            id   : element[CustomKeys$ELEMENT_NAME],
                            code : event_type,
                            param: {
                                event,
                                value
                            },
                            origin
                        };

                        const discardDuplicates = element.getAttribute("duplicate-filter") === "discard";
                        owner.post(msg, { discardDuplicates });
                        event.stopPropagation();
                    }
                }[event_type];

                Object.defineProperty(listeners, event_type, {
                    configurable: true,
                    enumerable  : true,
                    value       : listener
                });

                element.addEventListener(event_type, listener);
                activated_events.add(event_type);
            }

            if (element.dataset != null) {
                //  this will work for both HTMLElement and SVGElement.
                element.dataset.activeEvents = Object.keys(listeners).join(",");
            } else {
                //  this will not be evaluated because Element must be
                //  either HTMLElement or SVGElement in reality.
                element.setAttribute("data-active-events", Object.keys(listeners).join(","));
            }
        }

        //  return a list of activated event types.
        return [...activated_events];
    }

    /**
     * Disable event notifications from the target element related to
     * the target ProtoViewLogic.
     *
     * Each of the event listeners matching one of the given event types
     * is removed from the target element.
     * In addition, the given event types are removed from values of
     * the `data-active-events` custom attribute of the elements.
     *
     * @param {string} targetElementName
     * target element name.
     *
     * @param  {...string} eventsToBeDeactivated
     * a list of types of event listeners to be disabled.
     *
     * @returns {string[]}
     * a list of types of event listeners which are actually disabled.
     *
     * @throws {ReferenceError}
     * when the target element not defined.
     * @throws {TypeError}
     * when the target element is not related to the target ProtoViewLogic.
     * @throws {TypeError}
     * when the given event type list contains a non-string value.
     * @see
     * - {@link ProtoViewLogic.prototype.addActiveEvents}
     * - {@link ProtoViewLogic.prototype.relateElements}
     * - {@link ProtoViewLogic.prototype.disrelateElements}
     */
    removeActiveEvents(targetElementName, ...eventsToBeDeactivated) {
        if (typeof targetElementName !== 'string') {
            throw new TypeError(`${targetElementName} is not a string`);
        } else if (!(targetElementName in this) &&
            !this.#isRelatedElement(this[targetElementName]) &&
            !this.#isRelatedElementArray(this[targetElementName])
        ) {
            throw new ReferenceError(`property "${targetElementName}" is not defined on this object`);
        } else {
            for (const event_name of eventsToBeDeactivated) {
                if (typeof event_name !== "string") {
                    throw new TypeError(`${event_name} is not a string`);
                }
            }
        }

        let targetElement = this[targetElementName];
        if (this.#isRelatedElement(targetElement)) {
            targetElement = [targetElement];
        }

        for (let i = eventsToBeDeactivated.length - 1; i >= 0; i--) {
            const event_name = eventsToBeDeactivated[i];
            if (event_name.includes(",")) {
                const event_names = event_name.split(",");
                for (let j = event_names.length - 1; j >= 0; j--) {
                    event_names[j] = event_names[j].trim();
                    if (event_names[j].length === 0) {
                        event_names.splice(j, 1);
                    }
                }
                eventsToBeDeactivated.push(...event_names);
            } else {
                eventsToBeDeactivated[i] = event_name.trim();
                if (eventsToBeDeactivated[i].length === 0) {
                    eventsToBeDeactivated.splice(i, 1);
                }
            }
        }

        eventsToBeDeactivated.sort();
        eventsToBeDeactivated = [...new Set(eventsToBeDeactivated)];
        if (eventsToBeDeactivated.length === 0) {
            return [];
        }

        /** @type {Set<string>} */
        const deactivatedEvents = new Set();

        for (const element of targetElement) {
            if (typeof element[CustomKeys$ELEMENT_EVENT_LISTENERS] !== 'object' &&
                element[CustomKeys$ELEMENT_EVENT_LISTENERS] === null
            ) {
                delete element[CustomKeys$ELEMENT_EVENT_LISTENERS];
            }
            if (!(CustomKeys$ELEMENT_EVENT_LISTENERS in element)) {
                continue;
            }
            const listeners = element[CustomKeys$ELEMENT_EVENT_LISTENERS];
            for (const event_name in listeners) {
                if (Object.hasOwn(listeners, event_name)) {
                    deactivatedEvents.add(event_name);
                }
            }
            for (const event_name of eventsToBeDeactivated) {
                if (typeof listeners[event_name] !== "function") {
                    continue;
                }
                element.removeEventListener(event_name, listeners[event_name]);
                delete listeners[event_name];
                deactivatedEvents.add(event_name);
            }

            const keys = Object.keys(listeners);
            if (keys.length > 0) {
                element.dataset.activeEvents = keys.join(",");
            } else {
                delete element[CustomKeys$ELEMENT_EVENT_LISTENERS];
                delete element.dataset.activeEvents;
            }
        }

        return [...deactivatedEvents];
    }

    /**
     * Defines a set of UI components.
     *
     * @param {({
     *      [component_name: string]: {
     *          tagName     : string,
     *          value       : string?,
     *          text        : string?,
     *          children    : (Element | string | object)[]?,
     *          primary     : string?,
     *          activeEvents: string[] | string | null,
     *          attributes  : ({ [attribute_name: string]: string | number | boolean | bigint })?
     *      }[] | {
     *          tagName     : string,
     *          value       : string?,
     *          text        : string?,
     *          children    : (Element | string | object)[]?,
     *          primary     : string?,
     *          activeEvents: string[] | string | null,
     *          attributes  : ({ [attribute_name: string]: string | number | boolean | bigint })?
     *      }
     *  })
     * } componentDescriptors
     *
     * A set of descriptors of components.
     *
     * Each of keys represents an identifier of the associated component
     * or the associated group of components,
     *
     * A component descriptor is composed by the following properties:
     *
     * -    `tagName`     :
     *      a string representing a tag name
     * -    `value`       :
     *      a string representing a value of a `value`attribute
     * -    `text`        :
     *      a string representing a text content of the component to
     *      be created.
     *      If `children` is also given, the `text` is treated as
     *      the first node.
     * -    `children`    :
     *       an array of child nodes or descriptors of child nodes of
     *       the component to be created.
     *       If `text` is also given, the `text` is added as a Text node
     *      immediately before the `children`.
     * -    `primary`     :
     *      a string representing the `data-primary` custom data
     *      attribute of the component to be created
     * -    `activeEvents`:
     *      a string or an array of strings representing a set of
     *      event types
     * -    `attributes`  :
     *      an object representing a set of attributes
     *
     * The `value` property precedes the `attributes` property of
     * the same descriptor.
     *
     * The `activeEvents` property is converted into
     * a `data-active-events` attribute and it precedes the `attributes`
     * property of the same descriptor.
     *
     * Note that, the `id` property of the `attributes` is always
     * ignored.
     *
     * @returns {({
     *      [component_name: string]: Element
     * })}
     * A set of components which are not related with
     * the target `ProtoViewLogic`.
     *
     * @throws {TypeError}
     * when the given `componentDescriptors` is not a non-null object.
     *
     * @throws {AggregateError}
     * when an error or multiple of errors are detected.
     *
     * The following errors may be included in the thrown `AggregateError`:
     *
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name]` is not a
     *      non-null object
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].tagName` is not a
     *      string
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].value` is neither null
     *      nor a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].text` is neither null
     *      nor a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].children` is neither
     *      null nor an iterable
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].primary` is neither
     *      null nor a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].activeEvents` is
     *      neither null nor a string nor an iterable
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].attributes` is neither
     *      null nor a non-null object
     * -   `TypeError`: when the given `tagName` is not valid
     * -   `TypeError`: when the given `activeEvents` contains
     *      a non-string entry
     * -   `TypeError`: when the given `activeEvents` contains
     *      an empty or whitespace-only string
     * -   `TypeError`: when the given `attributes` contains a property
     *      named with an empty or whitespace-only string
     * -   `TypeError`: when the given `attributes` contains a property
     *      whose value is `NaN`
     * -   `TypeError`: when the given `attributes` contains a property
     *      whose value is a `Symbol`
     * -   `TypeError`: when the given `attributes` contains a property
     *      whose value is a `function`
     * -   `TypeError`: when the given `children` contains an entry
     *      which is neither an `Element` nor a string nor
     *      a descriptor object
     *
     * @see {@link relateElements}
     * @see {@link createUiComponents}
     */
    defineUiComponents(componentDescriptors) {
        return this.relateElements(ProtoViewLogic.createUiComponents(componentDescriptors));
    }

    /**
     * Creates a set of UI components.
     *
     * @param {({
     *      [component_name: string]: {
     *          tagName     : string,
     *          value       : string?,
     *          text        : string?,
     *          children    : (Element | string | object)[]?,
     *          primary     : string?,
     *          activeEvents: string[] | string | null,
     *          attributes  : ({ [attribute_name: string]: string | number | boolean | bigint })?
     *      }[] | {
     *          tagName     : string,
     *          value       : string?,
     *          text        : string?,
     *          children    : (Element | string | object)[]?,
     *          primary     : string?,
     *          activeEvents: string[] | string | null,
     *          attributes  : ({ [attribute_name: string]: string | number | boolean | bigint })?
     *      }
     *  })
     * } componentDescriptors
     *
     * A set of descriptors of components.
     *
     * Each of keys represents an identifier of the associated component
     * or the associated group of components,
     *
     * A component descriptor is composed by the following properties:
     *
     * -    `tagName`     :
     *      a string representing a tag name
     * -    `value`       :
     *      a string representing a value of a `value` attribute
     * -    `text`        :
     *      a string representing a text content of the component
     *      to be created. If `children` is also given, the `text` is
     *      treated as the first node.
     * -    `children`    :
     *      an array of child nodes or descriptors of child nodes of
     *      the component to be created.
     *      If `text` is also given, the `text` is added as a Text node
     *      immediately before the `children`.
     * -    `primary`     :
     *      a string representing the `data-primary` custom data
     *      attribute of the component to be created
     * -    `activeEvents`:
     *      a string or an array of strings representing
     *      a set of event types
     * -    `attributes`  :
     *      an object representing a set of attributes
     *
     * The `value` property precedes the `attributes` property of
     * the same descriptor.
     *
     * The `activeEvents` property is converted into
     * a `data-active-events` attribute and it precedes the `attributes`
     * property of the same descriptor.
     *
     * Note that, the `id` property of the `attributes` is always
     * ignored.
     *
     * @returns {({
     *      [component_name: string]: Element | Element[]
     * })}
     *
     * an object having component names as its keys and components
     * as the corresponding values.
     *
     * @throws {TypeError}
     * when the given `componentDescriptors` is not a non-null object.
     *
     * @throws {AggregateError}
     * when an error or multiple of errors are detected.
     *
     *  The following errors may be included in the thrown `AggregateError`:
     *
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name]` is not a non-null
     *      object
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].tagName` is not
     *      a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].value` is neither null
     *      nor a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].text` is neither null
     *      nor a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].children` is neither
     *      null nor an iterable
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].primary` is neither
     *      null nor a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].activeEvents` is
     *      neither null nor a string nor an iterable
     * -   `TypeError`: when the given value for
     *     `componentDescriptors[component_name].attributes` is neither
     *      null nor a non-null object
     * -   `TypeError`: when the given `tagName` is not valid
     * -   `TypeError`: when the given `activeEvents` contains
     *      a non-string entry
     * -   `TypeError`: when the given `activeEvents` contains
     *      an empty or whitespace-only string
     * -   `TypeError`: when the given `attributes` contains a property
     *      named with an empty or whitespace-only string
     * -   `TypeError`: when the given `attributes` contains a property
     *      whose value is `NaN`
     * -   `TypeError`: when the given `attributes` contains a property
     *      whose value is a `Symbol`
     * -   `TypeError`: when the given `attributes` contains a property
     *      whose value is a `function`
     * -   `TypeError`: when the given `children` contains an entry
     *      which is neither an `Element` nor a string nor a descriptor
     *      object
     *
     * @see {@link defineUiComponents}
     * @see {@link createElement}
     */
    static createUiComponents(componentDescriptors) {
        const descs = componentDescriptors;
        if (descs === null || typeof descs !== "object") {
            throw new TypeError(`${descs} is not a non-null object`);
        }

        /**
         * @type {{ [component_name: string]: Element | Element[] }}
         */
        const components = Object.create(null);

        /**
         * @type {Error[]}
         */
        const errors = [];
        for (const k in descs) {
            if (!Object.hasOwn(descs, k)) { continue; }

            const desc = descs[k];
            if (Array.isArray(desc)) {
                /** @type {(Element|undefined)[] } */
                const grouped_component = new Array(desc.length);

                for (const i of desc.keys()) {
                    const element_desc = desc[i];
                    try {
                        const component = ProtoViewLogic.createElement(element_desc);
                        if (errors.length === 0) {
                            component.setAttribute("id", `${k}[${i}]`);
                            grouped_component[i] = component;
                        }
                    } catch (e) {
                        errors.push(e);
                    }
                }
                if (errors.length > 0) {
                    continue;
                }

                components[k] = grouped_component;
            } else {
                try {
                    const component = ProtoViewLogic.createElement(desc);
                    if (errors.length === 0) {
                        component.setAttribute("id", k);
                        components[k] = component;
                    }
                } catch (e) {
                    errors.push(e);
                }
            }
        }

        if (errors.length > 0) {
            throw _makeFlatAggregateError(errors, "Given component descriptors have some errors");
        }

        return components;
    }

    /**
     * Create an element.
     *
     * @param {string} id
     * A string representing an identifier of a component to be created.
     *
     * @param {object} componentDescriptor
     * A descriptor object for a component to be created.
     *
     * @param {string} componentDescriptor.tagName
     * A string representing a tag name of a component to be created.
     *
     * @param {string?} componentDescriptor.value
     * An optional string representing the `value` attribute's value of
     * a component to be created.
     *
     * @param {string?} componentDescriptor.text
     * An optional string representing the first node of a component
     * to be created.
     *
     * @param {(Element | string | object )[]?} componentDescriptor.children
     * An optional array of compound of `Element`s or strings
     * or descriptors.
     * It represents a list of child nodes of a component to be created.
     *
     * If the given list contains descriptors, associated elements are
     * created by applying the `ProtoViewLogic.createElement` to them
     * recursively.
     *
     * @param {string?} componentDescriptor.primary
     * An optional string representing the `data-primary` custom data
     * attribute's value of a component to be created.
     *
     * @param {(string[] | string)?} componentDescriptor.activeEvents
     * An optional array of strings or string representing
     * the `data-active-events` custom data attribute's value of
     * a component to be created.
     *
     * If this argument is an array of strings, each of strings is
     * joined with its neighbor by a comma.
     *
     * @param {({
     *      [attribute_name: string]: string | number | boolean | bigint
     * })?} componentDescriptor.attributes
     * An optional object representing a set of attributes of
     * a component to be created.
     *
     * @returns {HTMLElement}
     * An UI component.
     *
     * @throws {AggregateError}
     * when an error or multiple of errors are detected.
     *
     * The following errors may be included in the thrown `AggregateError`:
     *
     * -   `TypeError`: when the given argument for
     *     `componentDescriptor` is not a non-null object
     * -   `TypeError`: when the given value for
     *     `componentDescriptor.tagName` is not a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptor.value` is neither null nor a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptor.text` is neither null nor a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptor.children` is neither null nor an iterable
     * -   `TypeError`: when the given value for
     *     `componentDescriptor.primary` is neither null nor a string
     * -   `TypeError`: when the given value for
     *     `componentDescriptor.activeEvents` is neither null nor
     *     a string nor an iterable
     * -   `TypeError`: when the given value for
     *     `componentDescriptor.attributes` is neither null nor
     *     a non-null object
     * -   `TypeError`: when the given `tagName` is not valid
     * -   `TypeError`: when the given `activeEvents` contains
     *     a non-string entry
     * -   `TypeError`: when the given `activeEvents` contains
     *     an empty or whitespace-only string
     * -   `TypeError`: when the given `attributes` contains a property
     *     named with an empty or whitespace-only string
     * -   `TypeError`: when the given `attributes` contains a property
     *     whose value is `NaN`
     * -   `TypeError`: when the given `attributes` contains a property
     *     whose value is a `Symbol`
     * -   `TypeError`: when the given `attributes` contains a property
     *     whose value is a `function`
     * -   `TypeError`: when the given `children` contains an entry
     *     which is neither an `Element` nor a string nor
     *     a descriptor object
     */
    static createElement(componentDescriptor) {
        const tag_name      = componentDescriptor?.tagName;
        const value         = componentDescriptor?.value;
        const text          = componentDescriptor?.text;
        const children      = componentDescriptor?.children;
        const primary       = componentDescriptor?.primary;
        const active_events = componentDescriptor?.activeEvents;
        const attributes    = componentDescriptor?.attributes;

        {
            const validation_errors = [];

            if (componentDescriptor === null || typeof componentDescriptor !== "object") {
                validation_errors.push(new TypeError(`Given componentDescriptor (${componentDescriptor}) is not a non-null object`));
            }
            if (typeof tag_name !== "string") {
                validation_errors.push(new TypeError(`Given tagName (${tag_name}) is not a string`));
            }
            if (value != null && typeof value !== "string") {
                validation_errors.push(new TypeError(`Given value (${value}) is neither null nor a string`));
            }
            if (text != null && typeof text !== "string") {
                validation_errors.push(new TypeError(`Given text (${text}) is neither null nor a string`));
            }
            if (children != null &&
                !(typeof children === "object" && typeof children[Symbol.iterator] === "function")
            ) {
                validation_errors.push(new TypeError(`Given children (${children}) is neither null nor an iterable`));
            }
            if (primary != null && typeof primary !== "string") {
                validation_errors.push(new TypeError(`Given primary (${primary}) is neither null nor a string`));
            }
            if (active_events != null &&
                typeof active_events !== "string" &&
                !(typeof active_events === "object" && typeof active_events[Symbol.iterator] === "function")
            ) {
                validation_errors.push(new TypeError(`Given activeEvents (${active_events}) is neither null, a string, nor an iterable`));
            }
            if (attributes != null && typeof attributes !== "object") {
                validation_errors.push(new TypeError(`Given attributes (${attributes}) is neither null nor a non-null object`));
            }

            if (validation_errors.length > 0) {
                throw _makeFlatAggregateError(validation_errors, "Given component descriptor contains one or more TypeErrors");
            }
        }

        //  To detect maximal errors at once, errors are not thrown immediately after catching or
        //  creating them. Hence, gradual type-hinting won't work as expected here.
        //  This seems not to be harmful because your linter always tells you wider type than
        //  the actual type.
        //  However, you have to check whether or not the list of errors is empty before doing
        //  something for normal scenarios.
        const eval_errors = [];

        let component = null;
        try {
            //  The createOptions argument for createElement is not supported by Safari,
            //  so to keep portability against other platforms, we won't use the createOptions here.
            component = document.createElement(tag_name);
        } catch (e) {
            eval_errors.push(new TypeError(`Given tagName (${tag_name}) is not a valid tag name`, { cause: e }));
        }

        const active_events_arr = typeof active_events === "string" ?
            active_events.split(" ") :
            active_events
        ;

        /** @type {Map<string, string>} */
        const attribute_map = new Map();

        if (attributes !== null && typeof attributes === "object") {

            for (const attribute_name in attributes) {
                if (!Object.hasOwn(attributes, attribute_name)) { continue; }
                const attribute_value = attributes[attribute_name];
                const attribute_name_ = attribute_name.trim();

                if (attribute_name_.length === 0) {
                    eval_errors.push(new TypeError(`Given attributes contains an attribute named with an empty or whitespace-only string: "${attribute_name}"`));
                }
                if (typeof attribute_value === "symbol") {
                    eval_errors.push(new TypeError(`Given attributes contains a symbol as "${attribute_name_}"'s value: ${attribute_value.toString()}`));
                } else if (typeof attribute_value === "function") {
                    eval_errors.push(new TypeError(`Given attributes contains a function as "${attribute_name_}"'s value: ${attribute_value}`));
                } else if (Number.isNaN(attribute_value)) {
                    eval_errors.push(new TypeError(`Given attributes contains not a number as "${attribute_name_}"'s value`));
                }

                if (eval_errors.length > 0) {
                    continue;
                }

                const attribute_value_ = attribute_value == null ?
                    "" :
                    typeof attribute_value === "object" ?
                    JSON.stringify(attribute_value) :
                    String(attribute_value)
                ;

                attribute_map.set(attribute_name_, attribute_value_);
            }
        }
        if (Array.isArray(active_events_arr)) {
            const used = new Set();

            for (const i of active_events_arr.keys()) {
                const event_kind = active_events_arr[i];
                if (typeof event_kind !== "string") {
                    const suffix = ["th", "st", "nd", "rd", "th"][Math.min(i % 10, 4)];
                    eval_errors.push(new TypeError(`The ${i + suffix} entry of the given activeEvents is a non string entry: ${event_kind}`));
                    continue;
                }
                const kind = event_kind.trim().toLowerCase();

                if (kind.length === 0) {
                    const suffix = ["th", "st", "nd", "rd", "th"][Math.min(i % 10, 4)];
                    eval_errors.push(new TypeError(`The ${i + suffix} entry of the given activeEvents is an empty or whitespace-only string: "${event_kind}"`));
                    continue;
                }

                if (eval_errors.length > 0) {
                    continue;
                }

                used.add(kind);
            }

            if (eval_errors.length === 0) {
                attribute_map.set("data-active-events", [...used].sort().join(","));
            }
        }

        if (children != null) {
            const children_ = [...children];
            for (const i of children_.keys()) {
                const child = children_[i];
                if (typeof child === "string" || (child instanceof Element)) { continue; }
                if (child === null || typeof child !== "object") {
                    const suffix = ["th", "st", "nd", "rd", "th"][Math.min(i % 10, 4)];
                    eval_errors.push(new TypeError(`The ${i + suffix} entry of the given children is neither a string nor an Element nor a valid descriptor: ${child}`));
                    continue;
                }
                try {
                    children_[i] = ProtoViewLogic.createElement(child);
                } catch (e) {
                    eval_errors.push(e);
                }
            }
            if (eval_errors.length === 0) {
                component.append(...children_);
            }
        }

        if (eval_errors.length > 0) {
            throw _makeFlatAggregateError(eval_errors, "One or more errors are found during parsing the given descriptor");
        }

        attribute_map.set("data-ui-component", "");
        if (primary != null) {
            attribute_map.set("data-primary", primary);
        }

        for (const [k, v] of attribute_map) {
            component.setAttribute(k, v);
        }
        if (value != null) {
            component.setAttribute("value", value);
            if ("value" in component) {
                component.value = value;
            }
        }

        if (text != null) {
            component.prepend(text);
        }

        return component;
    }

    /**
     * Gets an object representing relationship with the owner of
     * the given element.
     *
     * @param {Element} element
     * The element to inspect.
     *
     * @returns {({
     *  owner: ProtoViewLogic,
     *  name : string,
     *  index: number?
     * } | {})}
     * an object representing relationship with its owner.
     */
    static getRelationshipOf(element) {
        const owner = ProtoViewLogic.getOwnerOf(element);
        return owner != null ? {
                owner,
                name : element[CustomKeys$ELEMENT_NAME],
                index: element[CustomKeys$ELEMENT_CACHED_INDEX]
            } :
            {}
        ;
    }

    /**
     * Gets an owner of the given element.
     *
     * @param {Element} element
     * the target element
     *
     * @returns {ProtoViewLogic | undefined}
     * The owner of the given element if exists.
     * Otherwise, `undefined`.
     */
    static getOwnerOf(element) {
        return element?.[CustomKeys$ELEMENT_OWNER];
    }

    /**
     * @async
     *
     * A callback function invoked when the target `ProtoViewLogic`'s `parent`
     * has been changed.
     *
     * This function sends a message to the target `ProtoViewLogic` from itself.
     *
     * The message id is set to `"vl$connectionChanged"`.
     * Details of the change of the target's state is described in
     * the `param` property of the message.
     *
     * The `param` property is an object having the following properties:
     *
     * -   `state`    : `"connected" | "moved" | "disconnected"`
     *     -   a string representing how is the target changed.
     *         Each of values represents the following cases:
     *         -   `"connected"`   : the target has no parent previously
     *         -   `"disconnected"`: the target has no parent currently,
     *         -   `"moved"`       : the target's parent is changed,
     * -   `oldParent`: `ProtoViewLogic?`
     *     -   the `ProtoViewLogic` previously connected as the target's
     *         parent.
     *         This is given as the parameter of the callback.
     * -   `oldName`  : `string?`
     *     -   a string representing the target's name previously
     *         assigned to.
     *         This is given as the parameter of the callback.
     * -   `newParent`: `ProtoViewLogic?`
     *     -   the `ProtoViewLogic` newly connected as the target's parent.
     *         This is given as the parameter of the callback.
     * -   `newName`  : `string?`
     *     -   a string representing the target's name newly assigned to.
     *         This is given as the parameter of the callback.
     *
     * @param {ProtoViewLogic | null} oldParent
     * the `ProtoViewLogic` previously connected as the target's parent.
     *
     * @param {string | null} oldName
     * a string representing the target's name previously assigned to.
     *
     * @param {ProtoViewLogic | null} newParent
     * the `ProtoViewLogic` newly connected as the target's parent.
     *
     * @param {string | null} newName
     * a string representing the target's name newly assigned to.
     *
     * @returns
     * result of `post` function.
     *
     * @see
     * - {@link parent}
     * - {@link relateViewLogics}
     * - {@link disrelateViewLogics}
     */
    async #onConnectionChanged(oldParent, oldName, newParent, newName) {
        const state = (
            oldParent == null ?
                "connected" :
            newParent != null ?
                "moved" :
                "disconnected"
        );

        return this.post(
            this.message("vl$connectionChanged", null, {
                state,
                oldParent,
                oldName,
                newParent,
                newName
            })
        );
    }

    /**
     * @async
     *
     * A callback function invoked when `Element`s added to or removed
     * from the target `ProtoViewLogic`'s properties.
     *
     * This function sends a message to the target `ProtoViewLogic` from
     * itself.
     *
     * The message id is set to `"vl$propertiesModified"`.
     * Details of the change of the target's state is described in the
     * `param` property of the message.
     *
     * The `param` property is an object having the following properties:
     *
     * -   {@link addedProperties}  :
     *    `({ [property_name: string]: Element | Element[] | ProtoViewLogic | ProtoViewLogic[] })?`
     *     -   An object having `Element`s or `ProtoViewLogic`s newly added
     *         as the target's properties.
     *         This is given as the parameter of the callback.
     * -   {@link removedProperties}:
     *     `({ [element_name: string]: Element | Element[] | ProtoViewLogic | ProtoViewLogic[] })?`
     *     -   An object having `Element`s or `ProtoViewLogic`s removed
     *         from the target's properties.
     *         This is given as the parameter of the callback.
     *
     * @param {({
     *      [property_name: string]: (
     *          Element     |
     *          Element[]   |
     *          ProtoViewLogic   |
     *          ProtoViewLogic[]
     *      )
     * })?} addedProperties
     * An object having `Element`s or `ProtoViewLogic`s newly added as
     * the target's properties.
     *
     * @param {({
     *      [property_name: string]: (
     *          Element     |
     *          Element[]   |
     *          ProtoViewLogic   |
     *          ProtoViewLogic[]
     *      )
     * })?} removedProperties
     * An object having `Element`s or `ProtoViewLogic`s removed from
     * the target's properties.
     *
     * @returns {Promise<boolean>}
     * result of {@link post} function.
     *
     * @see
     * - {@link relateElements}
     * - {@link disrelateElements}
     * - {@link relateViewLogics}
     * - {@link disrelateViewLogics}
     */
    async #onPropertiesModified(addedProperties, removedProperties) {
        //  Create copies of the given objecst to prevent to cause a spooky action at a distance
        //  by modifying the given object directly.
        const added_props = isEmpty(addedProperties) ?
            null :
            Object.assign(Object.create(null), addedProperties)
        ;
        const removed_props = isEmpty(removedProperties) ?
            null :
            Object.assign(Object.create(null), removedProperties)
        ;

        return this.post(
            this.message("vl$propertiesModified", null, {
                addedProperties  : added_props,
                removedProperties: removed_props
            })
        );
    }

    /**
     * ProtoViewLogic's name
     *
     * @type {string | null}
     * @see {@link ProtoViewLogic.prototype.name}
     */
    #name = null;

    /**
     * ProtoViewLogic's parent.
     *
     * @type {ProtoViewLogic?}
     * @see {@link ProtoViewLogic.prototype.parent}
     */
    #parent = null;

    /**
     * A dictionary mapping a pair of id and code to a message being processed.
     *
     * @type {Map<string, Map<string, Messenger>>}
     */
    #messages = new Map();

    /**
     * Tests whether or not the given element is related to
     * the target ProtoViewLogic.
     *
     * @param {*} o object to be tested
     * @returns {boolean} `true` if the given element is related to
     * the target ProtoViewLogic, `false` otherwise.
     */
    #isRelatedElement(o) {
        return (o instanceof Element) &&
            o[CustomKeys$ELEMENT_OWNER] === this
        ;
    }

    /**
     * Tests whether or not the given element array is related to
     * the target ProtoViewLogic.
     * @param {*} o object to be tested
     * @returns {boolean} `true` if the given array is related to
     * the target ProtoViewLogic, `false` otherwise.
     */
    #isRelatedElementArray(o) {
        return Array.isArray(o) &&
            o.length > 0 &&
            o.every(x => this.#isRelatedElement(x))
        ;
    }

    /**
     * Tests whether or not the given element is a component of
     * the array related to the target element.
     *
     * @param {*} o object to be tested
     * @returns {boolean} `true` if the given element is a component of
     * the array related to the target ProtoViewLogic, `false` otherwise.
     */
    #isRelatedElementArrayComponent(o) {
        return this.#isRelatedElement(o) &&
            Array.isArray(this[o[CustomKeys$ELEMENT_NAME]]) &&
            this[o[CustomKeys$ELEMENT_NAME]].includes(o)
        ;
    }

    /**
     * Parses the given 'id' attribute and returns a sequence of
     * property names.
     *
     * @param {string} id
     * Value of the 'id' attribute of an HTML element.
     *
     * @returns {string[]}
     * a sequence of property names.
     */
    static #parseId(id) {
        // The id attribute may have Base64 sequence as a value.
        // If it is Base64 sequence, decode it before going next lines.
        const m = id.match(/%.{0,2}/g);
        if (Array.isArray(m) && m.every(x => x.length === 3 && !Number.isNaN(Number(x.replace("%", "0x"))))) {
            id = decodeURIComponent(id);
        }

        // Converts kebab-case string to camelCase as with custom data attributes.
        if (id.includes("-")) {
            const words = id.split(/-+/);
            for (let i = words.length - 1; i >= 0; i--) {
                const w = words[i];
                if (w === "") continue;
                words[i] = w[0].toUpperCase() + w.slice(1).toLowerCase();
            }
            words[0] = words[0].toLowerCase();
            id = words.join("");
        }

        /**
         * Split the given string into an array of property keys by the following steps:
         *
         * 1.  Move the last pointer to the next separator
         * 2.  Slice the string from the first pointer to the last pointer
         * 3.  Move the first pointer to the next to the last pointer
         * 4.  Do step-1 to step-3 recursively while the last pointer reaches the end of the string.
         */
        id += "\0";  // Append null character as a sentinel.
        /** @type {string[]} */
        const path = [];
        let first = 0, last = 0;
        for (; last < id.length; last++) {
            switch (id[last]) {
                case ".":
                case "[":
                case "]":
                case "\0": {
                    if (first < last) {
                        const prop = id.slice(first, last).trim(); // (2)
                        if (prop.length > 0) {
                            path.push(prop);
                        }
                    }
                    first = last + 1;  // (3)
                }
                    break;
                default:
                    //  do nothing if id[last] is not a separator.
                    break;
            }
        }
        return path;
    }
}

class Messenger {
    /**
     * Origin of the target message.
     * @type {ProtoViewLogic | null}
     */
    get origin() {
        return this.#origin;
    }

    /**
     * The first recipient of the target message.
     * @type {ProtoViewLogic | null}
     */
    get target() {
        return this.#target;
    }

    /**
     * The primary key used for invoking handler functions.
     *
     * @type {string}
     * @see
     * -  {@link code}
     * -  {@link deliver()}
     */
    get id() {
        return this.#id;
    }

    /**
     * The secondary key used for invoking handler functions.
     *
     * @type {string}
     * @see
     * -  {@link id}
     * -  {@link deliver()}
     */
    get code() {
        return this.#code;
    }

    /**
     * An optional parameters being able to be used in handler functions.
     * @type {any}
     */
    get param() {
        return this.#param;
    }

    /**
     * An key to be used in the next invocation of {@link deliver()} function.
     *
     * @type {string}
     */
    get nextKey() {
        return this.#key_kind === "id" ? this.#id : this.#code;
    }

    /**
     * Gets a promise settled when the target message is delivered.
     *
     * @returns {Promise<boolean>}
     * a `Promise<boolean>` settled when the target message is delivered,
     * or a `Promise<undefined>` if the target message is not delivered.
     *
     * @see
     * -  {@link deliver()}
     */
    async waitUntilDelivered() {
        return this.#delivered;
    }

    /**
     * @constructor
     * @param {object} o
     * A message to deliver.
     *
     * @param {object?} o.origin
     * The origin of the given message.
     *
     * @param {string?} o.id
     * The primary key used for invoking handler functions.
     *
     * @param {string?} o.code
     * The secondary key used for invoking handler functions.
     *
     * @param {any?} o.param
     * Optional parameters used in handler functions.
     *
     * @param {object?} o.target
     * The original recipient of the given message.
     *
     * @throws {TypeError}
     * -  when the given `o.origin` is neither a `ProtoViewLogic` nor `null`
     * -  when the given `o.id` is not a string
     * -  when the given `o.code` is not a string
     */
    constructor(o) {
        if (new.target !== Messenger) {
            throw new SyntaxError("Inheritance is not allowed");
        }

        const   {
            origin: o$origin,
            target: o$target,
            id    : o$id,
            code  : o$code,
            param : o$param,
            ...rest
        } = o ?? {};
        const   origin_ = o$origin ?? null,
                target_ = o$target ?? null,
                id_     = o$id     ?? "default",
                code_   = o$code   ?? "default",
                param_  = o$param  ?? null
        ;

        if (origin_ != null && typeof origin_ !== "object") {
            throw new TypeError(`${origin_} is neither null nor an object`);
        } else if (target_ != null && typeof target_ !== "object") {
            throw new TypeError(`${target_} is neither null nor an object`);
        } else if (typeof id_ !== "string") {
            throw new TypeError(`${id_} is not a string`);
        } else if (typeof code_ !== "string") {
            throw new TypeError(`${code_} is not a string`);
        }

        //  copy the rest of the given properties into the messenger.
        for (const key in rest) {
            //  to prevent unexpected overriding / overwriting existing
            //  properties, test whether or not the given key is already
            //  used.
            if (key in this) { continue; }

            //  set optional property.
            this[key] = rest[key];
        }

        this.#origin   = origin_;
        this.#target   = target_;
        this.#id       = id_;
        this.#code     = code_;
        this.#param    = param_;
        this.#key_kind = id_ != null ? "id" : "code";
        this.#delivered = Promise.resolve(undefined);
    }

    /**
     * Delivers the target message to the one of the given handler
     * functions if any of keys match the {@link nextKey}.
     *
     * This function modifies the result of {@link waitUntilDelivered()}
     * against the target message.
     * After this function is called, `waitUntilDelivered()` returns
     * a `Promise` settled when the handler function is done.
     *
     * Note that this function has a side-effect which switches
     * the `nextKey` value from an {@link id} to a {@link code}
     * and vice versa,
     * if the message is consumed by the handler function.
     * Where "consumed" means that a handler function was invoked
     * and it returned `true` or a non-boolean value.
     *
     * @param {({
     *      [handler_name: string]: (message: Messenger) => boolean
     * })} handlerMap
     * An object maps a string to a handler function.
     *
     * @returns {Promise<boolean>}
     * A `Promise` that resolves to a boolean which indicates
     * whether or not the target message has been consumed.
     * `true` if the message has been consumed, `false` otherwise.
     *
     * Whether or not the message has been consumed is determined by
     * what the invoked handler function returns.
     * If the handler has returned a non-boolean value, it is treated as
     * `true`, otherwise, the returned value is used as-is.
     * In addition, if the handler has returned a `Promise`,
     * this function awaits that the promise is settled.
     *
     * @see
     * -  {@link deliverById()}
     * -  {@link deliverByCode()}
     * -  {@link waitUntilDelivered()}
     */
    async deliver(handlerMap) {
        const   prev        = this.#key_kind;
        const   [key, next] = prev === "id" ?
            [ this.id  , "code"]  :
            [ this.code, "id"]
        ;

        this.#key_kind = next;

        const consumed = await this.#deliverImpl(key, handlerMap);

        if (!consumed) {
            this.#key_kind = prev;
        }

        return consumed;
    }

    /**
     * Delivers the target message to the one of the given handler
     * functions if any of keys match the {@link id}.
     *
     * This function modifies the result of {@link waitUntilDelivered()}
     * against the target message.
     * After this function is called, `waitUntilDelivered()` returns
     * a `Promise` settled when the handler function is done.
     *
     * Unlike {@link deliver()} function, this function has
     * no side-effect.
     *
     * @param {({
     *      [handler_name: string]: (message: Messenger) => boolean
     * })} handlerMap
     * An object maps a string to a handler function.
     *
     * @returns {Promise<boolean>}
     * A `Promise` that resolves to a boolean which indicates
     * whether or not the target message has been consumed.
     * `true` if the message has been consumed, `false` otherwise.
     *
     * Whether or not the message has been consumed is determined by
     * what the invoked handler function returns.
     * If the handler has returned a non-boolean value, it is treated as
     * `true`, otherwise, the returned value is used as-is.
     * In addition, if the handler has returned a `Promise`,
     * this function awaits that the promise is settled.
     *
     * @see
     * -  {@link deliver()}
     * -  {@link deliverByCode()}
     * -  {@link waitUntilDelivered()}
     */
    deliverById(handlerMap) {
        return this.#deliverImpl(this.#id, handlerMap);
    }

    /**
     * Delivers the target message to the one of the given handler
     * functions if any of keys match the {@link code}.
     *
     * This function modifies the result of {@link waitUntilDelivered()}
     * against the target message.
     * After this function is called, `waitUntilDelivered()` returns
     * a `Promise` settled when the handler function is done.
     *
     * Unlike {@link deliver()} function, this function has
     * no side-effect.
     *
     * @param {({
     *      [handler_name: string]: (message: Messenger) => boolean
     * })} handlerMap
     * An object maps a string to a handler function.
     *
     * @returns {Promise<boolean>}
     * A `Promise` that resolves to a boolean which indicates
     * whether or not the target message has been consumed.
     * `true` if the message has been consumed, `false` otherwise.
     *
     * Whether or not the message has been consumed is determined by
     * what the invoked handler function returns.
     * If the handler has returned a non-boolean value, it is treated as
     * `true`, otherwise, the returned value is used as-is.
     * In addition, if the handler has returned a `Promise`,
     * this function awaits that the promise is settled.
     *
     * @see
     * -  {@link deliver()}
     * -  {@link deliverById()}
     * -  {@link waitUntilDelivered()}
     */
    deliverByCode(handlerMap) {
        return this.#deliverImpl(this.#code, handlerMap);
    }

    /**
     * @param {string} key
     * @param {({
     *      [handler_name: string]: (message: Messenger) => boolean
     * })} handlerMap
     */
    #deliverImpl(key, handlerMap) {
        const   handler_map = handlerMap,
                key_        = key
        ;

        if (handler_map === null || typeof handler_map !== "object") {
            throw new TypeError(`${handler_map} is not a non-null object`);
        } else if (typeof key_ !== "string") {
            throw new TypeError(`${key_} is not a string`);
        }

        let   resolve,
              reject
        ;
        /**
         * @type {Promise<boolean>}
         */
        const delivered = new Promise((resolve_, reject_) => {
            resolve = resolve_;
            reject  = reject_;
        });
        const prev_delivered = this.#delivered;

        this.#delivered = delivered.then(async consumed => {
            const prev_consumed = await prev_delivered;
            return prev_consumed !== undefined ?
                consumed || prev_consumed :
                consumed
            ;
        });

        const handler = (
            Object.hasOwn(handler_map, key_) ?
                handler_map[key_] :
            Object.hasOwn(handler_map, "default") ?
                handler_map.default :
                null
        );

        if (typeof handler !== "function") {
            resolve(false);
            return delivered;
        }

        let consumed;
        try {
            consumed = handler.call(handler_map, this);
        } catch(e) {
            reject(e);
            return delivered;
        }

        if (consumed instanceof Promise) {
            consumed.then(
            (result) => {
                resolve(typeof result !== "boolean" || result);
                return result;
            },
            (error) => {
                reject(error);
                throw error;
            });
        } else {
            resolve(typeof consumed !== "boolean" || consumed);
        }

        return delivered;
    }

    #origin;
    #target;
    #id;
    #code;
    #param;
    #key_kind;
    /**
     * @type {Promise<boolean | undefined>}
     */
    #delivered;
};

export { ProtoViewLogic };
