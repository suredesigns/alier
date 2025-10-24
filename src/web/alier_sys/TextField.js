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

import { AlierCustomElement, html } from "./AlierCustomElement.js";

/**
 * @template T
 * @typedef PropertyDescriptor<T>
 * @property {T} default
 * @property {string} attribute
 * @property {boolean} boolean
 * @property {(attrVal: string) => T} asProp
 * @property {(propVal: T) => string} asAttr
 * @property {(target: AlierTextField, value: T) => boolean} validate
 * @property {(target: AlierTextField, oldValue: T, newValue: T) => void} onChange
 */

/**
 * @typedef {Object.<string, PropertyDescriptor<*>>} PropertyDescriptors
 */

class AlierTextField extends AlierCustomElement {
    static tagName = "alier-textfield";

    static attachShadowOptions = { mode: "closed", delegatesFocus: true };

    static formAssociated = true;

    /**
     * @type {PropertyDescriptors}
     */
    static propertyDescriptors = {
        type: {
            default: "text",
            validate: (_target, value) => {
                const candidates = ["text", "multilines", "url", "email", "tel"];
                return candidates.includes(value);
            },
        },
        autocapitalize: {
            validate: (_target, value) => {
                const candidates = [
                    "none", "off", "sentences", "on", "words", "characters"
                ];
                return candidates.includes(value);
            },
        },
        autocomplete: {},
        disabled: {
            boolean: true,
            default: false,
        },
        inputMode: {
            validate: (_target, value) => {
                return ["none", "text", "tel", "email", "url"].includes(value);
            },
        },
        maxLength: {
            validate: (_target, value) => Number.isSafeInteger(value),
            asProp: (attrVal) => {
                if (attrVal === null) {
                    return -1;
                }
                const num = Number.parseInt(attrVal);
                return Number.isSafeInteger(num) ? num : 0;
            },
            asAttr: (propVal) => propVal < 0 ? null : String(propVal),
        },
        minLength: {
            validate: (_target, value) => Number.isSafeInteger(value),
            asProp: (attrVal) => {
                if (attrVal === null) {
                    return -1;
                }
                const num = Number.parseInt(attrVal);
                return Number.isSafeInteger(num) ? num : 0;
            },
            asAttr: (propVal) => propVal < 0 ? null : String(propVal),
        },
        pattern: {
            default: "",
            validate: (_target, value) => {
                return value === null || typeof value === "string";
            },
            asProp: (attrVal) => {
                return attrVal === null ? "" : attrVal;
            },
        },
        placeholder: {
            default: "",
            validate: (_target, value) => {
                return value === null || typeof value === "string";
            },
            asProp: (attrVal) => {
                return attrVal === null ? "" : attrVal;
            },
        },
        readOnly: {
            boolean: true,
            default: false,
        },
        rows: {
            default: 2,
            validate: (_target, value) => {
                return Number.isSafeInteger(value) && value > 0;
            },
            asProp: (attrVal) => {
                const num = Number.parseInt(attrVal)
                return num > 0 ? num : 2;
            },
        },
        size: {
            default: 20,
            validate: (_target, value) => {
                return Number.isSafeInteger(value) && value > 0;
            },
            asProp: (attrVal) => {
                const num = Number.parseInt(attrVal)
                return num > 0 ? num : 20;
            },
        },
        spellcheck: {
            validate: (_target, value) => typeof value === "boolean",
            asProp: (attrVal) => attrVal === "" || attrVal === "true",
        },
        name: {
            default: "",
            validate: (_target, value) => typeof value === "string",
        },
        required: {
            boolean: true,
            default: false,
        },
        value: {
            default: "",
            attribute: "",
            noSync: true,
            validate: (_target, value) => typeof value === "string",
        },
    };

    /** @type {ShadowRoot} */
    #shadowRoot;

    /** @type {ElementInternals} */
    #internals;

    /** @type {string} */
    #defaultValue;

    static styles = `
        :host {
            height: fit-content;
            width: calc(11em + 2 * var(--alier-padding, 0em));
        }
        :host(:not([hidden])) {
            display: inline-block;
        }
        .control {
            mergin: 0;
            min-height: 1rem;
            height: 100%;
            width: 100%;
            vertical-align: middle;
            box-sizing: border-box;
        }
    `;

    constructor() {
        super();

        // temporary solution
        this.initialize();
    }

    onInitialize(shadowRoot, elementInternals) {
        this.#shadowRoot = shadowRoot;
        this.#internals = elementInternals;

        if (!this.hasAttribute("data-active-events")) {
            this.setAttribute("data-active-events", "change,invalid");
        }

        this.#defaultValue = this.innerText;
        this.value = this.#defaultValue;
    }

