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
 * Tests whether or not the given two values are equivalent.
 * 
 * @param {any} x 
 * The left hand side term of comparision.
 * 
 * @param {any} y 
 * The right hand side term of comparision.
 * 
 * @param {WeakMap<object, WeakSet<object>>} refs 
 * A WeakMap used to detec circular references.
 * 
 * @returns {boolean}
 * `true` if the two values are equivalent, `false` otherwise.
 */
export default function isEquivalent(x, y, refs = new WeakMap()) {
    if (x === null || typeof x !== "object" ||
        y === null || typeof y !== "object"
    ) {
        //  x is primitive, or
        //  y is primitive
        return Object.is(x, y);
    }

    if (x === y) {
        //  x and y have the same object.
        return true;
    } else if (Array.isArray(x) !== Array.isArray(y)) {
        //  x is an array but y is not, or
        //  x is not an array but y is.
        return false;
    }

    let ref_x = refs.get(x);
    if (ref_x == null) {
        ref_x = new WeakSet();
        ref_x.add(y);
        refs.set(x, ref_x);
    } else if (ref_x.has(y)) {
        //  x and y have already been compared.
        return undefined;
    } else {
        ref_x.add(y);
    }

    let ref_y = refs.get(y);
    if (ref_y == null) {
        ref_y = new WeakSet();
        ref_y.add(x);
        refs.set(y, ref_y);
    } else if (ref_y.has(x)) {
        //  x and y have already been compared.
        //  result of this comparison is depending on the results of
        //  comparisons on the other properties.
        return undefined;
    } else {
        ref_y.add(x);
    }

    const keys = new Set([ ...Object.keys(x), ...Object.keys(y) ]);

    for (const k of keys) {
        //  compare() will return true, false, or undefined.
        if (isEquivalent(x[k], y[k], refs) === false) {
            //  x is not equivalent to y.
            return false;
        }
    }

    //  x is equivalent to y.
    return true;
}
