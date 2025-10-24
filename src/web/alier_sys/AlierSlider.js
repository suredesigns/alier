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

import { AlierCustomElement, html, listener } from "./AlierCustomElement.js";

const _updateThumbPosition = (() => {
    const ongoing_targets = new WeakSet;
    /**
     * @param {AlierSlider} target
     */
    const update = target => {
        if (ongoing_targets.has(target)) { return; }
        ongoing_targets.add(target);
        setTimeout(() => {
            const position = 100 * target.position;
            target.style.setProperty("--this-value", `${position}%`);
            ongoing_targets.delete(target);
        }, 0);
    };
    return update;
})();

class AlierSlider extends AlierCustomElement {
    static tagName = "alier-slider";

    static formAssociated = true;

    /** @type {ShadowRootInit} */
    static attachShadowOptions = {
        mode: "closed",
        delegatesFocus: true,
    };

    static styles = `
        :host
        {
            --color-accent: var(
                --alier-accent-col,
                hsl(216deg 80% 33%)
            );
            --color-ambient: var(
                --alier-ambient-col,
                hsl(210deg 40% 67%)
            );

            --thumb-color          : color-mix(
                in srgb,
                color-mix(in srgb, var(--color-accent) 50%, var(--color-ambient)) 20%,
                white
            );
            --thumb-color-active   : color-mix(
                in srgb,
                var(--thumb-color) 50%,
                white
            );
            --thumb-cursor         : var(--alier-slider-thumb-cursor, pointer);
            --thumb-cursor-grab    : var(--alier-slider-thumb-cursor-grab, grab);
            --thumb-cursor-grabbing: var(--alier-slider-thumb-cursor-grabbing, grabbing);

            --thumb-width          : var(--alier-slider-thumb-width ,  16px);
            --thumb-height         : var(--alier-slider-thumb-height,  16px);
            --thumb-radius         : var(--alier-border-radius      ,   4px);
            --thumb-outline        : var(--alier-thumb-outline      ,  none);
        }

        :host(:not([hidden]))
        {
            display       : inline-block;
            vertical-align: middle;
        }
        :host([hidden])
        {
            display: none;
        }

        :host(:disabled) *
        {
            -webkit-user-select: none;
            filter             : grayscale(1) brightness(1.2);
            pointer-events     : none;
            user-select        : none;
        }

        .container
        {
            position  : relative;
            box-sizing: border-box;
            margin    : 0;
            padding   : 0;
            width     : 100%;
            height    : 100%;
        }
        .container::before {
            position     : absolute;
            content      : "";
            z-index      : -1;
            top          : 0;
            right        : 0;
            bottom       : 0;
            left         : 0;
            border-radius: inherit;
            transition   : opacity 0.3s;
            filter       : blur(4px);
            opacity      : 0.5;
        }

        .container:where(:focus, :hover)::before
        {
            opacity: 0.8;
        }

        .slider
        {
            -webkit-appearance: none;

            appearance   : none;
            position     : absolute;
            top          : 0;
            left         : 0;
            box-sizing   : border-box;
            box-shadow   : var(--alier-dropshadow, none);
            outline      : none;
            border-radius: var(--thumb-radius);
            margin       : 0;
            padding      : 0;
            width        : 100%;
            height       : 100%;
        }

        .slider:enabled
        {
            cursor: var(--thumb-cursor);
        }
        .slider:active
        {
            cursor: var(--thumb-cursor-grabbing);
        }


        /** Reflect orientation attribute onto the container */
        :host([orientation|="vertical" i]) .container
        {
            writing-mode: vertical-rl;
        }

        /** Vertical layout settings */
        :host([orientation|="vertical" i]) .slider
        {
            direction : rtl;
        }
        :host([orientation|="vertical" i]) :is(.container, slider)
        {
            max-width : var(--thumb-height);
            min-width : max(4px, calc(var(--thumb-height) / 4));
            min-height: max(48px, calc(3 * var(--thumb-height)));
        }
        :host([orientation|="vertical" i]) .slider,
        :host([orientation|="vertical" i]) .container::before
        {
            background: linear-gradient(to top,
                var(--color-accent)  var(--this-value, 50%),
                var(--color-ambient) var(--this-value, 50%)
            );
        }

        /** Horizontal layout settings */
        :host(:not([orientation|="vertical" i])) :is(.container, .slider)
        {
            max-height: var(--thumb-height);
            min-height: max(4px, calc(var(--thumb-height) / 4));
            min-width : max(48px, calc(3 * var(--thumb-height)));
        }
        :host(:not([orientation|="vertical" i])) .slider,
        :host(:not([orientation|="vertical" i])) .container::before
        {
            background: linear-gradient(to right,
                var(--color-accent)  var(--this-value, 50%),
                var(--color-ambient) var(--this-value, 50%)
            );
        }

        .slider::-webkit-slider-thumb
        {
            -webkit-appearance: none;
            appearance        : none;
            border            : none;
            border-radius     : var(--thumb-radius);
            outline           : var(--thumb-outline);
            background        : var(--thumb-color);
            transition        : width 0.1s, height 0.1s;
        }
        .slider::-moz-range-thumb
        {
            -moz-appearance   : none;
            appearance        : none;
            border            : none;
            outline           : var(--thumb-outline);
            border-radius     : var(--thumb-radius);
            background        : var(--thumb-color);
        }

        .slider:enabled::-webkit-slider-thumb
        {
            cursor    : var(--thumb-cursor-grab);
            transition: width 0.1s, height 0.1s;
        }
        .slider:enabled::-moz-range-thumb
        {
            cursor    : var(--thumb-cursor-grab);
            transition: width 0.1s, height 0.1s;
        }

        .slider::-webkit-slider-thumb:active,
        .slider:active::-webkit-slider-thumb
        {
            cursor    : var(--thumb-cursor-grabbing);
            background: var(--thumb-color-active);
        }
        .slider::-moz-range-thumb:active,
        .slider:active::-moz-range-thumb
        {
            cursor    : var(--thumb-cursor-grabbing);
            background: var(--thumb-color-active);
        }

        /** vertical thumb */
        :host([orientation|="vertical" i]) .slider::-webkit-slider-thumb
        {
            /** These values are intentionally swapped */
            width     : var(--thumb-height);
            height    : var(--thumb-width);
        }
        :host([orientation|="vertical" i]) .slider::-moz-range-thumb
        {
            /** These values are intentionally swapped */
            width     : var(--thumb-height);
            height    : var(--thumb-width);
        }

        /** horizontal thumb */
        :host(:not([orientation|="vertical" i])) .slider::-webkit-slider-thumb
        {
            width     : var(--thumb-width);
            height    : var(--thumb-height);
        }
        :host(:not([orientation|="vertical" i])) .slider::-moz-range-thumb
        {
            width     : var(--thumb-width);
            height    : var(--thumb-height);
        }

        /** vertical active thumb */
        :host([orientation|="vertical" i]) .slider::-webkit-slider-thumb:active,
        :host([orientation|="vertical" i]) .slider:active::-webkit-slider-thumb
        {
          height: calc(var(--thumb-width) * 0.5);
        }
        :host([orientation|="vertical" i]) .slider::-moz-range-thumb:active,
        :host([orientation|="vertical" i]) .slider:active::-moz-range-thumb
        {
          height: calc(var(--thumb-width) * 0.5);
        }

        /** horizontal active thumb */
        :host(:not([orientation|="vertical" i])) .slider::-webkit-slider-thumb:active,
        :host(:not([orientation|="vertical" i])) .slider:active::-webkit-slider-thumb
        {
            width: calc(var(--thumb-width) * 0.5);
        }
        :host(:not([orientation|="vertical" i])) .slider::-moz-range-thumb:active,
        :host(:not([orientation|="vertical" i])) .slider:active::-moz-range-thumb
        {
            width: calc(var(--thumb-width) * 0.5);
        }
    `;

