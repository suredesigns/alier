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

const HTML_RESULT_KEY = Symbol("html result");
const PARTS_PROPERTY_KEY = Symbol("parts");

const RENDER_MARKER = "alier-render-marker";
const NODE_MARKER = "alier-marker-node";

/**
 * HTML content as template and variable parts
 */
class Template {
    /** @type {Part[]} */
    #parts;

    /** @type {HTMLTemplateElement} */
    #template;

    /**
     * @constructor
     *
     * @param {string[]} strings
     * Array of string fragments splited by values.
     * It is `strings` property of the result of `html()`.
     */
    constructor(strings) {
        const { content, parts } = parseHtmlParts(strings);
        this.#parts = parts;
        this.#template = document.createElement("template");
        this.#template.innerHTML = content;
    }

    /**
     * Clone template to and attach parts to it.
     *
     * @returns {{ content: DocumentFragment, parts: Part[] }}
     */
    clone() {
        const content = this.#template.content.cloneNode(true);
        // TODO: clone parts to cache Template instance

        const reAttrMarker = /alier-marker-attr (\d+)-(\d+)/;
        const reNodeMarker = /alier-marker-node (\d+)/;
        /** @type {(node: Node) => void} */
        const addParts = (node) => {
            for (const child of node.childNodes) {
                if (child.nodeType === document.COMMENT_NODE) {
                    let match;
                    const value = child.nodeValue.trim();
                    if ((match = value.match(reAttrMarker)) !== null) {
                        const startIndex = Number(match[1]);
                        const endIndex = Number(match[2]);
                        const parts = this.#parts.slice(startIndex, endIndex);
                        parts.forEach((part) => part.__node = child.nextSibling);
                    } else if ((match = value.match(reNodeMarker)) !== null) {
                        const index = Number(match[1]);
                        const part = this.#parts[index];
                        part.__node = child;
                    }
                }
                addParts(child);
            }
        };

        addParts(content);

        return { content, parts: this.#parts };
    }
}

// Descriptors to detect parse result
const DESCRIPTOR_TAG_START = 0;
const DESCRIPTOR_TAG_END = 1;
const DESCRIPTOR_CLOSE_TAG = 2;
const DESCRIPTOR_ATTR_PART = 3;
const DESCRIPTOR_ATTR_END = 4;
const DESCRIPTOR_COMMENT = 5;

/**
 * @param {string[]} strings
 * @returns {{ content: string, parts: (AttrPart | ChildPart)[] }}
 */
function parseHtmlParts(strings) {
    let content = "";
    const parts = [];

    let previousDescriptor = DESCRIPTOR_TAG_END;
    const symbolicPieceDescriptor = {
        [DESCRIPTOR_TAG_START]: (piece) => {
            content += piece.str;
        },
        [DESCRIPTOR_TAG_END]: (piece) => {
            content += piece.str;
        },
        [DESCRIPTOR_CLOSE_TAG]: (piece) => {
            content += piece.str;
        },
        [DESCRIPTOR_ATTR_PART]: (piece, index) => {
            // insert marker to detect start index of attribute part
            if (previousDescriptor === DESCRIPTOR_TAG_START) {
                const tagStartPosition = content.lastIndexOf("<");
                const substrBeforeTag = content.substring(0, tagStartPosition);
                const substrTagBegin = content.substring(tagStartPosition);

                const markerStartPart = `<!-- alier-marker-attr ${index}-{{}} -->`;

                content = substrBeforeTag + markerStartPart + substrTagBegin;
            }

            // cut attribute part at last and save it
            const re = /(?<=^|\s)(?<prefix>[\.\?@]?)(?<name>[^\s=\.\?@]+)=$/;
            const tagStr = piece.str;
            const match = re.exec(tagStr);
            if (match === null) {
                content += tagStr;
            } else {
                const { prefix, name } = match.groups;
                const part = (
                    prefix === "." ?
                        new PropPart(index, name) :
                    prefix === "?" ?
                        new BoolPart(index, name) :
                    prefix === "@" ?
                        new EventPart(index, name) :
                        new AttrPart(index, name)
                );
                content += tagStr.substring(0, match.index);
                parts.push(part);
            }
        },
        [DESCRIPTOR_ATTR_END]: (piece, index) => {
            // fill end index for part
            content = content.replace(
                /<\!-- alier-marker-attr (\d+)-{{}} -->/,
                `<!-- alier-marker-attr $1-${index} -->`
            );
            content += piece.str;
        },
        [DESCRIPTOR_COMMENT]: (piece) => {
            content += piece.str;
        },
    };

    const updateContent = (piece, index) => {
        symbolicPieceDescriptor[piece.descriptor](piece, index);
        previousDescriptor = piece.descriptor;
    }

    for (let index = 0; index < strings.length; index++) {
        const str = strings[index];

        const pieces = collectSymbolicPieces(str);

        let lastIndex = 0;
        for (const piece of pieces) {
            // insert text node
            if (lastIndex < piece.start) {
                content += str.substring(lastIndex, piece.start);
            }
            // increment last index
            lastIndex = piece.end;

            // update content for tag descriptor
            updateContent(piece, index);
        }

        if (pieces.length === 0) {
            content += str;
        } else if (pieces.at(-1).end < str.length) {
            content += str.substring(pieces.at(-1).end);
        }

        if (
            [
                DESCRIPTOR_TAG_END,
                DESCRIPTOR_CLOSE_TAG,
                DESCRIPTOR_ATTR_END,
                DESCRIPTOR_COMMENT
            ].includes(previousDescriptor) &&
            index < strings.length - 1
        ) {
            // marker comment
            content += `<!-- ${NODE_MARKER} ${index} -->`
            // close marker comment
            content += `<!-- /${NODE_MARKER} -->`;

            parts.push(new ChildPart(index));
        }
    }

    parts.sort((part1, part2) => part1.__index - part2.__index);

    return { content, parts };
}

function collectSymbolicPieces(str) {
    const pieces = [];
    let match;

    // search tag start
    // FIX: misidentify `<` within quoted marks as tag start position
    const reTagStart = /<(?!\/|!)[^>\s]+/gd;
    while ((match = reTagStart.exec(str)) !== null) {
        pieces.push({
            descriptor: DESCRIPTOR_TAG_START,
            str: match[0],
            start: match.indices[0][0],
            end: match.indices[0][1],
        });
    }

    // search tag end
    const reTagEnd = /(?<=<(?!\/|!)[^<>]*)(?<!-)>/gd;
    while ((match = reTagEnd.exec(str)) !== null) {
        pieces.push({
            descriptor: DESCRIPTOR_TAG_END,
            str: match[0],
            start: match.indices[0][0],
            end: match.indices[0][1],
        });
    }

    // search close tag
    const reCloseTag = /<\/[^>]+>/gd;
    while ((match = reCloseTag.exec(str)) !== null) {
        pieces.push({
            descriptor: DESCRIPTOR_CLOSE_TAG,
            str: match[0],
            start: match.indices[0][0],
            end: match.indices[0][1],
        });
    }

    // search attribute in the middle
    const reAttrPart = /[\.\?@]?[^\s=\.\?@]+=$/d;
    if ((match = reAttrPart.exec(str)) !== null) {
        pieces.push({
            descriptor: DESCRIPTOR_ATTR_PART,
            str: match[0],
            start: match.indices[0][0],
            end: match.indices[0][1],
        });
    }

    // search attribute part end
    const reAttrEnd = /(?<=^[^<>]*)(?<!-)>/gd;
    while ((match = reAttrEnd.exec(str)) !== null) {
        pieces.push({
            descriptor: DESCRIPTOR_ATTR_END,
            str: match[0],
            start: match.indices[0][0],
            end: match.indices[0][1],
        });
    }

    // search comment tag
    const reComment = /<\!--.*-->/sgd;
    while ((match = reComment.exec(str)) !== null) {
        pieces.push({
            descriptor: DESCRIPTOR_COMMENT,
            str: match[0],
            start: match.indices[0][0],
            end: match.indices[0][1],
        });
    }

    // sort in order
    pieces.sort((p1, p2) => p1.start - p2.start);

    return pieces;
}

/**
 * Variable part
 *
 * @abstract
 */
class Part {
    /** @type {number} */
    #index;
    /** @type {Node} */
    #node;

