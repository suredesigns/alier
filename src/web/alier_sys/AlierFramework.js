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

import { AlierModel } from "./AlierModel.js";
import { setupModelInterfaceFromText, setupModelInterface } from "./SetupInterface.js";
import { ProtoViewLogic } from "./ProtoViewLogic.js";

import { ViewLogic } from "./ViewLogic.js";
import { AlierView } from "./AlierView.js";
import { ListView } from "./ListView.js";

const defineIfNotDefined = (tag, ctor, options = undefined) => {
    if (customElements.get(tag) === undefined) {
        customElements.define(tag, ctor, options);
    }
};

/**
 * Setup Alier environment.
 *
 * Define custome elements:
 *
 * - alier-view
 * - alier-list-view
 * - alier-app-view
 * - alier-container
 *
 * Add Alier.View to the body of the document to deploy the Alier application.
 */
function setupAlier() {
    if (!("View" in Alier)) {
        defineIfNotDefined("alier-app-view", class AppView extends AlierView {});
        Object.defineProperty(Alier, "View", {
            value     : document.createElement("alier-app-view"),
            writable  : true,
            enumerable: true
        });
        document.body.appendChild(Alier.View);
    }
}

export {
    setupAlier,
    AlierModel,
    ViewLogic,
    ListView,
    setupModelInterfaceFromText,
    setupModelInterface,
    AlierView,
    ProtoViewLogic,
};
