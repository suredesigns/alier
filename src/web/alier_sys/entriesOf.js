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
 * @template K
 * @template V
 * Iterates entries of the given object.
 * 
 * @param {Iterable<[K, V]> | {[s: string]: V } } o 
 * A set of entries to iterate.
 * 
 * @throws {TypeError} when
 * -    the given value `o` is not a non-null object
 * -    the given object `o` contains an item not a non-null object
 * -    the given object `o` contains an item not an iterable
 */
export default function* entriesOf(o) {
    if (o === null || typeof o !== "object") {
        throw new TypeError("'o' is not a non-null object");
    }

    if (typeof o[Symbol.iterator] === "function") {
        /** @type {Iterable<[K, V]>} */
        const entries = o;
        for (const entry of entries) {
            if (entry === null || typeof entry !== "object") {
                throw new TypeError("Given object contains an item not a non-null object");
            }
            if (typeof entry[Symbol.iterator] !== "function") {
                throw new TypeError("Given object contains an item not an iterable");
            }
            yield entry;
        }
    } else {
        for (const k in o) {
            if (!Object.hasOwn(o, k)) { continue; }
            /** @type {[string, V]} */
            const entry = [k, o[k]];
            yield entry;
        }
    }
}