    /**
     * @param {number} index 
     */
    constructor(index) {
        this.#index = index;
    }

    get __index() {
        return this.#index;
    }

    get __node() {
        if (this.#node == null) {
            throw new Error("unavailable node from renderer part");
        }
        return this.#node;
    }

    set __node(node) {
        if (this.#node != null) {
            throw new Error("node is already set to renderer part");
        }
        this.#node = node;
    }

    __setValue(_value) {
        throw new Error("not implemented error");
    }
}

class ChildPart extends Part {
    #cache;

    __setValue(value) {
        /** @type {Comment} */
        const comment = this.__node;

        if (typeof value === "string") {
            const data = value;
            if (data === this.#cache) {
                return;
            }

            const endMarker = "/" + NODE_MARKER;
            clearUntilMarkerComment(comment, endMarker);

            comment.after(data);

            this.#cache = data;
            return;
        }

        if (value[HTML_RESULT_KEY]) {
            /** @type {HtmlResult} */
            const { strings, values } = value;
            const key = strings.join("");

            if (key !== this.#cache) {
                const endMarker = "/" + NODE_MARKER;
                clearUntilMarkerComment(comment, endMarker);

                insertTemplate(strings, values, comment);
            }

            updateParts(comment, values);

            this.#cache = key;
            return;
        }
    }
}

/**
 * @abstract
 */
class TagPart extends Part {
    /** @type {string} */
    #name;

