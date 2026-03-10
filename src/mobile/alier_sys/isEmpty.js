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
 * Tests whether or not the given object is empty.
 * 
 * Note that non-enumerable properties and properties inherited from
 * prototypes are ignored.
 *  
 * @param {unknown} o 
 * A value to test.
 * 
 * @returns {boolean}
 * `true` if the given value is not an object or an empty object,
 * `false` otherwise.
 */
export default function isEmpty(o) {
    switch (typeof o) {
        case "string":
            return o.length <= 0;
        case "function":
        case "object": {
            if (o == null) {
                return true;
            } else if (Array.isArray(o)) {
                return o.length <= 0 || o.every(() => false);
            } else if (typeof o[Symbol.iterator] === "function") {
                for (const _ of o) {
                    return false;
                }
                return true;
            } else {
                for (const k in o) {
                    if (Object.hasOwn(o, k)) {
                        return false;
                    }
                }
                return true;
            }
        }
        default:
            return true;
    }
}