    static propertyDescriptors = {
        value: {
            default  : 50,
            asProp   : Number,
            validate : (target, value) => (
                typeof value === "number" &&
                target.min <= value && value <= target.max
            ),
            /**
             * @param {AlierSlider} target
             * @param {number} value
             */
            onChange : (target, _, value) => {
                /** @type {number} */
                const step  = target.step;
                if (step <= 0) {
                    _updateThumbPosition(target);
                } else {
                    /** @type {number} */
                    const min   = target.min;
                    const steps = value - min;
                    const quot  = steps / step;
                    const whole = Math.round(quot);
                    const adjusted_value = whole * step + min;
                    if (adjusted_value !== value) {
                        target.value = adjusted_value;
                    } else {
                        _updateThumbPosition(target);
                    }
                }

                //  FIXME:
                //  The below lines seems to be redundant because
                //  it seems that the procedure be done in the base class.
                /** @type {ElementInternals?} */
                const internals = target._internals;
                internals?.setFormValue(target.value);
            },
        },
        step: {
            default: 1,
            /** @param {string} attr */
            asProp : attr => (attr === "any" ?
                0 :
                Number(attr)
            ),
            /** @param {number} prop */
            asAttr: prop => (prop <= 0 ?
                    "any" :
                    String(prop)
            ),
            /**
             * @param {AlierSlider} target
             * @param {unknown} step
             */
            validate: (target, step) => (
                typeof step === "number" &&
                0 <= step && step <= (target.max - target.min)  // step == 0 means "any"
            )
        },
        min: {
            default  : 0,
            asProp   : Number,
            validate : (target, min) => (
                typeof min === "number" &&
                min <= target.value     &&
                target.step <= (target.max - min)
            ),
            onChange : _updateThumbPosition,
        },
        max: {
            default  : 100,
            asProp   : Number,
            validate : (target, max) => (
                typeof max === "number" &&
                target.value <= max     &&
                target.step <= (max - target.min)
            ),
            onChange : _updateThumbPosition,
        },
        disabled: {
            default: false,
            boolean: true,
            onChange: target => {
                if (target.disabled) {
                    target.states.enabled.disable();
                } else {
                    target.states.disabled.enable();
                }
            }
        },
        orientation: {
            default: "horizontal",
            validate: (_, orientation) => (
                typeof orientation === "string" &&
                /^(?:horizontal|vertical)-?/i.test(orientation)
            )
        },
    };

