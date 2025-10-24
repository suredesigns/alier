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

class AlierCheckBox extends AlierCustomElement {

    static tagName = "alier-checkbox";
    static formAssociated = true;
    static attachShadowOptions = {
        mode: "closed",
        delegatesFocus: true,
    };


    /**
     * @type {ElementInternals}
     */
    #internals;


    /**
     * @type {ShadowRoot}
     */
    #shadowRoot;


    static propertyDescriptors = {
        checked: {
            boolean: true,
            default: false,
            onChange: (target, oldValue, newValue) => {
                target.#updateValidity();
            },
        },
        disabled: {
            boolean: true,
            default: false,
        },
        name: {
            default: "",
            validate: (_target, value) => typeof value === "string",
        },
        value: {
            default: "on",
            validate: (_target, value) => typeof value === "string",
            onChange: (target, oldValue, newValue) => {
                target.#updateValidity();
            },
        },
        required: {
            boolean: true,
            default: false,
            onChange: (target, oldValue, newValue) => {
                target.#updateValidity();
            }
        },
        labelPosition: {
            default: "",
            attribute: "label-position",
            validate: (target, value) => {
                const candidates = ["reverse", "bottom"];
                return candidates.includes(value);
            },
        },
        variant: {
            default: "check",
            validate: (target, value) => {
                const candidates = ["check", "slash", "dot", "switch", "tag", "img", "heart", "star", "bell"];
                return candidates.includes(value);
            },
            onChange: (target, oldValue, newValue) => {
                target.#renderIcon();
            },
        },
        animation: {
            default: "fade",
            validate: (_target, value) => {
                const candidates = ["none", "fade", "swing", "ripples", "flipX", "flipY"]
                const regex = new RegExp(`^(?:${candidates.join('|')})(?: (?:${candidates.join('|')}))*$`);
                return regex.test(value);
            },
            onChange: (target, oldValue, newValue) => {
                target.#renderIcon();
            }
        },
        round: {
            boolean: true,
            default: false,
        },
        srcChecked: {
            default: "",
            attribute: "src",
            validate: (_target, value) => typeof value === "string",
        },
        srcUnchecked: {
            default: "",
            attribute: "src-unchecked",
            validate: (_target, value) => typeof value === "string",
        }

    };

