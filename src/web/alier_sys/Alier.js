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
 * @file
 * If import this, the following effects occur:
 *
 * - Assign `Alier` object to global
 * - Define following custom elements
 *   - alier-view
 *   - alier-list-view
 *   - alier-container
 * - Assign `AlierView` object to global
 */

import "./_dependency_Web.js";
import "./_AlierCore.js";

import { AlierView } from "./AlierView.js";
import { ListView } from "./ListView.js";
import "./AlierText.js";
import "./AlierButton.js";
import "./TextField.js";
import "./Checkbox.js";
import "./AlierSlider.js";

// ViewLogic.js:546
// In `ViewLogic.attachTo`, check that new host is the instance of `AlierView`.
Object.assign(globalThis, { AlierView });

const defineIfNotDefined = (tag, ctor, options = undefined) => {
    if (customElements.get(tag) === undefined) {
        customElements.define(tag, ctor, options);
    }
};

defineIfNotDefined("alier-view", AlierView);
defineIfNotDefined("alier-list-view", ListView);
defineIfNotDefined("alier-container", class ContainerView extends HTMLElement {});

let running_task = null;

/**
 * Start user application after the DOM content is loaded.
 *
 * @async
 *
 * @param {string} mainScriptPath
 * The path to a script, which has a main function as the entrypoint to
 * the user application.
 *
 * If given a relative path, resolve with document url.
 *
 * The main function should export as default.
 * The main function can be thenable.
 * @param {...any} args
 * Pass to the main function.
 * @returns {Promise<any>}
 * Resolve with the main function.
 */
export default async function appStart(mainScriptPath, ...args) {
    if (typeof mainScriptPath !== "string") {
        throw new TypeError(`first parameter is not a string: ${typeof mainScriptPath}`);
    }

    const canonical_url = new URL(mainScriptPath, document.baseURI).pathname

    /**
     * @typedef {object} MainModule
     * @property {(...args: any) => any | Promise<any>} default
     */

    /**
     * @type {MainModule}
     */
    const { default: main } = await import(canonical_url);
    if (typeof main !== "function") {
        throw new TypeError(`\
            default export from the main script path is not a function, \
            type: ${typeof main}\
        `.replace(/\ {4}/g, ""));
    }

    if (document.readyState === "loading") {
        await new Promise((resolve) => {
            document.addEventListener("DOMContentLoaded", resolve, { once: true });
        });
    }

    if (running_task instanceof Promise) {
        await running_task;
    }

    let resolve,
        reject
    ;
    /** @type {Promise<any>} */
    const result = new Promise((resolve_, reject_) => {
        resolve = resolve_;
        reject  = reject_;
    });

    running_task = result;

    queueMicrotask(async () => {
        const AsyncFunction          = (async function(){}).constructor;
        const GeneratorFunction      = (function*(){}).constructor;
        const AsyncGeneratorFunction = (async function*(){}).constructor;

        let last_state = null;
        try {
            switch (main.constructor) {
                case AsyncFunction: {
                    last_state = await main(...args);
                }
                break;
                case AsyncGeneratorFunction: {
                    for await (const curr_state of main(...args)) {
                        last_state = curr_state;
                    }
                }
                break;
                case GeneratorFunction: {
                    for (const curr_state of main(...args)) {
                        last_state = curr_state;
                    }
                }
                break;
                default:
                    last_state = main(...args);
            }
            resolve(last_state);
        } catch (e) {
            reject(e);
        } finally {
            running_task = null;
        }
    });

    return result;
}
