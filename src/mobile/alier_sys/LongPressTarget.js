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

const LongPressEvent = class extends CustomEvent {
    constructor(type, options) {
        const default_options = {
            bubbles   : true,
            cancelable: true,
            composed  : true,
        };
        const options_ = options !== null && typeof options === "object" ?
            { ...options, ...default_options } :
            default_options
        ;

        super(type, options_);
    }
};

/**
 * Decorates the given base class extending `Element` as a class
 * supporting the `longpress` custom events.
 *
 * @param {typeof AlierCustomElement} alierElementConstructor
 * The target class to decorate.
 *
 * @returns
 * A decorated class.
 *
 */
const LongPressTarget = alierElementConstructor => {
    const base_class = alierElementConstructor;
    if (typeof base_class !== "function") {
        throw new TypeError("'alierElementConstructor' is not a function");
    }
    if (!(base_class.prototype instanceof AlierCustomElement)) {
        throw new TypeError("'alierElementConstructor' is not derived from AlierCustomElement");
    }

    /**
     * To allow calling `onInitialize` before `constructor`, it binds to
     * a local variable rather than a private property.
     *
     * @type {ShadowRoot}
     */
    let targetShadowRoot;

    const decorated_class = class extends base_class {
        constructor(...args) {
            super(...args);

            let abort_controller;
            let pointer_id;
            let pointerdown_event;
            let pointerdown_x;
            let pointerdown_y;
            let dispatch_timer;

            const init = () => {
                if (dispatch_timer > 0) {
                    clearTimeout(dispatch_timer);
                }
                abort_controller?.abort();
                this.addEventListener("pointerdown", pointerdown, { passive: true });

                abort_controller  = new AbortController();
                pointer_id        = null;
                pointerdown_event = null;
                pointerdown_x     = 0;
                pointerdown_y     = 0;
                dispatch_timer    = 0;
            };

            const isSamePointer = ev => pointer_id === ev.pointerId;

            const sufficientlyPressed = ev => {
                const pointer_type = ev.pointerType;
                const pressure     = ev.pressure;

                //  iOS devices not reporting pressure of touch event and hence
                //  it is regarded that the pointer device is not supporting pressure detection
                //  even if pointer_type === "touch".
                return (
                    (pointer_type !== "pen") ||
                    this.minimumPressure <= pressure
                );
            };

            const isObservedButton = ev => ((this.observedButtons & ev.buttons) !== 0);

            const movement = ev => {
                const dx = ev.screenX - pointerdown_x;
                const dy = ev.screenY - pointerdown_y;

                return { dx, dy };
            };

            const inTouchSlop = ev => {
                const { dx, dy } = movement(ev);
                return (dx**2 + dy**2) <= (this.touchSlopDistanceInPixels**2);
            };

            const dispatch = () => {
                if (dispatch_timer > 0) {
                    clearTimeout(dispatch_timer);
                }
                dispatch_timer  = 0;
                this.dispatchEvent(new LongPressEvent("longpress", {
                    detail: {
                        source: pointerdown_event
                    }
                }));
            };

            /**
             * @param {PointerEvent & { type: "pointerup"} } ev
             */
            const pointerup = ev => {
                if (!isSamePointer(ev)) { return; }
                init();
            };

            /**
             * @param {PointerEvent & { type: "pointercancel"} } ev
             */
            const pointercancel = ev => {
                if (!isSamePointer(ev)) { return; }
                init();
            };

            /**
             * @param {PointerEvent & { type: "pointerleave"} } ev
             */
            const pointerleave = ev => {
                if (!isSamePointer(ev)) { return; }
                init();
            };

            /**
             * @param {PointerEvent & { type: "contextmenu"} } ev
             */
            const contextmenu = ev => {
                if (!isSamePointer(ev)) { return; }
                ev.preventDefault();
            };

            /**
             * @param {PointerEvent & ({ type: "pointermove" })} ev
             */
            const pointermove = ev => {
                if (!isSamePointer(ev)) { return; }
                if (!sufficientlyPressed(ev) || !inTouchSlop(ev)) {
                    // Cancel long press gesture.
                    init();
                }
            };

            /**
             * @param {PointerEvent & ({ type: "pointerdown" })} ev
             */
            const pointerdown = ev => {
                if (isObservedButton(ev) && sufficientlyPressed(ev)) {
                    this.removeEventListener("pointerdown", pointerdown);

                    pointerdown_event = ev;
                    pointer_id        = ev.pointerId;
                    pointerdown_x     = ev.screenX;
                    pointerdown_y     = ev.screenY;

                    this.addEventListener("pointermove", pointermove, {
                        passive: true,
                        signal: abort_controller.signal
                    });
                    this.addEventListener("pointerup", pointerup, {
                        passive: true,
                        signal: abort_controller.signal
                    });
                    this.addEventListener("pointercancel", pointercancel, {
                        passive: true,
                        signal: abort_controller.signal
                    });
                    this.addEventListener("pointerleave", pointerleave, {
                        passive: true,
                        signal: abort_controller.signal
                    });
                    if (ev.pointerType === "touch" || ev.pointerType === "pen") {
                        //  This will not work on iOS because iOS doesn't support
                        //  `contextmenu` event.
                        this.addEventListener("contextmenu", contextmenu, {
                            passive: false,  // for preventing default
                            signal: abort_controller.signal
                        });
                    }

                    dispatch_timer = setTimeout(dispatch, this.delayInMilliseconds);
                }
            };

            init();
        }

        onInitialize(shadowRoot, elementInternals) {
            super.onInitialize(shadowRoot, elementInternals);
            targetShadowRoot = shadowRoot;
        }

        /**
         * @override
         */
        connectedCallback() {
            super.connectedCallback();
            this.#initialize();
        }

        /**
         * @override
         */
        attributeChangedCallback(name, oldValue, newValue, namespace) {
            super.attributeChangedCallback(name, oldValue, newValue, namespace);
            this.#initialize();
        }

        /**
         * Emulates a long press gesture to the target element.
         *
         * @param {number} durationAfterLongPressInMilliseconds
         * A duration between `longpress` and `pointerup` events in
         * milliseconds.
         */
        longpress(durationAfterLongPressInMilliseconds) {
            const duration_ = durationAfterLongPressInMilliseconds;
            if (!Number.isFinite(duration_)) {
                throw new TypeError("'durationAfterLongPressInMilliseconds' is not a finite number");
            }

            const { left, right, top, bottom } = this.getBoundingClientRect();
            const scroll_x = scrollX;
            const scroll_y = scrollY;
            const x = (right - left) / 2 + left;
            const y = (top - bottom) / 2 + bottom;

            this.dispatchEvent(new PointerEvent("pointerdown", {
                clientX: x,
                clientY: y,
                screenX: x + scroll_x,
                screenY: y + scroll_y,
                pressure: this.minimumPressure,
                buttons: this.observedButtons,
                isPrimary: true,
            }));

            const timeout = this.delayInMilliseconds + duration_;

            setTimeout(() => {
                this.dispatchEvent(new PointerEvent("pointerup", {
                    clientX: x,
                    clientY: y,
                    screenX: x + scroll_x,
                    screenY: y + scroll_y,
                    pressure: 0,
                    buttons: 0,
                    isPrimary: true,
                }));
            }, timeout);
        }

        #initialize() {
            if (!this.#initialized) {
                const sheet = new CSSStyleSheet();

                //  This only affects iOS devices.
                //  see <https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-touch-callout>
                sheet.insertRule(`:host {
                    -webkit-touch-callout: none;
                    -webkit-user-select: none;
                    user-select: none;
                }`);
                targetShadowRoot.adoptedStyleSheets.push(sheet);

                this.#initialized = true;
            }
        }

        #initialized = false;

        /**
         * Updates the configuration for long press recognition.
         *
         * @param {LongPressConfig?} config
         * A new configuration.
         */
        setConfig(config) {
            const config_ = config ?? LongPressConfig.default;
            if (!(config_ instanceof LongPressConfig)) {
                return this;
            }

            this.#config = config_;

            return this;
        }

        /**
         * Gets the current configuration for long press recognition.
         *
         * @returns {LongPressConfig}
         * The current configuration.
         */
        getConfig() {
            return this.#config;
        }

        /**
         * Duration in milliseconds before a press gesture is recognized as
         * a long press.
         * @type {number}
         */
        get delayInMilliseconds() {
            return this.#config.delayInMilliseconds;
        }
        set delayInMilliseconds(delayInMilliseconds) {
            this.#config = this.#config.setDelay(delayInMilliseconds);
        }

        /**
         * A threshold of normalized pressure of a gesture for
         * the gesture is recognized as a long press.
         *
         * If the pressure becomes lower then the threshold during a gesture,
         * it is recognized as not a long press.
         * @type {number}
         */
        get minimumPressure() {
            return this.#config.minimumPressure;
        }
        set minimumPressure(minimumPressure) {
            this.#config = this.#config.setMinimumPressure(minimumPressure);
        }

        /**
         * The maximum distance between the initial position of a pointer
         * and the current position of a pointer in pixels.
         *
         * If a pointer exceeds this limit during a gesture,
         * it is recognized as not a long press.
         * @type {number}
         */
        get touchSlopDistanceInPixels() {
            return this.#config.touchSlopDistanceInPixels;
        }
        set touchSlopDistanceInPixels(touchSlopDistanceInPixels) {
            this.#config = this.#config.setTouchSlop(touchSlopDistanceInPixels);
        }

        /**
         * A set of bit flags each representing an observed button.
         *
         * `1` (`0b0001`) corresponds to the primary button,
         * `2` (`0b0010`) corresponds to the secondary button, and
         * `4` (`0b0100`) corresponds to the auxiliary button,
         *
         * Each extra buttons besides the above corresponds to a power of 2
         * after 4 (i.e. 8, 16, 32, ...).
         * @type {number}
         */
        get observedButtons() {
            return this.#config.observedButtons;
        }
        set observedButtons(observedButtons) {
            this.#config = this.#config.setObservedButtons(observedButtons);
        }

        #config = LongPressConfig.default;
    };

    //  Keep the base class's name.
    Object.defineProperty(decorated_class, "name", {
        value: base_class.name ?? ""
    });

    return decorated_class;
};