    static styles = `
            :host {
                cursor: pointer;
                user-select: none;
                display: inline-block;

                --alier-cb-size: 0.85em;
                --alier-cb-radius: calc(var(--alier-border-radius, 20px) * 0.2);
                --alier-cb-background: transparent;
                --alier-cb-background-checked: var(--alier-accent-col, #678);
                --alier-cb-symbol-color: var(--alier-bg-col, white);
                --alier-cb-border-color: var(--alier-stroke-col, #666);
                --alier-switch-length: var(--alier-cb-size);
                --alier-switch-knob-width: var(--alier-cb-size);
                --alier-switch-margin: 1px;
                --alier-cb-disabled: var(--alier-muted-bg, #ccc);
                --alier-cb-disabled-border: var(--alier-muted-fg, gray);
                --alier-cb-transition-speed: var(--alier-transition-speed, 0.2s);
            }
            :host([variant]) #control:has(input:focus-visible) {
                outline: 2px solid var(--alier-cb-background-checked);
                outline-offset: 1px;
            }

            :host([label-position="reverse"]) label {
                flex-direction: row-reverse;
            }
            :host([label-position="bottom"]) label {
                flex-direction: column;
                gap: 0;
            }

            :host([variant]) input {
                opacity: 0;
                padding: 0;
                margin: 0;
                width: 0;
            }
            :host([variant]) #control {
                position: relative;
                display: inline-block;
                flex-shrink: 0;
                background-color: var(--alier-cb-background);
                padding: 0;
                margin: 0.2em;
                width: var(--alier-cb-size);
                height: var(--alier-cb-size);
                border-radius: var(--alier-cb-radius);
                border: 1px solid var(--alier-cb-border-color);
            }
            :host([variant][animation*="fade"]) #control{
                transition: all var(--alier-cb-transition-speed) ease-out;
            }
            :host([variant]:hover)  #control {
                border-color: var(--alier-fg-col);
                box-shadow: 0 0 calc(var(--alier-cb-size) * 0.15) var(--alier-cb-background-checked) inset;
            }
            :host([variant][checked]:hover)  #control {
                box-shadow: 0 0 calc(var(--alier-cb-size) * 0.15) var(--alier-cb-symbol-color) inset;
            }

            :host([round]) #control {
                border-radius: var(--alier-cb-size);
            }

            :host([variant="check"]) #symbol {
                position: absolute;
                display: inline-block;
                rotate: -90deg;
            }
            :host([variant="check"][animation*="fade"]) #symbol {
                transition : box-shadow var(--alier-cb-transition-speed) ease, rotate calc(var(--alier-cb-transition-speed)*1.5) 0.05s ease;
            }
            :host([variant="check"][checked]) #symbol {
                margin: calc(var(--alier-cb-size) * (0.18 / 0.85)) calc(var(--alier-cb-size) * (0.07 / 0.85));
                width: calc(var(--alier-cb-size) * (0.7 / 0.85));
                height: calc(var(--alier-cb-size) * (0.4 / 0.85));
                rotate: -55deg;
                box-shadow: calc(var(--alier-cb-size) * 0.2) calc(var(--alier-cb-size) * -0.2) 0 var(--alier-cb-symbol-color) inset;
            }
            :host([variant="slash"]) #symbol {
                position: absolute;
                display: inline-block;
                width: calc(var(--alier-cb-size) * 1);
                height: calc(var(--alier-cb-size) * 1);
                rotate: 15deg;
            }
            :host([variant="slash"][animation*="fade"]) #symbol {
                transition: all var(--alier-cb-transition-speed) ease, rotate calc(var(--alier-cb-transition-speed)*0.75) 0.05s ease;
            }
            :host([variant="slash"][checked]) #symbol {
                background-color: var(--alier-cb-symbol-color);
                margin: calc(var(--alier-cb-size) * 0.42) calc(var(--alier-cb-size) * -0.125);
                width: calc(var(--alier-cb-size) * 1.25);
                height: calc(var(--alier-cb-size) * 0.15);
                border-radius: calc(var(--alier-cb-size) * 0.1);
                rotate: -45deg;
                box-shadow: none;
                translate: 0;
            }

            :host([variant="dot"]) #symbol {
                position: absolute;
                display: inline-block;
                width: calc(var(--alier-cb-size) * 1);
                height: calc(var(--alier-cb-size) * 1);
            }
            :host([variant="dot"][animation*="fade"]) #symbol {
                transition: all var(--alier-cb-transition-speed) cubic-bezier(.52,1.86,.59,1.61);
            }
            :host([variant="dot"][checked]) #symbol {
                background-color: var(--alier-cb-symbol-color);
                margin: calc(var(--alier-cb-size) * 0.25);
                width: calc(var(--alier-cb-size) * 0.5);
                height: calc(var(--alier-cb-size) * 0.5);
                border-radius: 100%;
                box-shadow: none;
                translate: 0;
            }


            :host([variant="switch"]) #control {
                margin: 0.2em;
                width: calc(var(--alier-switch-knob-width) + var(--alier-switch-length));
                height: calc(var(--alier-cb-size));
                border: 1px solid var(--alier-cb-border-color);
            }
            :host([variant="switch"][round]) #symbol {
                border-radius: calc(var(--alier-cb-size) * 0.5);
            }
            :host([variant="switch"]) #symbol {
                position: absolute;
                display: inline-block;
                rotate: 0deg;
                margin: var(--alier-switch-margin);
                width: calc(var(--alier-switch-knob-width) - var(--alier-switch-margin) * 2 - 2px);
                height: calc(var(--alier-cb-size) - var(--alier-switch-margin) * 2 - 2px);
                background-color: var(--alier-cb-symbol-color);
                border: 1px solid var(--alier-cb-border-color);
                border-radius: var(--alier-cb-radius);
            }
            :host([variant="switch"][animation*="fade"]) #symbol {
                transition: all var(--alier-cb-transition-speed) ease;
            }
            :host([variant="switch"][checked]) #symbol {
                translate: calc(var(--alier-switch-length)) 0;
            }

            :host([variant="tag"]) #control {
                opacity: 0;
                width: 0;
                margin: 0;
                border: none;
            }
            :host([variant="tag"]) label {
                gap: 0;
                background-color: var(--background-color);
                padding: 0.2em 0.6em;
                border: 1px solid var(--alier-cb-border-color);
                border-radius: var(--alier-cb-radius);
            }
            :host([variant="tag"][animation*="fade"]) label {
                transition: background-color var(--alier-cb-transition-speed) ease, border-color var(--alier-cb-transition-speed) ease, box-shadow 0.1s ease;
            }
            :host([variant="tag"][checked][animation*="swing"]) label {
                animation : checkbox-swing 0.5s ease none;
            }
            :host([variant="tag"][round]) label {
                border-radius: var(--alier-cb-size);
            }
            :host([variant="tag"][checked]) label {
                background-color: var(--alier-cb-background-checked);
                color: var(--alier-cb-symbol-color);
            }
            :host([variant="tag"]:hover) label {
                border-color: var(--alier-fg-col);
                box-shadow: 0 0 calc(var(--alier-cb-size) * 0.15) var(--alier-cb-background-checked) inset;
            }
            :host([variant="tag"][checked]:hover) label{
                box-shadow: 0 0 calc(var(--alier-cb-size) * 0.15) var(--alier-cb-background) inset;
            }
            :host([variant="tag"]) label:has(input:focus-visible){
                outline: 2px solid var(--alier-cb-background-checked);
                outline-offset: 1px;
            }


            :host([checked][animation*=swing]) #control {
                animation : checkbox-swing 0.5s ease none;
            }
            :host #control img {
                display: none;
            }
            :host([variant="img"]) #control {
                overflow: clip;
            }
            :host([variant="img"]) #control img {
                position: absolute;
                display: inline-block;

                width : var(--alier-cb-size);
                height: var(--alier-cb-size);
                transition: opacity var(--alier-cb-transition-speed) ease;
            }
            :host([variant="img"]) #control img.checked,
            :host([variant="img"][checked]) #control img.unchecked {
                opacity: 0;
            }
            :host([variant="img"]) #control img.unchecked,
            :host([variant="img"][checked]) #control img.checked {
                opacity: 1;
            }
            :host([variant="img"][checked][disabled]) #control img.checked,
            :host([variant="img"][disabled]) #control img.unchecked {
                opacity: 0.6;
            }

            :host([variant]) #symbol > svg {
                position: absolute;
                display: inline-block;
                width: calc(var(--alier-cb-size));
                height: calc(var(--alier-cb-size));
                fill: var(--alier-cb-background);
                stroke: var(--alier-cb-border-color);
                stroke-width: 2px;
                transition: all var(--alier-cb-transition-speed) ease;
            }
            :host([variant][checked]) #symbol > svg {
                fill: var(--alier-cb-background-checked);
            }
            :host([variant][checked][animation*="swing"]) #symbol > svg {
                animation : checkbox-swing 0.5s ease none;
            }
            :host([variant]) #control:has(svg) {
                border: none;
                overflow: visible;
                background-color: transparent !important;
                box-shadow: none !important;
            }
            :host([variant]:hover) #symbol > svg {
                stroke: var(--alier-cb-background-checked);
                stroke-width: 2px;
            }


            :host([animation*="ripples"][checked]) #control::before {
                display: inline-block;
                position: absolute;
                content: "";
                margin: auto;
                width: 100%;
                height: 100%;
                opacity: 0;
                border: 1px solid var(--alier-cb-background-checked);
                border-radius: var(--alier-cb-radius);
                box-sizing: border-box;
                pointer-events: none;
                animation: ripples 0.7s ease-out none;
            }
            :host([animation*="ripples"][checked][round]) #control::before {
                border-radius: var(--alier-cb-size);
            }

            :host([animation*="flipY"]) #control,
            :host([animation*="flipY"]) #symbol > svg,
            :host([animation*="flipX"]) #control,
            :host([animation*="flipX"]) #symbol > svg,
            :host([variant="tag"][animation*="flipY"]) label,
            :host([variant="tag"][animation*="flipX"]) label {
                transition: transform calc(var(--alier-cb-transition-speed) * 1.5) ease-out;
            }
            :host([animation*="flipY"][checked]) #control,
            :host([animation*="flipY"][checked]) #symbol > svg,
            :host([variant="tag"][animation*="flipY"][checked]) label {
                transform: rotateY(360deg);
            }
            :host([animation*="flipX"][checked]) #control,
            :host([animation*="flipX"][checked]) #symbol > svg,
            :host([variant="tag"][animation*="flipX"][checked]) label {
                transform: rotateX(360deg);
            }

            :host([animation*="flipX"][animation*="flipY"][checked]) #control,
            :host([animation*="flipX"][animation*="flipY"][checked]) #symbol > svg,
            :host([variant="tag"][animation*="flipX"][animation*="flipY"][checked]) label {
                transform: rotate3d(1, 1, 0, 360deg);
            }


            :host([variant][checked]) #control {
                background-color: var(--alier-cb-background-checked);
            }
            input {
                accent-color: var(--alier-cb-background-checked) !important;
            }
            :host([variant][disabled]) #control,
            :host([variant="tag"][disabled]) label {
                border-color: var(--alier-cb-disabled-border);
                filter: grayscale(100%);
                opacity: 0.6;
            }
            :host(:not([checked])[variant][disabled]) #control,
            :host(:not([checked])[variant="tag"][disabled]) label {
                background: var(--alier-cb-disabled);
            }

            :host([variant][disabled]) #symbol > svg{
                fill: var(--alier-cb-disabled);
                stroke: var(--alier-cb-disabled-border);
            }
            :host([variant][disabled]) :hover #control {
                box-shadow: none;
            }
            :host([animation*="none"]) :where(label, #control, #symbol, #symbol > svg){
                transition: none;
                animation: none;
            }

            :host([hidden]) { display: none; }

            label {
                display: flex;
                align-items: center;
                gap: 0.4em;
                padding: 0.2em;
                border-radius: 0.5em;
            }

            @keyframes checkbox-swing {
                0% {
                    rotate: 0deg;
                }
                20% {
                    rotate: -10deg;
                    stroke-width: 20%;
                }
                60% {
                    rotate: 5deg;
                }
                100% {
                    rotate: 0deg;
                }
            }

            @keyframes ripples {
                0% {
                    transform: scale(100%);
                    opacity: 1;
                }
                100% {
                    transform: scale(150%);
                    opacity: 0;
                }
            }
        `;

