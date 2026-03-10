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
import getPrimaryProperty from "./getPrimaryProperty.js";

/**
 * @typedef {import("./ObservableValue.js").ObservableValue} ObservableValue
 */

/**
 * @class
 *
 * Base class for UI elements, such as button, text input, etc.
 *
 * UI elements that inherit this can bind with `ObservableValue`.
 * When the value of the bound `ObservableValue` is updated, the "primary property"
 * of the element is also updated.
 * The "primary property" indicates the element's main value.
 * You can specify the primary property's key name using the 'data-primary` attribute.
 * If the `data-primary` attribute does not exist, it defaults to the `value` property.
 *
 * @see {@link AlierCustomElement}
 * @see {@link ObservableValue}
 */
class AlierUiElement extends AlierCustomElement {
    /**
     * Callback by `ObservableValue.bindData()`.
     * This should implement at least the following features:
     *
     * - Assign the object passed as an argument to the `source` property
     * - Ensure that when the primary property is updated, `source.setValue()` is
     * called to update the source object's value.
     *
     * @param {{setValue: (newValue: string) => void}} source
     * The source object to observe.
     *
     * @see {@link ObservableValue}
     */
    onDataBinding(source) {
        if (!("setValue" in source) || typeof source.setValue !== "function") {
            throw TypeError("source object must have `setValue` function");
        }

        const original_source = this.source;
        this.source = source;

        if (original_source) {
            return;
        }

        const { node, key } = this.#getPrimary();
        if (node == null) {
            const primary_key = this.dataset.primary ?? "value";
            throw Error(`Not found the primary property: ${primary_key}`);
        }

        /** @type {PropertyDescriptor} */
        let desc;
        for (
            let proto = node;
            proto != null;
            proto = Object.getPrototypeOf(proto)
        ) {
            desc = Object.getOwnPropertyDescriptor(proto, key);
            if (desc) {
                break;
            }
        }

        let value = node[key];
        const getter =
            desc.get ??
            function () {
                return this === node ? value : undefined;
            };
        const set =
            desc.set ??
            ((v) => {
                value = v;
            });
        const element = this;
        const setter = function (newValue) {
            if (this !== node) {
                return;
            }

            const old_value = node[key];
            set.call(node, newValue);
            const current_value = node[key];
            if (old_value === current_value) {
                return;
            }

            if (element.source != null) {
                try {
                    element.source.setValue(current_value);
                } catch (err) {
                    const primary_key = element.dataset.primary ?? "value";
                    throw Error(
                        `Failed to call \`source.setValue()\` for ${primary_key} property`,
                        { cause: err },
                    );
                }
            }
        };

        Object.defineProperty(node, key, { get: getter, set: setter });
    }

    /**
     * Get the value of the primary property.
     * @returns {any}
     */
    getValue() {
        const { node, key } = this.#getPrimary();
        if (node == null) {
            return undefined;
        }
        return node[key];
    }

    /**
     * Set the value to the primary property.
     * @param {any} incomingValue To be updated.
     */
    setValue(incomingValue) {
        const { node, key } = this.#getPrimary();
        if (node == null) {
            return false;
        }
        const oldValue = node[key];

        node[key] = incomingValue;
        const newValue = node[key];

        return oldValue !== newValue;
    }

    #getPrimary() {
        return getPrimaryProperty(this);
    }
}

export { AlierUiElement };
export { html, listener } from "./AlierCustomElement.js";