const LongPressConfig = class {

    /**
     * Duration in milliseconds before a press gesture is recognized as
     * a long press.
     *
     * By default, it is set to 500 ms.
     * @type {number}
     */
    delayInMilliseconds;

    /**
     * A threshold of normalized pressure of a gesture for
     * the gesture is recognized as a long press.
     *
     * If the pressure becomes lower then the threshold during a gesture,
     * it is recognized as not a long press.
     *
     * By default, it is set to 0.
     * @type {number}
     */
    minimumPressure;

    /**
     * The maximum distance between the initial position of a pointer
     * and the current position of a pointer in pixels.
     *
     * If a pointer exceeds this limit during a gesture,
     * it is recognized as not a long press.
     *
     * By default, it is set to 8 pixels.
     * @type {number}
     */
    touchSlopDistanceInPixels;

    /**
     * A set of bit flags each representing an observed button.
     *
     * `1` (`0b0001`) corresponds to the primary button,
     * `2` (`0b0010`) corresponds to the secondary button, and
     * `4` (`0b0100`) corresponds to the auxiliary button,
     *
     * Each extra buttons besides the above corresponds to a power of 2
     * after 4 (i.e. 8, 16, 32, ...).
     *
     * By default, it is set to `1`.
     * @type {number}
     */
    observedButtons;

    /**
     * @constructor
     *
     * @param {object} o
     * @param {number?} o.delayInMilliseconds
     * Duration in milliseconds before a press gesture is recognized as
     * a long press.
     *
     * @param {number?} o.minimumPressure
     * A threshold of normalized pressure for the gesture is recognized
     * as a long press.
     *
     * If the pressure becomes lower then the threshold during a gesture,
     * it is recognized as not a long press.
     *
     * @param {number?} o.touchSlopDistanceInPixels
     * The maximum distance between the initial position of a pointer
     * and the current position of a pointer in pixels.
     *
     * If a pointer exceeds this limit during a gesture,
     * it is recognized as not a long press.
     *
     * @param {number?} o.observedButtons
     * A set of bit flags each representing an observed button.
     *
     * `1` (`0b0001`) corresponds to the primary button,
     * `2` (`0b0010`) corresponds to the secondary button, and
     * `4` (`0b0100`) corresponds to the auxiliary button,
     *
     * Each extra buttons besides the above corresponds to a power of 2
     * after 4 (i.e. 8, 16, 32, ...).
     */
    constructor(o) {
        if (o === null || typeof o !== "object") {
            return LongPressConfig.default;
        } else if (o instanceof LongPressConfig) {
            return o;
        }
        const delay = Number.isFinite(o.delayInMilliseconds) ?
            o.delayInMilliseconds :
            LongPressConfig.default.delayInMilliseconds
        ;
        const min_pressure = Number.isFinite(o.minimumPressure) ?
            o.minimumPressure :
            LongPressConfig.default.minimumPressure
        ;
        const touch_slop = Number.isFinite(o.touchSlopDistanceInPixels) ?
            o.touchSlopDistanceInPixels :
            LongPressConfig.default.touchSlopDistanceInPixels
        ;
        const buttons = Number.isInteger(o.observedButtons) && o.observedButtons >= 0 ?
            o.observedButtons :
            LongPressConfig.default.observedButtons
        ;

        this.delayInMilliseconds       = Math.trunc(Math.max(100, delay));
        this.minimumPressure           = Math.max(0, Math.min(min_pressure, 1));
        this.touchSlopDistanceInPixels = Math.trunc(Math.max(0, touch_slop));
        this.observedButtons           = buttons;

        Object.freeze(this);
    }

    /**
     * Creates a new configuration object with the given delay time.
     *
     * @param {number} delayInMilliseconds
     * A new value of the duration before a long-press event occurs.
     *
     * @returns {LongPressConfig}
     * A new configuration object.
     */
    setDelay(delayInMilliseconds) {
        return this.delayInMilliseconds === delayInMilliseconds ?
            this :
            new LongPressConfig({ ...this, delayInMilliseconds })
        ;
    }

    /**
     * Creates a new configuration object with the given minimum
     * pressure.
     *
     * @param {number} minimumPressure
     * A new value of the minimum pressure that a gesture can be
     * recognized as a long press.
     *
     * @returns {LongPressConfig}
     * A new configuration object.
     */
    setMinimumPressure(minimumPressure) {
        return this.minimumPressure === minimumPressure ?
            this :
            new LongPressConfig({ ...this, minimumPressure })
        ;
    }

    /**
     * Creates a new configuration object with the given touch slop.
     *
     * @param {number} touchSlopDistanceInPixels
     * A new value of the distance between the initial touch position
     * and the current position that a gesture can be recognized
     * as a long press.
     *
     * @returns {LongPressConfig}
     * A new configuration object.
     */
    setTouchSlop(touchSlopDistanceInPixels) {
        return this.touchSlopDistanceInPixels === touchSlopDistanceInPixels ?
            this :
            new LongPressConfig({ ...this, touchSlopDistanceInPixels })
        ;
    }
    /**
     * Creates a new configuration object with the given observed
     * buttons flags.
     *
     * @param {number} observedButtons
     * A set of bit flags each representing a button to observe.
     *
     * `1` (`0b0001`) corresponds to the primary button,
     * `2` (`0b0010`) corresponds to the secondary button, and
     * `4` (`0b0100`) corresponds to the auxiliary button,
     *
     * Each extra buttons besides the above corresponds to a power of 2
     * after 4 (i.e. 8, 16, 32, ...).
     *
     * @returns {LongPressConfig}
     * A new configuration object.
     */
    setObservedButtons(observedButtons) {
        return this.observedButtons === observedButtons ?
            this :
            new LongPressConfig({ ...this, observedButtons })
        ;
    }

    /**
     * @type {LongPressConfig}
     * The default configuration for long press gesture recognition.
     */
    static default;
}

//  Because a class cannot be instantiated in its static section,
//  set a static property after a class declaration.
LongPressConfig.default = new LongPressConfig({
    delayInMilliseconds      : 500,
    minimumPressure          : 0,
    touchSlopDistanceInPixels: 8,
    observedButtons          : 0x01,
});

export { LongPressTarget, LongPressConfig };