    constructor() {
        super();

        // FIXME: Temporary solution to add active events
        this.initialize();
    }

    //  初期化
    onInitialize(shadowRoot, elementInternals) {
        this.#shadowRoot = shadowRoot;
        this.#internals = elementInternals;

        if(!this.hasAttribute("variant")){
            this.setAttribute("variant", AlierCheckBox.propertyDescriptors.variant.default);
        }
        if(!this.hasAttribute("animation")){
            this.setAttribute("animation", AlierCheckBox.propertyDescriptors.animation.default);
        }
        if(!this.hasAttribute("data-active-events")){
            this.setAttribute("data-active-events", "change");
        }

        const observer = new MutationObserver(() => {
            observer.disconnect();
            this.#renderInit = true;
            this.#renderIcon();
        });
        observer.observe(this.#shadowRoot, { childList: true, subtree: true });
    }


    render(it) {
        const changeListener = (e) => {
            this.checked = !this.checked;
            const newEvent = new CustomEvent(
                "change", {
                    detail: { originalEvent: e, value: e.target.value },
                    bubbles: false,
                    composed: true
                }
            );
            this.dispatchEvent(newEvent);
        }
        const clickListener = (e) => {
            e.stopPropagation();
        }

        return html`
        <label id="label" part="label">
            <div id="control" part="control">
                <input
                    type="checkbox"
                    id="checkbox"
                    ?checked=${it.checked}
                    ?disabled=${it.disabled}
                    ?required=${it.required}
                    @change=${changeListener}
                    @click=${clickListener}
                />
                <span id="symbol" part="symbol"></span>
                <img part="checked-img" class="checked"/>
                <img part="unchecked-img" class="unchecked"/>
            </div>
            <slot></slot>
        </label>
        `;
    }


    toggle() {
        this.checked = !this.checked;
        this.#shadowRoot.querySelector("#checkbox").checked = this.checked;
    }


    #updateValidity() {
        this.#internals.setValidity(
            this.checked || !this.required
                ? {} : { valueMissing: true },
            this.checked ? '' : 'This field is required'
        );
        this.#internals.setFormValue(this.checked ? this.value : null);
    }

    /** @type {boolean} */
    #renderInit = false;

    #renderIcon(){
        if(!this.#renderInit) return;

        const icons = {
            heart: `<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
            star: `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21 16.54 13.97 22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
            bell: `<svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V9c0-3.07-1.63-5.64-4.5-6.32V2a1.5 1.5 0 00-3 0v.68C7.63 3.36 6 5.92 6 9v7l-2 2v1h16v-1l-2-2z"/></svg>`
        }

        const symbol = this.#shadowRoot.querySelector('#symbol');
        if(symbol) {
            symbol.innerHTML = (this.variant in icons) ? icons[this.variant] : "";
        }

        if(this.variant === "img") {
            if(this.srcChecked){
                const img_checked = this.#shadowRoot.querySelector("img.checked");
                if(img_checked){
                    img_checked.src = this.srcChecked;
                }
            }
            if(this.srcUnchecked){
                const img_unchecked = this.#shadowRoot.querySelector("img.unchecked");
                if(img_unchecked){
                    img_unchecked.src = this.srcUnchecked;
                }
            }
        }
    }
}

AlierCheckBox.use();

export { AlierCheckBox };
