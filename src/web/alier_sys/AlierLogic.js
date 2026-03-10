/*
Copyright 2025 Suredesigns Corp.

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
import { ViewLogic } from "./ViewLogic.js";


class AlierLogic extends AlierCustomElement {

    /**
     * Shows the container currently attached.
     *
     * This function do nothing if there is no container attached or the container is already visible.
     *
     * @see
     * - {@link AlierView.prototype.attach}
     * - {@link AlierLogic.prototype.show}
     */
    show() {
        const container = this.logic?.container;
        
        if (container == null || container.style.visibility === "visible") {
            return;
        }
        container.style.visibility = "visible";
    }
    
    /**
     * Hides the container of the `ViewLogic` currently attached.
     * 
     * This function do nothing if there is no `ViewLogic` attached or the container has already been hidden.
     *
     * @see
     * - {@link AlierView.prototype.attach}
     * - {@link AlierLogic.prototype.show}
     */
    hide() {
        const container = this.logic?.container;
        if (container == null || container.style.visibility === "hidden") {
            return;
        }

        container.style.visibility = "hidden";
    }
    /**
     * Post a message to the ViewLogic attached to this AlierLogic.
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
     * @param {object?} message.origin
     * The original sender of the message.
     *
     * @param {object} options
     * A collection of optional arguments.
     * 
     * @param {boolean} options.discardDuplicates
     * A boolean indicating whether or not to discard a message if duplicated.
     * Duplicates are discarded if the parameter is `true`.
     * 
     * By default, this parameter is set to `false`.
     * 
     * @returns {Promise<boolean>}
     * A `Promise` that resolves to a boolean which indicates whether or
     * not the posted message has been consumed.
     *
     * @see
     * - {@link ProtoViewLogic.post}
     */
    post(message, options) {
        //  post() is invoked only if this.logic is not null.
        return this.logic?.post(message, options) ?? Promise.resolve(false);
    }

    /**
     * Broadcasts a message to the ViewLogic attached to this AlierLogic.
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
     * @param {object?} message.origin
     * The original sender of the message.
     *
     * @returns {Promise<boolean>}
     * A `Promise` that resolves to a boolean which indicates whether or
     * not the posted message has been consumed.
     *
     * @see
     * - {@link ProtoViewLogic.broadcast}
     */
    broadcast(message) {
        //  broadcast() is invoked only if this.logic is not null.
        return this.logic?.broadcast(message) ?? Promise.resolve(false);
    }
    
    /**
     * `ViewLogic` attached to this `AlierLogic`.
     * 
     * @type {ViewLogic | null}
     * @see
     * - {@link AlierView.prototype.attach}
     */
    get logic() {
        return this[AlierLogic._protected.logic];
    }

    static _protected = {
        logic: Symbol("AlierLogic#logic"),
        shadowRoot: Symbol("AlierLogic#shadowRoot"),
    };


    constructor() {
        super();
        Object.defineProperty(this, AlierLogic._protected.logic, { 
            writable: true, enumerable: false, configurable: false 
        });
        Object.defineProperty(this, AlierLogic._protected.shadowRoot, { 
            writable: true, enumerable: false, configurable: false 
        });

        this.initialize();
    }


    /**
     * @override
     */
    onInitialize(shadowRoot) {
        this[AlierLogic._protected.shadowRoot] = shadowRoot;
        this[AlierLogic._protected.shadowRoot].adoptedStyleSheets = [ AlierLogic.#styleSheet ];
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.#connected) {
            this.onFirstConnection();
            this.#connected = true;
        }   
    }

    onFirstConnection() {
        this.style.display = "block";
    }

    /** { @type {boolean} } */
    #connected = false;

    /**
     * @param {boolean} global
     * If true, the stylesheet will also be applied to the entire document by updating `document.adoptedStyleSheets`. 
     * 
     * @param {string[]} cssfiles 
     * An array of css file paths to be set as the stylesheet of this AlierLogic. 
     * 
     * @returns {Promise<CSSRule[]>}
     * A Promise enveloping an array of `CSSRule` objects representing the rules in the newly set stylesheet.
     * 
     * @throws {TypeError}
     * when any element in given `cssfiles` is not a string.
     */
    static async setStyleSheets(global, ...cssfiles)  {

        const sheets = await Promise.all(
            cssfiles.map(async link => {
                if (typeof link !== "string") {
                    throw new TypeError(`Invalid path: ${link}`);
                }
                const rule = await Alier.Sys.loadText(link);
                return new CSSStyleSheet().replace(rule);
            })
        );

        AlierLogic.adoptedStyleSheets = sheets;
        AlierLogic.#recentGlobal = this.adoptedStyleSheets;

        const cleaned = document.adoptedStyleSheets.filter(
            s => !AlierLogic.#recentGlobal.includes(s)
        );
        const updated = [...cleaned, AlierLogic.#styleSheet];
        document.adoptedStyleSheets = global ? updated : cleaned;
        
        return Array.from(AlierLogic.#styleSheet.cssRules);
    }

    static #StyleSheetsToString(sheets) {
        const merged = sheets.map(sheet => {
            return Array.from(sheet.cssRules).map(rule => rule.cssText).join("\n");
        });
        return merged.join("\n");
    }

    /**
     * @type {CSSStyleSheet[]}
     */
    static #adoptedStyleSheets = [];

    static get adoptedStyleSheets() {
        return AlierLogic.#adoptedStyleSheets;
    }
    static set adoptedStyleSheets(sheets) {
        AlierLogic.#adoptedStyleSheets.length = 0;
        AlierLogic.#adoptedStyleSheets.push(...sheets);
        AlierLogic.#styleSheet.replaceSync(AlierLogic.#StyleSheetsToString(sheets));
    }
    
    /**
     * @type {CSSStyleSheet[]}
     */
    static #recentGlobal = [];

    /** 
     * @type {CSSStyleSheet}
     */
    static #styleSheet = new CSSStyleSheet();

}

export { AlierLogic };