    constructor(index, name) {
        super(index);
        this.#name = name;
    }

    get __name() {
        return this.#name;
    }

    clear() {}
}

class AttrPart extends TagPart {
    #currentValue;
    #observedTarget;

    __setValue(value) {
        const attr = typeof value.get === "function" ? value.get() : value;
        if (attr === this.#currentValue) return;

        /** @type {Element} */
        const element = this.__node;
        if (attr != null) {
            element.setAttribute(this.__name, attr);
        } else {
            element.removeAttribute(this.__name);
        }

        this.#currentValue = attr;

        this.#observedTarget = value;
    }

    clear() {
        if (this.#observedTarget != null) {
            this.#observedTarget.unobserveAttribute?.(this.__node, this.__name);
            this.#observedTarget = null;
        }
    }
}

class PropPart extends TagPart {
    #currentValue;
    #observedTarget;

    __setValue(value) {
        const prop = typeof value.get === "function" ? value.get() : value;
        if (prop === this.#currentValue) return;

        const element = this.__node;
        element[this.__name] = prop;

        this.#currentValue = prop;

        this.#observedTarget = value;
    }

    clear() {
        if (this.#observedTarget != null) {
            this.#observedTarget.unobserveProperty?.(this.__node, this.__name);
            this.#observedTarget = null;
        }
    }
}

class BoolPart extends TagPart {
    #currentValue;
    #observedTarget;

    __setValue(value) {
        const bool = typeof value.get === "function" ? value.get() : value;
        if (bool === this.#currentValue) return;

        /** @type {Element} */
        const element = this.__node;
        if (bool) {
            element.setAttribute(this.__name, "");
        } else if (element.hasAttribute(this.__name)) {
            element.removeAttribute(this.__name);
        }

        this.#currentValue = bool;

        this.#observedTarget = value;
    }

    clear() {
        if (this.#observedTarget != null) {
            this.#observedTarget.unobserveAttribute?.(this.__node, this.__name);
            this.#observedTarget = null;
        }
    }
}

const EVENT_LISTENER_OPTION_KEY = Symbol("listener");

class EventPart extends TagPart {
    #currentListener;

    __setValue(value) {
        const listener = value;

        this.clear();

        const options = listener[EVENT_LISTENER_OPTION_KEY];
        this.__node.addEventListener(this.__name, listener, options);
        this.#currentListener = listener;
    }

