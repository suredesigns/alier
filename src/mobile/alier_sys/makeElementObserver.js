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

import getPrimaryProperty from "./getPrimaryProperty.js";

/**
 * @typedef {import("./ObservableValue.js").ObservableValue} ObservableValue
 */

/**
 * Assign required functions to a standard element to enable binding to `ObservableValue`.
 * @param {HTMLElement} element Target to bind `ObservableValue`.
 * @returns {HTMLElement} The original element that can be bound to `ObservableValue`.
 * @see {@linkcode ObservableValue}
 */
export default function makeElementObserver(element) {
    if (!(element instanceof HTMLElement)) {
        throw TypeError(`element must be a HTMLElement: ${element}`);
    }

    const { node, key } = getPrimaryProperty(element);
    if (node == null) {
        throw Error(`Not found the primary property: ${key}`);
    }

    /**
     * @this {HTMLElement}
     * @param {{ setValue: (v: any) => void }} source Binding source.
     */
    element.onDataBinding = function (source) {
        if (!("setValue" in source) || typeof source.setValue !== "function") {
            throw TypeError(
                `source.setValue must be a function: ${typeof source.setValue}`,
            );
        }

        const original_source = this.source;
        this.source = source;
        if (original_source) {
            return;
        }

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

        const setter = function (new_value) {
            if (this !== node) return;

            set.call(this, new_value);

            if (element.source) {
                return element.source.setValue(this[key]);
            }

            return true;
        };

        Object.defineProperty(node, key, { get: getter, set: setter });
    };

    element.getValue = function () {
        return node[key];
    };

    element.setValue = function (newValue) {
        node[key] = newValue;
    };

    return element;
}
