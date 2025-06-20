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

import "./_dependency_Web.js";

// For Web
if (!("Alier" in globalThis)) {
(() => {

"use strict";

/**
 * Definition of constants intended to be used in the global scope.
 */

const LogLevel = Object.freeze({
    DEBUG : 0,
    INFO  : 1,
    WARN  : 2,
    ERROR : 3,
    FAULT : 4
});

const LogFilterConfig = Object.seal({
    minLogLevel: LogLevel.DEBUG,
    startId    : 0,
    endId      : Number.MAX_SAFE_INTEGER
});

function _initAlier() {
    const Alier = Object.create(null);
    
    {
        const loadText = AlierPlatformSpecifics.loadText;

        const Base64DecodeTable = new Map([
            ...(Array.prototype.map.call("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", (v, i) => [v.charCodeAt(), i]))
            , ["+".charCodeAt(), 0b111110]  //  Original implementation
            , ["/".charCodeAt(), 0b111111]  //  Original implementation
            , ["-".charCodeAt(), 0b111110]  //  URL safe variant
            , ["_".charCodeAt(), 0b111111]  //  URL safe variant
            , ["=".charCodeAt(), 0b000000]  //  Padding character
        ]);

        const Base64EncodeTable = new Map([
            ...(Array.prototype.map.call("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", (v, i) => [i, v.charCodeAt()]))
            , [0b111110, "+".charCodeAt()]
            , [0b111111, "/".charCodeAt()]
        ]);

        const Base64UrlSafeEncodeTable = new Map([
            ...(Array.prototype.map.call("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", (v, i) => [i, v.charCodeAt()]))
            , [0b111110, "-".charCodeAt()]
            , [0b111111, "_".charCodeAt()]
        ]);

        /**
         * Encodes the given data into a Base64 string.
         * 
         * @param {string | ArrayBuffer | Uint8Array | ({ buffer: ArrayBuffer } )} data 
         * Data to be encoded.
         * 
         * @param {boolean} urlSafe 
         * A boolean indicating whether or not the given data to be encoded in the URL-safe manner.
         * 
         * @returns 
         * A Base64 string.
         * 
         * @throws {TypeError}
         * -  the given argument {@link data} is neither one of a string or `ArrayBuffer` or an `Uint8Array` or an object having an array buffer.
         * -  the given argument {@link urlSafe} is not a boolean.
         */
        function encodeBase64String(data, urlSafe = false) {
            const data_ = (typeof data === "string") ?
                    new TextEncoder().encode(data) :
                (data instanceof ArrayBuffer) ?
                    new Uint8Array(data) :
                (data != null && (data.buffer instanceof ArrayBuffer)) ?
                    new Uint8Array(data.buffer) :
                    data
            ;
            const url_safe = urlSafe;

            if (!(data_ instanceof Uint8Array)) {
                throw new TypeError(`${data} is not an Uint8Array`);
            } else if (typeof url_safe !== "boolean") {
                throw new TypeError(`${url_safe} is not a boolean`);
            }

            const base64 = [];
            for (let i = 0; i < data_.byteLength; i += 3) {

                const b0 = data_[i + 0];
                const b1 = data_[i + 1];
                const b2 = data_[i + 2];

                if (b0 === undefined) { break; }

                const unit = (((b0 ?? 0) << 8 | (b1 ?? 0)) << 8) | (b2 ?? 0);
                
                const u0 = (unit & 0xfc0000) >> 18;
                const u1 = (unit & 0x03f000) >> 12;
                const u2 = (unit & 0x000fc0) >>  6;
                const u3 = (unit & 0x00003f);
                const eq = "=".charCodeAt();

                const encoded_unit = url_safe ? [
                    Base64UrlSafeEncodeTable.get(u0),
                    Base64UrlSafeEncodeTable.get(u1),
                    b1 === undefined ? eq : Base64UrlSafeEncodeTable.get(u2),
                    b2 === undefined ? eq : Base64UrlSafeEncodeTable.get(u3)
                ] : [
                    Base64EncodeTable.get(u0),
                    Base64EncodeTable.get(u1),
                    b1 === undefined ? eq : Base64EncodeTable.get(u2),
                    b2 === undefined ? eq : Base64EncodeTable.get(u3)
                ];

                base64.push(...encoded_unit);

                if (b1 === undefined || b2 === undefined) { break; }
            }

            return new TextDecoder("us-ascii", {fatal: true}).decode(new Uint8Array(base64));
        }

        /**
         * Decodes a Base64 encoded string into an `ArrayBuffer`.
         * 
         * @param {string} b64string a string representing a Base64 encoded byte sequence
         * @throws {TypeError} when the given value is not a string
         * @throws {SyntaxError}
         * -  when the given string's length is not multiple of 4
         * -  when invalid character, a character is neither an alphanumeric nor `+` nor `/` nor `-` nor `_` nor `=`, is found
         */
        function decodeBase64String(b64string) {
            if (typeof b64string !== "string") {
                throw new TypeError(`${b64string} is not a string`);
            } else if (b64string.length % 4 !== 0) {
                throw new SyntaxError("Base64 encoded string's length must be multiple of 4");
            }
            const new_buf       = new ArrayBuffer(b64string.length / 4 * 3)
            const decoded_bytes = new Uint8Array(new_buf);
            let offset = 0;
            for (let i = 0; i < b64string.length; i += 4) {

                const code_0 = b64string.charCodeAt(i + 0);
                const code_1 = b64string.charCodeAt(i + 1);
                const code_2 = b64string.charCodeAt(i + 2);
                const code_3 = b64string.charCodeAt(i + 3);

                //  decode an unit of Base64 characters with the table.
                //  Each of unit_* represents a 6-bit code taken from the original byte sequence.
                const unit_0 = Base64DecodeTable.get(code_0);  //  if code isn't a valid character, get() returns undefined.
                const unit_1 = Base64DecodeTable.get(code_1);  //  ditto.
                const unit_2 = Base64DecodeTable.get(code_2);
                const unit_3 = Base64DecodeTable.get(code_3);

                if (unit_0 === undefined || unit_1 === undefined || unit_2 === undefined || unit_3 === undefined) {
                    throw new SyntaxError(`Invalid character found: ${JSON.stringify(b64string.slice(i, i + 4))}`);
                }

                {
                    const eq = "=".charCodeAt(0);
                    if (code_0 === eq) {
                        break;
                    } else if (code_1 === eq) {
                        const data = unit_0 << 2;
                        const bytes = [data & 0x0000ff];
                        decoded_bytes.set(bytes, offset);
                        offset += 1;
                        break;
                    } else if (code_2 === eq) {
                        const data = ((unit_0 << 6) | unit_1) << 4;
                        const bytes = [(data & 0x00ff00) >> 8, data & 0x0000ff];
                        if (bytes[1] === 0) {
                            bytes.pop();
                        }
                        decoded_bytes.set(bytes, offset);
                        offset += bytes.length;
                        break;
                    } else if (code_3 === eq) {
                        const data = ((((unit_0 << 6) | unit_1) << 6) | unit_2) << 6;
                        const bytes = [(data & 0xff0000) >> 16, (data & 0x00ff00) >> 8, data & 0x0000ff];
                        if (bytes[2] === 0) {
                            bytes.pop();
                        }
                        decoded_bytes.set(bytes, offset);
                        offset += bytes.length;
                        break;
                    } else {
                        //  concatenate 4 of 6-bit ints into a single 24 bit int.
                        const data   = (((((unit_0 << 6) | unit_1) << 6) | unit_2) << 6) | unit_3;
                        const bytes = [(data & 0xff0000) >> 16, (data & 0x00ff00) >> 8, data & 0x0000ff];

                        //  split 24-bit int to 3 of 8 bit ints.
                        decoded_bytes.set(bytes, offset);
                        offset += bytes.length;
                    }
                }
            }

            return new_buf.slice(0, offset);
        }

        /**
         * Decodes a data URL into an object.
         * 
         * @param {string | URL} dataUrl an `URL` or a `string` representing a data URL.
         * @returns
         * Type of the return value is depending on the content-type of the given URL.
         * 
         * -  If the content-type is `text/`, then this function will return a `string`.
         * -  If the content-type is `application/json`, then this function will return any value can being represented as a JSON string.
         * -  Otherwise, this function will return an `Uint8Array`.
         * 
         * @throws {TypeError}
         * -  when the given argument {@link dataUrl} is neither an URL nor a string.
         * @throws {SyntaxError}
         * -  when the given URL does not start with "data:".
         * -  when the given data URL contains a syntax error.
         */
        function decodeDataUrl(dataUrl) {
            const data_url = dataUrl instanceof URL ? dataUrl.toString() : dataUrl;

            if (typeof data_url !== "string") {
                throw new TypeError(`${data_url} is not a string`);
            } else if (!/^data:/i.test(data_url)) {
                throw new SyntaxError(`${JSON.stringify(data_url)} does not start with "data:"`);
            }

            // data-url     ::=  "data:" [content-type] [";" "base64"] "," encoded-data
            // content-type ::=  type "/" subtype *[";" param-name "=" param-value]

            const regex = /,|=|;|:|[\x21\x23-\x2b\x2d-\x39\x3c\x3e-\x7e\x80-\xff]+|"(?:\\"|[^"])*"/g;
            const content_type = { value: undefined, params: null };

            let   wait_param_name  = false;
            let   wait_param_value = false;
            let   param_name       = "";
            const url_body = data_url.replace(/^data:/i, "");
            for (const m of url_body.matchAll(regex)) {
                const token = m[0];

                if (token === ",") {
                    const data = decodePayload(url_body.slice(m.index + 1), {
                        isUrl: true, 
                        isBase64: content_type.params?.base64 ?? false, 
                    });
                    return { data: data, type: content_type.value ?? "text/plain", charset: content_type.params?.charset ?? "utf-8" };
                } else if (token === "=") {
                    if (wait_param_value) {
                        throw new SyntaxError(`Unexpected token ${JSON.stringify(token)} occurs. Missing a parameter-value token.`);
                    } else if (content_type.params == null) {
                        throw new SyntaxError(`Unexpected token ${JSON.stringify(token)} occurs. Missing ";".`);
                    } else if (param_name.length === 0) {
                        throw new SyntaxError(`Unexpected token ${JSON.stringify(token)} occurs. Missing a parameter-name token.`);
                    }
                    wait_param_value = true;
                } else if (token ===  ";") {
                    if (wait_param_name) {
                        throw new SyntaxError(`Unexpected token ${JSON.stringify(token)} occurs. Missing a parameter-name token.`);
                    }
                    if (content_type.params == null) {
                        content_type.params = {};
                    }
                    wait_param_name  = true;
                    param_name       = "";
                } else if (wait_param_value) {
                    if (wait_param_name) {
                        throw new SyntaxError(`Unexpected token ${JSON.stringify(token)} occurs. Missing a parameter-name token.`);
                    }
                    content_type.params[param_name] = token;
                    wait_param_value = false;
                } else if (wait_param_name) {
                    if (param_name.length > 0) {
                        throw new SyntaxError(`Unexpected token ${JSON.stringify(token)} occurs`);
                    }
                    param_name = token.toLowerCase();
                    content_type.params[param_name] = true;
                    wait_param_name = false;
                } else {
                    if (content_type.value !== undefined) {
                        throw new SyntaxError(`Unexpected token ${JSON.stringify(token)} occurs. Duplicate values detected.`);
                    }
                    content_type.value = token;
                }
            }
            throw new SyntaxError("Missing comma preceding encoded data");
        }

        function decodePayload(data, o) {
            if (o === null || typeof o !== "object") {
                throw new TypeError(`${o} is not a non-null object`);
            } else if (typeof data !== "string") {
                throw new TypeError(`${data} is not a string`);
            }

            const is_url     = o.isUrl ?? false;
            const is_base64  = o.isBase64 ?? false;

            return is_base64 ?
                    new Uint8Array(decodeBase64String(data)) :
                is_url ?
                    decodeURIComponent(data) :
                    data
            ;
        } 
        
        const snip_defaults = {
            maxLineLength: 40
        };
        function snip(s, options = snip_defaults) {
            const maxLineLength = options.maxLineLength ?? snip_defaults.maxLineLength;
            const snip_symbol     = " (…) ";
            const max_line_length = (Number.isNaN(maxLineLength) || maxLineLength < 40) ? 40 : Math.floor(maxLineLength);
            const left_length     = (max_line_length - max_line_length % 2) / 2;
            const right_length    = max_line_length - left_length;
            const nth = (() => {
                const cache = { s: undefined, n: undefined, index: undefined, count: undefined };
                return (s, n) => {
                    //  requires
                    //  requires - type check
                    if (typeof s !== "string") {
                        throw new TypeError(`${s} is not a string`);
                    }
                    //  init
                    //  init - convert n to its appropriate value
                    n = Number(n);
                    if (Number.isNaN(n) || n < 0) {
                        n = Infinity;
                    }
                    if (n < Number.MAX_SAFE_INTEGER && !Number.isInteger(n)) {
                        n = Math.floor(n);
                    }
                
                    //  do
                    //  init - return value
                    let index = 0;
                    let count = 0;
                    //  do - apply cache
                    if (cache.s === s && cache.n <= n) {
                        index = cache.index;
                        count = cache.count;
                    }
                
                    //  do - seek index of n-th character
                    for (; index < s.length && count < n; count++) {
                        // get Unicode code-point of index-th character and count its number of code-units.
                        index += String.fromCodePoint(s.codePointAt(index)).length;
                    }
                
                    //  do - update cache
                    cache.s     = s;
                    cache.n     = n;
                    cache.index = index;
                    cache.count = count;
                
                    //  do - return index and count
                    return { index, count };
                };
            })();
            const slice = (s, start, end) => {
                //  requires
                //  requires - type check
                if (typeof s !== "string") {
                    throw new TypeError(`${s} is not a string`);
                }
                //  init
                //  init - count number of characters
                const len = nth(s).count;
                //  init - convert the start index to its appropriate value
                start = Number(start);
                if (Number.isNaN(start) || start < -len) {
                    start = 0;
                } else if (start < 0) {
                    start = start + len;
                }
                if (start < Number.MAX_SAFE_INTEGER && !Number.isInteger(start)) {
                    start = Math.floor(start);
                }
            
                //  init - convert the end index to its appropriate value
                end = Number(end);
                if (Number.isNaN(end)) {
                    end = len;
                } else if (end < -len) {
                    end = 0;
                } else if (end < 0) {
                    end = end + len;
                }
                if (end < Number.MAX_SAFE_INTEGER && !Number.isInteger(end)) {
                    end = Math.floor(end);
                }
            
                //  do
                //  do - return an empty string if either
                //       start index exceeds string length or
                //       the end index precedes the start index.
                if (len <= start || end <= start) {
                    return "";
                }
            
                //  do - seek the start index and the end index
                const i = nth(s, start).index;
                const j = nth(s, end).index;
            
                //  do - return slice of the given string
                return s.slice(i, j);
            };
            const s_ = (typeof s === "string" ? s : s.toString());
            const len = nth(s_).count;
            const lines = len > max_line_length ?
                `${slice(s_, 0, left_length)}${snip_symbol}${slice(s_, -right_length)}`.split("\n") :
                [s_]
            ;
            return lines.length < 2 ? lines[0] : `${lines[0]}${snip_symbol}${lines[lines.length - 1]}`;
        };

        const dump_defaults = Object.assign({
            format: ({value, type}) => `${value}::${type}`
        }, snip_defaults);
        /**
         * Converts the given object or primitive to the string explaining about its value and type.
         * 
         * __CAVEAT: THIS FUNCTION IS DESIGNED FOR DEBUGGING PURPOSES. DO NOT USE FOR OTHER PURPOSES.__
         *  
         * @param {any} o
         * An object or a primitive to be dumped
         * 
         * @param {object} options 
         * @param {number} options.maxLineLength
         * Maximum length of a line measured in units of Unicode code-points.
         * 
         * If a line exceeds this limit, it will be snipped to fit the limit.
         * 
         * By default, the limit is set to 40 characters.
         * 
         * @param {({ value: string, type: string }) => string} options.format
         * A function formats a pair of a value and its type.
         * 
         * A object such as `{ value, type }` will be passed as a parameter for this function,
         * and each of the given object's properties is already converted to a string. 
         * 
         * This function will be invoked when object data is given.
         * For primitive data, this function will not be invoked.
         * 
         * By default, the value-type pair will be converted to `"{value}::{type}"`.
         * 
         * @param {WeakSet?} _refs
         * A weak set of references included in the given object.
         * This set is used to detect circular reference and updated during recursive calls.
         * 
         * @returns
         * A string containing a string representation of the given object with its type.
         * 
         * @see
         * - {@link dumpArgs}
         * - {@link logFilter}
         * - {@link logd}
         * - {@link logi}
         * - {@link logw}
         * - {@link loge}
         * - {@link logf}
         */
        const dump = (()=> {
            const null_prototype_object_tag = "[null-protoType object]";
            return (o, options = dump_defaults, _refs = new WeakSet()) => {
                const format = options.format ?? dump_defaults.format;
                if (!(_refs instanceof WeakSet)) {
                    _refs = new WeakSet();
                }
                switch (typeof o) {
                case "undefined":
                    return "undefined";
                case "string":
                    return JSON.stringify(snip(o, options));
                case "bigint":
                    return snip(`${o}n`, options);
                case "number":
                case "boolean":
                case "symbol":
                    return snip(o.toString(), options);
                case "function":
                    return format({
                        value: snip(o.toString(), options),
                        type : `function ${o.name}()`
                    });
                case "object":
                    if (o === null) {
                        return "null";
                    } else if (_refs.has(o)) {
                        return "[circular reference]";
                    } else {
                        _refs.add(o);
                        if (o instanceof Map) {
                            const entries = [...o];
                            return format({
                                value: ["{", entries.reduce((_, [k, v], i, self) => {
                                    self[i] = `${dump(k, options, _refs)}: ${dump(v, options, _refs)}`;
                                    return self;
                                }, entries).join(", "), "}"].join(""),
                                type : o.constructor?.name ?? null_prototype_object_tag
                            });
                        } else if (o instanceof Date) {
                            return format({
                                value: o.toISOString(),
                                type : o.constructor.name
                            });
                        } else if ((o instanceof Number) || (o instanceof String) || (o instanceof Boolean)) {
                            return format({
                                value: o.toString(),
                                type : o.constructor.name
                            });
                        } else if (o instanceof Error) {
                            return format({
                                value: JSON.stringify(o.message),
                                type : o.constructor.name
                            });
                        } else if (typeof o[Symbol.iterator] === "function") {
                            const values = [...o];
                            return format({
                                value: [ "[", values.reduce((_, v, i, self) => {
                                    self[i] = dump(v, options, _refs);
                                    return self;
                                }, values).join(", "), "]" ].join(""),
                                type : o.constructor?.name ?? null_prototype_object_tag
                            });
                        } else {
                            const entries = Object.entries(o);
                            return format({
                                value: ["{", entries.reduce((_, [k, v], i, self) => {
                                    self[i] = `${dump(k, options, _refs)}: ${dump(v, options, _refs)}`;
                                    return self;
                                }, entries).join(", "), "}"].join(""),
                                type : o.constructor?.name ?? null_prototype_object_tag
                            });
                        }
                    }
                }
            };
        })();

        /**
         * A helper function for dumping a set of a function parameters.
         * 
         * CAVEAT: THIS FUNCTION IS DESIGNED FOR DEBUGGING PURPOSES. DO NOT USE FOR OTHER PURPOSES.
         *  
         * @param {object} argObj
         * An object containing a set of function parameters.
         * 
         * Each name of properties represents the corresponding parameter's name and
         * Each value of properties represents the corresponding parameter's value.
         * 
         * @param {object} options 
         * @param {number} options.maxLineLength
         * Maximum length of a line measured in units of Unicode code-points.
         * 
         * If a line exceeds this limit, it will be snipped to fit the limit.
         * 
         * By default, the limit is set to 40 characters.
         * 
         * @param {({ value: string, type: string }) => string} options.format
         * 
         * A function formats a pair of a value and its type.
         * 
         * By default, the value-type pair will be converted to `"{value}::{type}"`.
         * 
         * @returns
         * A string containing a string representation of the given object with its type.
         * 
         * @see
         * - {@link dump}
         * - {@link logFilter}
         * - {@link logd}
         * - {@link logi}
         * - {@link logw}
         * - {@link loge}
         * - {@link logf}
         */
        const dumpArgs = (argObj, options = dump_defaults) => {
            return Object.entries(argObj).map(([k, v]) => `${k} = ${dump(v, options)}`).join(", ");
        };

        /**
         * Creates a message object.
         * 
         * @param {string} id
         * A string representing the primary identifier of the message to create.
         * 
         * @param {string} code
         * A string representing the secondary identifier of the message to create.
         * 
         * @param {any} param
         * Additional parameter bound with the message to create.
         * 
         * @param {any} origin
         * The origin of the message to create.
         * 
         * @returns {({
         *      id: string,
         *      code: string,
         *      param: any,
         *      origin: any
         * })}
         * A message object.
         */
        function message(id, code, param, origin) {
            return Object.defineProperties(Object.create(null), {
                id: {
                    enumerable  : true,
                    writable    : false,
                    configurable: false,
                    value       : id
                },
                code: {
                    enumerable  : true,
                    writable    : false,
                    configurable: false,
                    value       : code
                },
                param: {
                    enumerable  : true,
                    writable    : false,
                    configurable: false,
                    value       : param
                },
                origin: {
                    enumerable  : true,
                    writable    : false,
                    configurable: false,
                    value       : origin ?? null
                },
            });
        }

        //  define Alier.Sys
        //  Any function or constant referenced via Alier.Sys, such as Alier.Sys.logd,
        //  should be included in the below definition.
        Object.defineProperty(Alier, "Sys", {
            writable    : false,
            configurable: false,
            enumerable  : true,
            value       : {
                dump                   : dump,
                dumpArgs               : dumpArgs,
                logFilter              : logFilter,
                logd                   : logd,
                logi                   : logi,
                logw                   : logw,
                loge                   : loge,
                logf                   : logf,
                loadText               : loadText,
                decodeDataUrl          : decodeDataUrl,
                decodeBase64String     : decodeBase64String,
                encodeBase64String     : encodeBase64String,
            },
        });

        let running_task = null;
        /**
         * @async
         * Runs the given function after the DOM content is loaded.
         * 
         * @param {(...any) => void | Promise<void>} mainFn 
         * A function behave as the main function.
         * 
         * @param  {...any} args arguments for the given `main` function.
         */
        const main = async (mainFn, ...args) => {
            if (typeof mainFn !== "function") {
                throw new TypeError(`${mainFn} is not a function`);
            }

            const { MessagePorter } = await import("./MessagePorter.js");
            globalThis.MessagePorter = MessagePorter;

            if (document.readyState === "loading") {
                await new Promise((resolve) => {
                    document.addEventListener("DOMContentLoaded", resolve, { once: true });
                });
            }

            if (running_task instanceof Promise) {
                await running_task;
            }

            let resolve,
                reject
            ;
            const result = new Promise((resolve_, reject_) => {
                resolve = resolve_;
                reject  = reject_;
            });

            running_task = result;

            queueMicrotask(async () => {
                const AsyncFunction          = (async function(){}).constructor;
                const GeneratorFunction      = (function*(){}).constructor;
                const AsyncGeneratorFunction = (async function*(){}).constructor;

                let last_state = null;
                switch (mainFn.constructor) {
                    case AsyncFunction: {
                        last_state = await mainFn(...args);
                    }
                    break;
                    case AsyncGeneratorFunction: {
                        for await (const curr_state of mainFn(...args)) {
                            last_state = curr_state;
                        }
                    }
                    break;
                    case GeneratorFunction: {
                        for (const curr_state of mainFn(...args)) {
                            last_state = curr_state;
                        }
                    }
                    break;
                    default:
                        last_state = mainFn(...args);
                }
                running_task = null;
                resolve(last_state);
            });

            return result;
        };

        Object.defineProperties(Alier, {
            main: {
                writable    : false,
                configurable: false,
                enumerable  : false,
                value       : main
            },
            message: {
                writable    : false,
                configurable: false,
                enumerable  : true,
                value       : message
            }
        });
    }

    delete globalThis.AlierPlatformSpecifics;

    //  Make every enumerable properties in Alier.Sys read-only and non-configurable.
    //  And if the property name starts with underscore "_", make it non-enumerable.
    //  This prevents the properties from being redefined.
    for (const key of Object.keys(Alier.Sys)) {
        Object.defineProperty(Alier.Sys, key, {
            writable    : false,
            configurable: false,
            enumerable  : !(key.startsWith("_"))
        });
    }

    Object.defineProperties(globalThis, {
        Alier: {
            value         : Alier,
            enumerable    : true,
            writable      : false,
            configurable  : false
        },
        LogLevel: {
            value         : LogLevel,
            enumerable    : true,
            writable      : false,
            configurable  : false
        },
        LogFilterConfig: {
            value         : LogFilterConfig,
            enumerable    : true,
            writable      : false,
            configurable  : false
        },
    });
    
    // return Alier module object.
    return Alier;
}

// Log for JavaScript
/**
 * Sets log filter configurations.
 * 
 * @param {number} minLogLevel 
 * An integer representing the lowest log level to be shown.
 * This argument should be one of the following:
 * 
 * -  {@link LogLevel.DEBUG}
 * -  {@link LogLevel.INFO}
 * -  {@link LogLevel.WARN}
 * -  {@link LogLevel.ERROR}
 * -  {@link LogLevel.FAULT}
 * 
 * @param {number} startId 
 * An integer representing the lower end of the range of log ids to be shown.
 * 
 * @param {number} endId 
 * An integer representing the higher end of the range of log ids to be shown.
 * 
 * @returns {[logLevel: number, startId: number, endId: number]}
 * an array of old configurations.
 */
function logFilter(minLogLevel, startId, endId) {
    const   prev_level    = LogFilterConfig.minLogLevel,
            prev_start_id = LogFilterConfig.startId,
            prev_end_id   = LogFilterConfig.endId
    ;

    const   level    = Number(minLogLevel),
            start_id = Number(startId),
            end_id   = Number(endId)
    ;

    if (Number.isNaN(level) || Number.isNaN(start_id) || Number.isNaN(end_id) || start_id > end_id) {
        // ignore invalid input
        return [prev_level, prev_start_id, prev_end_id];
    }

    switch (level) {
    case LogLevel.DEBUG:
    case LogLevel.INFO:
    case LogLevel.WARN:
    case LogLevel.ERROR:
    case LogLevel.FAULT: {
        LogFilterConfig.minLogLevel = level;
        LogFilterConfig.startId     = start_id;
        LogFilterConfig.endId       = end_id;
        break;
    }
    default:
        // ignore unknown log level
    }

    return [prev_level, prev_start_id, prev_end_id];
}

// Shown on Logcat but not on Chrome inspect
function logd(id, ...messages) {
    log(LogLevel.DEBUG, id, ...messages);
}

function logi(id, ...messages) {
    log(LogLevel.INFO, id, ...messages);
}

function logw(id, ...messages) {
    log(LogLevel.WARN, id, ...messages);
}

function loge(id, ...messages) {
    log(LogLevel.ERROR, id, ...messages);
}

// JavaScript dose not have fault log level, so it outputs at the error log level.
function logf(id, ...messages) {
    log(LogLevel.FAULT, id, ...messages);
}

function log(level, id, ...messages) {
    const { minLogLevel, startId, endId } = LogFilterConfig;
    if (level >= minLogLevel && ((id >= startId && id <= endId) || (id >= 0 && id <= 999))) {
        const fixed_digits = (n, padding) => {
            const digits = n.toString();
            return digits.length < padding.length ?
                (padding + digits).slice(-padding.length) :
                digits
            ;
        };
        const zero_pad_id = fixed_digits(id, "0".repeat(4));
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(`alier:JS:DEBUG:${zero_pad_id}: `, ...messages);
                break;
            case LogLevel.INFO:
                console.info(`alier:JS:INFO:${zero_pad_id}: `, ...messages);
                break;
            case LogLevel.WARN:
                console.warn(`alier:JS:WARN:${zero_pad_id}: `, ...messages);
                break;
            case LogLevel.ERROR:
                console.error(`alier:JS:ERROR:${zero_pad_id}: `, ...messages);
                break;
            case LogLevel.FAULT:
                console.error(`alier:JS:FAULT:${zero_pad_id}: `, ...messages);
                break;
        }
    }
}

/**
 * @type {({
 *      Sys: { [function_name]: Function }
 * })}
 */
_initAlier();
})();
}