    clear() {
        if (this.#currentListener) {
            const options = this.#currentListener[EVENT_LISTENER_OPTION_KEY];
            this.__node.removeEventListener(
                this.__name,
                this.#currentListener,
                options,
            );
        }

        this.#currentListener = null;
    }
}

/**
 * @typedef HtmlResult
 * @property {string[]} strings
 * @property {any[]} values
 */

/**
 * Template tag function to parse html like string.
 *
 * @param {string[]} strings
 * @param {...*} values
 * @returns {HtmlResult}
 */
function html(strings, ...values) {
    const result = { strings, values };
    Object.defineProperty(result, HTML_RESULT_KEY, { value: 1 });
    return result;
}

/**
 * Wrap event listener callback with options.
 *
 * @param {(event: Event) => void} callback
 * Event listener callback.
 * @param {object} options
 * Event listener options.
 * @returns {(event: Event) => void}
 */
function listener(callback, options) {
    const fn = function(event) {
        return callback(event);
    };
    fn[EVENT_LISTENER_OPTION_KEY] = { ...options };
    return fn;
}

/**
 * @param {HtmlResult} htmlTagged
 * @param {Element | ShadowRoot} parentElement
 */
function render(htmlTagged, parentElement) {
    if (typeof htmlTagged !== "object" || !htmlTagged[HTML_RESULT_KEY]) {
        throw new Error("first parameter is the result of `html` tag function");
    }
    const { strings, values } = htmlTagged;

    const marker = RENDER_MARKER;
    const markerEnd = "/" + marker;

    // search inserted render comment node
    let renderStartComment, renderEndComment;
    for (const node of parentElement.childNodes) {
        if (node.nodeType === document.COMMENT_NODE) {
            const value = node.nodeValue.trim();
            if (value.startsWith(marker)) {
                renderStartComment = node;
            } else if (
                renderStartComment != null && value.startsWith(markerEnd)
            ) {
                renderEndComment = node;
                break;
            }
        }
    }

    // first rendering
    if (renderStartComment == null && renderEndComment == null) {
        renderStartComment = document.createComment(marker);
        parentElement.appendChild(renderStartComment);

        renderEndComment = document.createComment(markerEnd);
        parentElement.appendChild(renderEndComment);

        insertTemplate(strings, values, renderStartComment);
    }

    if (renderStartComment == null || renderEndComment == null) {
        throw new Error("no found for marker comment");
    }

    updateParts(renderStartComment, values);
}

/**
 * @param {string[]} strings - Given by `html` tag function.
 * @param {any[]} values - Given by `html` tag function.
 * @param {Comment} startComment - Insert after this comment node.
 */
function insertTemplate(strings, values, startComment) {
    const template = new Template(strings);
    const { content, parts } = template.clone();

    startComment.after(content);
    Object.defineProperty(startComment, PARTS_PROPERTY_KEY, {
        value: parts,
        configurable: true,
    });

    // observe
    for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        const value = values[index];
        if (part instanceof AttrPart || part instanceof BoolPart) {
            value.observeAttribute?.(part.__node, part.__name);
        } else if (part instanceof PropPart) {
            value.observeProperty?.(part.__node, part.__name);
        }
    }
}

/**
 * @param {Node} node - Start node.
 * @param {string} marker - A string of the value of end comment.
 */
function clearUntilMarkerComment(node, marker) {
    for (let next = node.nextSibling; next != null; next = node.nextSibling) {
        if (
            next.nodeType === document.COMMENT_NODE &&
            next.nodeValue.trim() === marker
        ) {
            break;
        }
        next.remove();
    }

    const parts = node[PARTS_PROPERTY_KEY]
    if (Array.isArray(parts)) {
        for (const part of parts) {
            if (part instanceof TagPart) {
                part.clear();
            }
        }
    }
}

/**
 * @param {Node} node - A node attached parts
 * @param {any[]} values - Given values to update.
 */
function updateParts(node, values) {
    /** @type {Part[]} */
    const parts = node[PARTS_PROPERTY_KEY];
    if (!(Array.isArray(parts))) {
        throw new Error("invalid parts");
    }

    parts.forEach((part, index) => {
        if (part instanceof Part) {
            part.__setValue(values[index]);
        }
    });
}

export { html, render, listener };
