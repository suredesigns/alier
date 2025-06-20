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

const importAll = async (...paths) => {
    return Object.assign(
        Object.create(null),
        ... await Promise.all(paths.map(path => Alier.import(path)))
    );
};
const defineIfNotDefined = (tag, ctor, options = undefined) => {
    if (customElements.get(tag) === undefined) {
        customElements.define(tag, ctor, options);
    }
};

const {
    AlierModel,
    setupModelInterfaceFromText,
    setupModelInterface,
    ProtoViewLogic,
} = await importAll(
    "/alier_sys/AlierModel.js",
    "/alier_sys/SetupInterface.js",
    "/alier_sys/ProtoViewLogic.js",
);
const { ViewLogic } = await Alier.import("/alier_sys/ViewLogic.js");
const { ViewElement } = await Alier.import("/alier_sys/ViewElement.js");
const {
    ListView,
} = await importAll(
    "/alier_sys/ListView.js",
);

if (!("View" in Alier)) {
    defineIfNotDefined("alier-view", ViewElement);
    defineIfNotDefined("alier-list-view", ListView);
    defineIfNotDefined("alier-app-view", class AppView extends ViewElement {});
    defineIfNotDefined("alier-container", class ContainerView extends HTMLElement {});
    Object.defineProperty(Alier, "View", {
        value     : document.createElement("alier-app-view"),
        writable  : true,
        enumerable: true
    });
    document.body.appendChild(Alier.View);
}

/**
 * Setup Alier environment.
 *
 * NOTE:
 * We plan to port the side effects that occur when importing AlierFramework.js
 * to this function.
 */
async function setupAlier() {}

await Alier.export({
    setupAlier,
    AlierModel,
    ViewLogic,
    ListView,
    setupModelInterfaceFromText,
    setupModelInterface,
    ViewElement,
    ProtoViewLogic,
});
