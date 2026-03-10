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
 * A helper function for implementing data-binding functionality.
 *
 * Gets the primary property of the given `Element`.
 *
 * "the primary property" is defined as a property indicated
 * by the `data-primary` attribute of the element.
 *
 * The value of a `data-primary` attribute is expected to be a string
 * representing a sequence of property names separated by dots
 * such as `"foo.bar.baz"`.
 * If the `data-primary` attribute is empty or undefined,
 * the property `value` is treated as the primary property.
 *
 * e.g. let `el` is an element with a `data-primary` attribute
 * whose value is set to `"foo.bar"`,
 * then `el.foo.bar` (or `el["foo"]["bar"]`) is assumed to be
 * the primary property of `el`.
 * In this case, if `el.foo` is either undefined or not an object,
 * the primary property is treated as undefined.
 *
 * @param {Element} element
 * An element to be examined whether or not it has the primary property.
 *
 * @returns {({
 *      node: { [key: string]: any } | undefined,
 *      key: string
 * })}
 * a pair of a node having the primary property and its key.
 * the property `node` of the returned object is `undefined`
 * when there is no such a node.
 *
 */
export default function getPrimaryProperty(element) {
    if (!(element instanceof HTMLElement)) {
        throw new TypeError(`${element} is not an instance of ${HTMLElement.name}`);
    }
    const primary = element.dataset.primary;
    if (primary == null || primary === "") {
        const key = "value";
        return key in element ?
            ({ node: element  , key: key }) :
            ({ node: undefined, key: key })
        ;
    } else {
        const key_seq = primary.split(".");
        /** @type {string} */
        const last_key = key_seq.pop();
        /** @type {object} */
        let node = element;
        for (const key of key_seq) {
            if (node === null || typeof node !== "object" || !(key in node)) {
                return ({ node: undefined, key: key });
            }
            node = node[key];
        }
        return (
            (node !== null && typeof node === "object" && (last_key in node)) ?
                ({ node: node,      key: last_key }) :
                ({ node: undefined, key: last_key })
        );
    }
}
