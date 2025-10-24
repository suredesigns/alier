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
import { html, render } from "./Render.js";
import { LongPressTarget } from "./LongPressTarget.js";

const AlierButton = LongPressTarget(class AlierButton extends AlierCustomElement {
    static tagName = "alier-button";
    static formAssociated = true;

    #longpressTimestamp;
    #shadowRoot;
    #timerId

    #startRepeat(){
        this.#longpressTimestamp = performance.now();
        const timer = this.slowRepeatEndMs > 0 ? this.slowRepeatDurationMs : this.repeatDurationMs;
        this.clickRepeat(timer);
    }
    
    static attachShadowOptions = {
        mode: "closed",
        delegatesFocus:true,
    }

    static propertyDescriptors = {
        name: {
            default: "",
        },
        value: {
            default: "",
        },
        type: {
            default: "button",
            validate: (target, value) => {
                const candidates = ["submit", "reset", "button"];
                return candidates.includes(value);
            },
        },
        disabled: {
            default: false,
            boolean: true,
        },
        repeat: {
            default: false,
            boolean: true,
            onChange: (target, oldValue, newValue) => {
                if (!oldValue && newValue) {
                    target.addEventListener("longpress", target.#startRepeat);
                } else if (oldValue && !newValue) {
                    target.removeEventListener("longpress", target.#startRepeat);
                }
            },
        },
        slowRepeatEndMs: {
            default: 2000,
            attribute: "slow-repeat-end",
            asProp: (attrVal) => {
                const ms = Number(attrVal);
                return ms >= 0 ? ms : this.propertyDescriptors.slowRepeatEndMs.default;
            },
        },
        slowRepeatDurationMs: {
            default: 500,
            attribute: "slow-repeat-duration",
            asProp: (attrVal) => {
                const ms = Number(attrVal);
                return ms >= 0 ? ms : this.propertyDescriptors.slowRepeatDurationMs.default;
            },
        },
        repeatDurationMs: {
            default: 200,
            attribute: "repeat-duration",
            asProp: (attrVal) => {
                const ms = Number(attrVal);
                return ms >= 0 ? ms : this.propertyDescriptors.repeatDurationMs.default;
            },
        },
        longpressMs: {
            default: 2000,
            attribute: "longpress-time",
            asProp: (attrVal) => {
                const ms = Number(attrVal);
                return ms >= 0 ? ms : this.propertyDescriptors.longpressMs.default;
            },
            onChange: (target, oldValue, newValue) => {
                if(newValue >= 0){ target.delayInMilliseconds = newValue; }
            }
        },
    };

    static states = {};
   
    static styles = `
        :host {
            height: fit-content;
        }
        :host(:not([hidden])) {
            display: inline-block;
        }
        :host button {
            width: var(--alier-width);
            min-width: 2.5em;
            height: var(--alier-height);
            font-family: var(--alier-font);
            color: var(--alier-fg-col, #222);
            background-color: var(--alier-bg-col, #fff);
            border-width: var(--alier-stroke-weight, .2em);
            border-color: var(--alier-stroke-col);
            border-radius: var(--alier-border-radius, 4px);
            padding: var(--alier-padding, .1em .2em);
            margin: var(--alier-spacing, 0);
            line-height: var(--alier-line-height, 1.4);
            filter: drop-shadow(var(--alier-dropshadow));
            transition-duration: var(--alier-transition-speed, .1s);
        }
        :host button:hover {
            color: var(--alier-hover-fg);
            background-color: var(--alier-hover-bg, #eee);
            border-color: var(--alier-hover-stroke);
        }
        :host button:active {
            color: var(--alier-active-fg, #333);
            background-color: var(--alier-active-bg, #fff);
            border-color: var(--alier-active-stroke);
            transform: translateY(1px);
        }
        :host button:disabled {
            color: var(--alier-muted-fg, #666);
            background-color: var(--alier-muted-bg, #eee);
            border-color: var(--alier-muted-stroke);
            transform: none;
        }
    `;

    constructor(){
        super();
        // temporary solution
        this.initialize();
    }

    onInitialize(shadowRoot, elementInternals) { 
        this.internals = elementInternals;
        this.#shadowRoot = shadowRoot;
        this.setAttribute("exportpart", "button");
        this.setAttribute("data-active-events", "click");
        if(this.repeat) {
            this.addEventListener("longpress", this.#startRepeat);
        }
    }

    render(it) {

        const listener = () => {
            clearTimeout(this.#timerId);
            this.#timerId = undefined;
        }

        return html `
        <button
            part="button"
            ?disabled=${it.disabled}
            ?repeat=${it.repeat}
            @pointercancel=${listener}
            @pointerleave=${listener}
            @pointerup=${listener}
        >
            <slot></slot>
        </button>`;
    }

    clickRepeat(time) {
        if(typeof this.#timerId === "number") clearTimeout(this.#timerId);
        this.#timerId = setTimeout(() => {
            if (this.#timerId > 0) {
                this.#shadowRoot.querySelector("button").click();
                this.#timerId = undefined;
                const timer = (performance.now() > this.#longpressTimestamp + this.slowRepeatEndMs) ? this.repeatDurationMs : this.slowRepeatDurationMs;
                this.clickRepeat(timer);
            }
        }, time);
    }    
});

AlierButton.use();

export { AlierButton };