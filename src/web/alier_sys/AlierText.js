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
class AnimationAsort{
    defalutAnimation={
        "down-slide-in":`
        .down-slide-in{
            position: relative;
            animation: fade-in var(--alier-text-transition-speed) ease-out 0s 1 running;         
        }
        @keyframes fade-in{
            0% {
                /* start: from the top of the screen */
                top: -10vh;
                opacity: 0;
            }
            100% {
                /* Move to its original position */
                top: 0;
                opacity: 1;
            }
        }
    `
    }
    originalAnimation={};
    setOriginalAnimation(className,style){
        this.originalAnimation[className]=style;
    }

    //TODO: animations
    //Fade in character by character
    #oneCharactorFadein(text,direction){
        //Wrap each character of the text in a <span> tag.
    }
}

class AlierText extends AlierCustomElement {
    #shadowRoot;
    #animationAsort = new AnimationAsort();
    #animationStyleId = "animation";
    set textContent(value){
        this.value = value;
    }
    get textContent(){
        return this.value;
    }

    static tagName = "alier-text";
    static attachShadowOptions = {
        mode: "closed",
    };
    static formAssociated = false;

    //Attribute
    static propertyDescriptors = {
        fontBold: {
            attribute: "bold",
            boolean: true,
            noSync: false,
            onChange: (target, oldValue, newValue) => {
                const sp = target.#shadowRoot.querySelector("span");
                if(newValue){
                    sp.style.fontWeight="bold";
                }else{
                    sp.style.fontWeight="";
                }
            }
        },
        fontItalic: {
            attribute: "italic",
            boolean: true,
            noSync: false,
            onChange: (target, oldValue, newValue) => {
                const sp = target.#shadowRoot.querySelector("span");
                if(newValue){
                    sp.style.fontStyle="italic";
                }else{
                    sp.style.fontStyle="";
                }
            }
        },
        fontColor: {
            default: "rgb(0,0,0)",
            attribute: "color",
            boolean: false,
            noSync: false,
            onChange: (target, oldValue, newValue) => {
                const sp = target.#shadowRoot.querySelector("span");
                if(newValue){
                    sp.style.setProperty("--alier-fg-col",newValue);
                }else{
                    sp.style.setProperty("--alier-fg-col","");
                }
            }
        },
        fontSize: {
            default: "medium",
            onChange: (target,oldValue,newValue)=>{
                const sp = target.#shadowRoot.querySelector("span");
                sp.style.fontSize = newValue;
            }
        },
        fontFamily: {
            onChange: (target,oldValue,newValue)=>{
                const sp = target.#shadowRoot.querySelector("span");
                sp.style.fontFamily = newValue;
            }
        },
        lineBreak: {
            default: false,
            attribute: "line-break",
            boolean: true,
            onChange: (target,oldValue,newValue)=>{
                const sp = target.#shadowRoot.querySelector("span");
                //Enabled when the ellipsis is not specified.
                if (target.ellipsis) {
                    sp.style.whiteSpace = "nowrap";
                } else if (newValue) {
                    sp.style.whiteSpace = "pre-line";
                } else {
                    sp.style.whiteSpace = "";
                }
            }
        },
        textWordBreak: {
            default: "keep-all",
            onChange: (target,oldValue,newValue)=>{
                const sp = target.#shadowRoot.querySelector("span");
                //For CJK text
                sp.style.wordBreak = newValue;
            }
        },
        textOverflowWrap: {
            onChange: (target,oldValue,newValue)=>{
                const sp = target.#shadowRoot.querySelector("span");
                //For non-CJK text
                sp.style.overflowWrap = newValue;
            }
        },
        animationName: {
            default: "",
            attribute: "animation",
            boolean: false,
            noSync: false,
            onChange: (target, oldValue, newValue) => {
                if(newValue != ""){
                    target.addAnimation(newValue);
                }else{
                    target.deleteAnimation();
                }
            }
        },
        value: {
            boolean: false,
            noSync: false,
            onChange: (target, oldValue, newValue) => {
                const sp = target.#shadowRoot.querySelector("span");
                sp.textContent = newValue;
            }
        },
        //[Experimental]
        ellipsis: {
            attribute: "ellipsis",
            boolean: false,
            noSync: false,
            onChange: (target, oldValue, newValue) => {
                //Ellipsis Color Consistency
                const sp = target.#shadowRoot.querySelector("span");
                if(newValue){
                    const words = newValue.split(" ");
                    if(words.length<2){return}
                    let value = words[0];
                    let width = words[1];
                    sp.style.display = "inline-block";
                    sp.style.overflow = "hidden";
                    sp.style.whiteSpace = "nowrap";
                    sp.style.textOverflow=value;
                    sp.style.width = width;
                }else{
                    sp.style.display = "";
                    sp.style.overflow = "";
                    sp.style.textOverflow="";
                    sp.style.width = "";
                    //If a line break is specified
                    if(target.lineBreak){
                        sp.style.whiteSpace = "pre-line";
                    }else{
                        sp.style.whiteSpace = "";
                    }
                }
            }
        }
    };

