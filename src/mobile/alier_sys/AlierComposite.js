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

import { AlierLogic } from "./AlierLogic.js";
import getPrimaryProperty from "./getPrimaryProperty.js";
import getPropertyDescriptor from "./GetPropertyDescriptor.js";

/**
 * @class
 * @extends AlierLogic
 *
 * Represents a composite custom element which binds a `ViewLogic` class
 * to the DOM and optionally wraps its inner HTML into a container.
 *
 */
class AlierComposite extends AlierLogic {
    static tagName = "alier-composite";
    static attachShadowOptions = { mode: "closed" };

    static propertyDescriptors = {
        vlClassName: {
            attribute: "view-logic",
            default: "",
            validate: (_, value) => typeof value === "string" && value.length > 0,
        },
        params: {
            default: null,
            validate: (_, data) => typeof data === "object",
            asAttr: prop => {
                try {
                    return JSON.stringify(prop);
                } catch {
                    return "";
                }
            },
            asProp: attr => {
                try {
                    return JSON.parse(attr);
                } catch {
                    return {};
                }
            }
        },
    };

    #pending = false;

    connectedCallback(){
        super.connectedCallback();

        this.#resolveViewLogic().then((vl)=>{
            if(!vl){
                throw new ReferenceError(`ViewLogic class "${this.getAttribute("view-logic")}" not found.`);
            }
            const params = this.params;
            this[AlierLogic._protected.logic] = new vl(params);
            this.#relate();

            this.logic.assignHost(this);
            this.logic.post(this.logic.message("onLoad", null, params));

            if (this.#pending) {
                this.#pending = false;
                this.#setupBinding();
            }
        });
    }

    #relate(){
        if(this.innerHTML.trim().length !== 0){
            const html = `<alier-container>${this.innerHTML}</alier-container>`;
            const container = this.logic.loadContainer({ text: html });
            this.innerHTML = "";

            this.logic.relateElements(
                this.logic.collectElements(container)
            );
            this[AlierLogic._protected.shadowRoot].append(container);
        } else {
            this[AlierLogic._protected.shadowRoot].append(this.logic.styles, this.logic.container);
        }
    }


    async #resolveViewLogic(){
        const vlClassName = this.getAttribute("view-logic");
        const modulePath = this.getAttribute("module");

        let importedClass = null;
        if(modulePath){
            const canonicalUrl = new URL(modulePath, document.baseURI).pathname;
            const mod = await import(canonicalUrl);
            importedClass = mod[vlClassName] || mod.default || null;
        }
        const vlClass = importedClass || globalThis[vlClassName];

        if (typeof vlClass === "function") {
            const viewLogicModule = await import('./ViewLogic.js');

            if (!(vlClass.prototype instanceof viewLogicModule.ViewLogic)) {
                throw new TypeError(`"${vlClassName}" is not a ViewLogic class.`);
            }
        }
        return vlClass;
    }

    #source = null;

    get source() { return this.#source; }
    set source(value) { this.#source = value; }


    /**  @type {string | null} */
    #primaryKey = null;

    #getPrimaryKey(){
        if(this.#primaryKey !== null) return this.#primaryKey;

        this.#primaryKey = this.dataset.primary ?? "value";
        return this.#primaryKey;
    }

    onDataBinding(source) {
        if (!("setValue" in source) || typeof source.setValue !== "function") {
            throw new TypeError("source object must have `setValue` function");
        }
        const originalSource = this.source;
        this.source = source;
        if (originalSource) {
            return;
        }

        if(!this.logic){
            this.#pending = true;
            return;
        }
        this.#setupBinding();
    }

    #setupBinding(){
        const primaryKey = this.#getPrimaryKey();

        const target = this.logic[primaryKey];
        if (!(target instanceof HTMLElement)) {
            throw Error(`Not found the primary property: ${primaryKey}`);
        }

        const { node: bindNode, key: bindKey } = getPrimaryProperty(target);
        let value = bindNode[bindKey];

        const desc = getPropertyDescriptor(bindNode, bindKey);
        const getter = desc.get ?? (() => value);
        const setter = desc.set ?? ((v) => { value = v; });

        Object.defineProperty(bindNode, bindKey, {
            configurable: true,
            get: getter,
            set: (newValue) => {
                const oldValue = bindNode[bindKey];

                setter.call(bindNode, newValue);
                const current_value = bindNode[bindKey];
                if(oldValue === current_value) return;

                if(this.source){
                    try {
                        this.source.setValue(current_value);
                    } catch (err) {
                        throw Error (`Failed to call \`source.setValue()\` for ${primaryKey} property`, { cause: err });
                    }
                }
            }
        });
    }

    /**
     * Set the value to the primary property.
     * @param {any} incomingValue To be updated.
     */
	setValue(incomingValue) {
        if(!this.logic) return false;
        const primaryKey = this.#getPrimaryKey();

        const oldValue = this.logic.curateValues()[primaryKey];

        this.logic.reflectValues({[primaryKey]: incomingValue});
        const newValue = this.logic.curateValues()[primaryKey];
        if(Array.isArray(oldValue) && Array.isArray(newValue)){
            if (oldValue.length === newValue.length &&
                oldValue.every((v, i) => v === newValue[i])) {
                return false;
            }
        }else{
            if(oldValue === newValue) return false;
        }
        return true;
	}

    /**
     * Get the value of the primary property.
     * @returns {any}
     */
	getValue() {
        const primaryKey = this.#getPrimaryKey();
        return this.logic.curateValues()[primaryKey];
	}

    set value(newValue) {
        this.setValue(newValue);
    }

    get value() {
        return this.getValue();
    }

}

AlierComposite.use();
export { AlierComposite };
