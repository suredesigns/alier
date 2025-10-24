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
import { ViewLogic } from "./ViewLogic.js";

const _shadowRootKey = Symbol("AlierView#shadowRoot");

class AlierView extends AlierCustomElement {
    static tagName = "alier-view";

    static attachShadowOptions = {
        mode: "closed"
    };

    /**
     * Attaches the target {@link ViewLogic} to this AlierView.
     *
     * @param {ViewLogic} containerToBeAttached
     * A ViewLogic to be attached
     * 
     * @returns
     * detached ViewLogic if it was previously attached, `null` otherwise.
     * 
     * @throws {TypeError} 
     * -  when the given object is not a ViewLogic
     * @see 
     * - {@link AlierView.prototype.detach}
     * - {@link AlierView.prototype.show}
     * - {@link ViewLogic.attachTo}
     */
    attach(containerToBeAttached) {
        const vl = containerToBeAttached;

        if (!(vl instanceof ViewLogic)) {
            throw new TypeError(`${vl} is not a ${ViewLogic.name}`);
        } else if (vl.host === this) {
            return null;
        }
        
        const detached_container = this.detach();

        this.#container = vl;
        ViewLogic.attachTo(vl, this);

        const attached_container = this.#container;
        this[_shadowRootKey].append(attached_container.styles, attached_container.container);

        this.show();

        return detached_container;
    }
    
    /**
     * Detaches the attached {@link ViewLogic} from this AlierView.
     *
     * @returns
     * detached ViewLogic if it was attached, `null` otherwise.
     * 
     * @see
     * - {@link AlierView.prototype.attach}
     * - {@link AlierView.prototype.hide}
     * - {@link ViewLogic.detachFrom}
     */
    detach() {
        const detached_container = this.#container;
        if (detached_container == null) {
            return null;
        }

        this.#container = null;

        ViewLogic.detachFrom(detached_container, this);

        return detached_container;
    }
    
    /**
     * Shows the contents currently attached.
     *
     * This function do nothing if there is no contents attached or the contents is already visible.
     *
     * @see
     * - {@link AlierView.prototype.attach}
     * - {@link AlierView.prototype.show}
     */
    show() {
        const contents = this.#container?.container;
        if (contents == null || contents.style.visibility === "visible") {
            return;
        }

        contents.style.visibility = "visible";
    }
    
    /**
     * Hides the contents currently attached.
     *
     * This function do nothing if there is no contents attached or the contents is already hidden.
     *
     * @see
     * - {@link AlierView.prototype.attach}
     * - {@link AlierView.prototype.show}
     */
    hide() {
        const contents = this.#container?.container;
        if (contents == null || contents.style.visibility === "hidden") {
            return;
        }

        contents.style.visibility = "hidden";
    }

    /**
     * Post a message to the ViewLogic attached to this AlierView.
     *
     * @param {Object} msg
     * @param {string?} msg.id
     * The primary identifier of the message.
     *
     * @param {string?} msg.code
     * The secondary identifier of the message.
     *
     * @param {any?} msg.param
     * An optional parameter object of the message.
     *
     * @param {ProtoViewLogic} msg.origin
     * The original sender of the message.
     *
     * @returns {Promise<boolean>}
     * A Promise enveloping a boolean which indicates whether or not the posted message has been consumed.
     *
     * @see
     * - {@link ProtoViewLogic.post}
     */
    post(msg) {
        if (this.#container != null) {
            return this.#container.post(msg);
        }
    }
    
    /**
     * `ViewLogic` attached to this `AlierView`.
     * 
     * @type {ViewLogic | null}
     * @see
     * - {@link AlierView.prototype.attach}
     */
    get container() {
        return this.#container;
    }

    /**
     * @override
     */
    onInitialize(shadowRoot) {
        this[_shadowRootKey] = shadowRoot;
        this[_shadowRootKey].adoptedStyleSheets = [ AlierView.#styleSheet ];
    }

    constructor() {
        super();
        this.initialize();
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

    #connected = false;

    /**
     * @param {boolean} global
     * If true, the stylesheet will also be applied to the entire document by updating `document.adoptedStyleSheets`. 
     * 
     * @param {string[]} cssfiles 
     * An array of css file paths to be set as the stylesheet of this AlierView. 
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

        this.adoptedStyleSheets = sheets;
        this.#recentGlobal = this.adoptedStyleSheets;

        const cleaned = document.adoptedStyleSheets.filter(
            s => !this.#recentGlobal.includes(s)
        );
        const updated = [...cleaned, this.#styleSheet];
        document.adoptedStyleSheets = global ? updated : cleaned;
        
        return Array.from(AlierView.#styleSheet.cssRules);
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
        return this.#adoptedStyleSheets;
    }
    static set adoptedStyleSheets(sheets) {
        this.#adoptedStyleSheets.length = 0;
        this.#adoptedStyleSheets.push(...sheets);
        this.#styleSheet.replaceSync(this.#StyleSheetsToString(sheets));
    }
    
    /**
     * @type {CSSStyleSheet[]}
     */
    static #recentGlobal = [];

    /** 
     * @type {CSSStyleSheet}
     */
    static #styleSheet = new CSSStyleSheet();

    /**
     * @type {ShadowRoot}
     */
    [_shadowRootKey];
    
    /**
     * @type {ViewLogic | null}
     */
    #container = null;
}

AlierView.use();

export { AlierView };
