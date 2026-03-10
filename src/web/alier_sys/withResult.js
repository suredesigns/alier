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

const _WITH_RESULT_MARK = Symbol();

/**
 * @template {unknown} This
 * @template Params
 * @template T 
 * @param {This extends object ?
 *    (this: This, ...args: Params) => T
 *  : ((...args: Params) => T)
 * } fn 
 * @returns {This extends object ?
 *    (this: This, ...args: Params) => (
 *      T extends Promise<infer U> ?
 *            Promise<{ ok: U } | { error: unknown }>
 *          : { ok: T } | { error: unknown }
 *    )
 *  : (...args: Params) => (
 *      T extends Promise<infer U> ?
 *            Promise<{ ok: U } | { error: unknown }>
 *          : { ok: T } | { error: unknown }
 *    )
 * }
 */
export default function withResult(fn) {
    if (typeof fn !== "function") {
        throw new TypeError("'fn' is not a function");
    } else if (_WITH_RESULT_MARK in fn) {
        return fn;
    }

    const name = fn.name ?? "";
    const length = fn.length;
    
    const fn_ = function(...args) {
        let ok;
        try {
            ok = fn.apply(this, args);
        } catch (error) {
            return { error };
        }
        return ok instanceof Promise ?
            ok.then(ok => ({ ok }), error => ({ error })) :
            { ok }
        ;
    };
    Object.defineProperties(fn_, {
        name: {
            value: name
        },
        length: {
            value: length
        },
    });

    fn_[_WITH_RESULT_MARK] = null;

    return fn_;
};