    onInitialize(shadowRoot, elementInternals) {
        this.#shadowRoot = shadowRoot;
        if (!this.value) {
            this.value = this.innerHTML;
        }
    }

    render(it){
        return html`
            <span part="text-area">${this.value}</span>
        `
    }

    //TODO:  HTML escaping
    #escapHtmlTag(text){
        const safeText = text
        .replace(/&/g,"&")
        .replace(/</g,"<")
        .replace(/>/g,">")
        .replace(/"/g,"\"")
        .replace(/'/g,"\'")
        return safeText;
    }

    static styles = `
        :host {
            --alier-text-transition-speed: 2s;
        }

        :host span {
            font-family: var(--alier-font, unset);
            color: var(--alier-fg-col, #222);
            font-size: var(--alier-font-size, unset);
            font-bold: var(--alier-font-bold, unset);
            font-italic: var(--alier-font-italic, unset);
            word-break: var(--alier-word-break, unset);
            overflow-wrap: var(--alier-overflow-wrap, unset);
            overflow: var(--alier-overflow, unset);
        }
    `
    //[Experimental]
    addAnimation(name){
        let animationStyle = this.#shadowRoot.querySelector(`#${this.#animationStyleId}`);
        const styleText = this.#animationAsort.defalutAnimation[name];
        const sp = this.#shadowRoot.querySelector("span");
        sp.classList.add(name);
        if(animationStyle===null){
            animationStyle = document.createElement("style");
            animationStyle.id = this.#animationStyleId;
            animationStyle.textContent = styleText;
            this.#shadowRoot.append(animationStyle);
        }else{
            animationStyle.sheet.insertRule(styleText,animationStyle.sheet.cssRules.length);
        }
    }

    //TODO: [WIP] Allow specifying a CSS file
    async addCustomAnimation(filePath,className){
        let animationStyle = this.#shadowRoot.querySelector(`#${this.#animationStyleId}`);
        const styleText = await Alier.Sys.loadText(filePath);
        const sp = this.#shadowRoot.querySelector("span");
        sp.classList.add(className);
        if(animationStyle===null){
            animationStyle = document.createElement("style");
            animationStyle.id = this.#animationStyleId;
            animationStyle.textContent = styleText;
            this.#shadowRoot.append(animationStyle);
        }else{
            animationStyle.sheet.insertRule(styleText,animationStyle.sheet.cssRules.length);
        }
    }
    //[Experimental]
    deleteAnimation(){
        const animationStyle = this.#shadowRoot.querySelector(`#${this.#animationStyleId}`);
        if(animationStyle){
            animationStyle.remove();
        }
    }
}

AlierText.use();

export { AlierText };