    static states = {
        disabled: {
            init: false,
            events: {
                enable: flagset => (
                    flagset
                        .disabled.unset()
                        .enabled.set()
                )
            }
        },
        enabled: {
            init: true,
            events: {
                disable: flagset => (
                    flagset
                        .disabled.set()
                        .enabled.unset()
                )
            }
        },
    }

    get position() {
        return this.value / (this.max - this.min);
    }

    connectedCallback() {
        super.connectedCallback();
        const computed_style = getComputedStyle(this);
        const width  = computed_style.width;
        const height = computed_style.height;

        const thumb_width_key  = "--alier-slider-thumb-width";
        const thumb_height_key = "--alier-slider-thumb-height";

        /** @type { "vertical" | "horizontal" | "vertical-lr" | "vertical-rl" | "horizontal-tb" } */
        const orientation = this.orientation;
        if (/^vertical-?/i.test(orientation)) {
            if (computed_style.getPropertyValue(thumb_width_key) === "") {
                this.style.setProperty(thumb_width_key, `var(${width} / 2`);
            }
            if (computed_style.getPropertyValue(thumb_height_key) === "") {
                this.style.setProperty(thumb_height_key, width);
            }
        } else {
            if (computed_style.getPropertyValue(thumb_width_key) === "") {
                this.style.setProperty(thumb_width_key, `var(${height} / 2`);
            }
            if (computed_style.getPropertyValue(thumb_height_key) === "") {
                this.style.setProperty(thumb_height_key, height);
            }
        }
    }

    constructor() {
        super();

        //  This is work-around for the problem that the `data-active-events` attribute related
        //  functionality does not work as expected if an  element to relate to a `ViewLogic`
        //  before the element is connected or the element's attribute is modified.
        //  FIXME:
        //  This introduces another problem that an element cannot be created from
        //  `document.createElement(tagName)`.
        this.initialize();
    }


    /**
     * @override
     * @param {ElementInternals} internals
     */
    onInitialize(_, internals) {
        if (this.dataset.activeEvents == null) {
            this.dataset.activeEvents = "input";
        }

        //  FIXME:
        //  The below lines are needed for updating the form value from
        //  the `value` property's `onChange()` callback.
        //  It should also be fixed when fixing the `onChange()`.
        internals.setFormValue(this.value);
        this._internals = internals;
    }

    render(it) {
        return html`
            <div class="container">
                <input
                    id="slider"
                    type="range"
                    class="slider"
                    ?disabled=${it.disabled}
                    .value=${it.value}
                    .min=${it.min}
                    .max=${it.max}
                    step=${it.step.get() > 0 ? it.step : "any"}
                    @input=${listener(ev => {
                        /** @type {HTMLInputElement} */
                        const input = ev.currentTarget;
                        this.value = input.valueAsNumber;
                    }, { passive: true })}
                >
            </div>
        `;
    }
}

AlierSlider.use();

export { AlierSlider };