    render(it) {
        this.#updateValidity();

        const changeListener = (_event) => {
            this.#updateValidity()
            this.#internals.setFormValue(this.value);

            const newEvent = new CustomEvent("change", {
                detail: { value: this.value },
                bubbles: false,
                composed: false,
            });
            this.dispatchEvent(newEvent);
        };

        const selectListener = (_event) => {
            const newEvent = new CustomEvent("select", {
                bubbles: false,
                composed: false,
            });
            this.dispatchEvent(newEvent);
        };

        const singleline = () => {
            return html`
                <input
                    id="control"
                    class="control"
                    part="control"
                    type=${it.type}
                    .value=${it.value}
                    autocapitalize=${it.autocapitalize}
                    autocomplete=${it.autocomplete}
                    ?disabled=${it.disabled}
                    inputmode=${it.inputMode}
                    maxlength=${it.maxLength}
                    minlength=${it.minLength}
                    pattern=${it.pattern}
                    placeholder=${it.placeholder}
                    ?readonly=${it.readOnly}
                    ?required=${it.required}
                    size=${it.size}
                    spellcheck=${it.spellcheck}
                    @change=${changeListener}
                    @select=${selectListener}
                >
            `;
        };

        const multilines = () => {
            return html`
                <textarea
                    id="control"
                    class="control"
                    part="control"
                    .value=${it.value}
                    autocapitalize=${it.autocapitalize}
                    autocomplete=${it.autocomplete}
                    cols=${it.size}
                    ?disabled=${it.disabled}
                    maxlength=${it.maxLength}
                    minlength=${it.minLength}
                    placeholder=${it.placeholder}
                    ?readonly=${it.readOnly}
                    ?required=${it.required}
                    rows=${it.rows}
                    spellcheck=${it.spellcheck}
                    @change=${changeListener}
                    @select=${selectListener}
                ></textarea>
            `;
        };

        return html`${this.type === "multilines" ? multilines() : singleline()}`;
    }

    /**
     * @returns {HTMLInputElement|HTMLTextAreaElement|null}
     */
    #getCurrentControl() {
        return this.#shadowRoot?.querySelector("#control") ?? null;
    }

    #updateValidity() {
        const internals = this.#internals;
        if (!this.willValidate) {
            internals.setValidity({});
            return;
        }

        const { valid: internalsValid, customError } = internals.validity;
        if (!internalsValid && customError) {
            return;
        }

        const control = this.#getCurrentControl();
        if (control != null && !control.validity.valid) {
            internals.setValidity(
                control.validity, control.validationMessage, control
            );
            return;
        }

        internals.setValidity({});
    }

    /**
     * Related labels.
     * @readonly
     * @type {NodeList}
     */
    get labels() {
        return this.#internals.labels;
    }

    /**
     * The direction of the selection.
     * @type {"forward" | "backward" | "none" | null}
     */
    get selectionDirection() {
        const control = this.#getCurrentControl();
        return control?.selectionDirection ?? null;
    }

    /**
     * @param {"forward" | "backward" | "none"} newValue
     */
    set selectionDirection(newValue) {
        const control = this.#getCurrentControl();
        if (control != null) {
            control.selectionDirection = newValue;
        }
    }

    /**
     * The index following the last character of the selected text.
     * @type {number | null} non negative integer.
     */
    get selectionEnd() {
        const control = this.#getCurrentControl();
        return control?.selectionEnd ?? null;
    }

    /**
     * @param {number} newValue non negative integer.
     */
    set selectionEnd(newValue) {
        const control = this.#getCurrentControl();
        if (control != null) {
            control.selectionEnd = newValue;
        }
    }

    /**
     * The start index of the selected text.
     * @type {number | null} non negative integer.
     */
    get selectionStart() {
        const control = this.#getCurrentControl();
        return control?.selectionStart ?? null;
    }

    /**
     * @param {number} newValue non negative integer.
     */
    set selectionStart(newValue) {
        const control = this.#getCurrentControl();
        if (control != null) {
            control.selectionStart = newValue;
        }
    }

    /**
     * Select text in the control.
     */
    select() {
        const control = this.#getCurrentControl();
        control?.select();
    }

    /**
     * Replace selected text to given text.
     * @param {string} replacement - Replacement text.
     * @param {number} [start]
     * The word index of the start character to replacement.
     * If not, use selectionStart property.
     * @param {number} [end]
     * The next index of the end character to replacement.
     * If not, use selectionEnd property.
     * @param {"select" | "start" | "end" | "preserve"} [selectMode]
     * How to set the selection after replacement.
     * Defaults to "preserve".
     */
    setRangeText(replacement, start, end, selectMode) {
        const control = this.#getCurrentControl();
        control?.setRangeText(replacement, start, end, selectMode);
    }

    /**
     * Set the selection.
     * @param {number} start - The index of the start character.
     * @param {number} end - The next index of the end character.
     * @param {"forward" | "backward" | "none"} [direction]
     * Direction of the selection. Defaults to "none".
     */
    setSelectionRange(start, end, direction) {
        const control = this.#getCurrentControl();
        control?.setSelectionRange(start, end, direction);
    }

    /**
     * The default value of this input control.
     * @type {string}
     */
    get defaultValue() {
        return this.#defaultValue;
    }
}

AlierTextField.use();

export { AlierTextField };
