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

import { ViewLogic } from "./ViewLogic.js";
import { AlierLogic } from "./AlierLogic.js";


class AlierView extends AlierLogic {
    static tagName = "alier-view";

    static attachShadowOptions = {
        mode: "closed"
    };

    /**
     * Attaches the target {@link ViewLogic} to this AlierView.
     *
     * @param {ViewLogic} viewLogicToAttach
     * A ViewLogic to be attached
     * 
     * @returns
     * detached ViewLogic if it was previously attached, `null` otherwise.
     * 
     * @throws {TypeError} 
     * -  when the given object is not a ViewLogic
     * @see 
     * - {@link AlierView.prototype.detach}
     * - {@link AlierView.prototype.show}
     * - {@link ViewLogic.attachTo}
     */
    attach(viewLogicToAttach) {
        const vl = viewLogicToAttach;

        if (!(vl instanceof ViewLogic)) {
            throw new TypeError(`${vl} is not a ${ViewLogic.name}`);
        } else if (vl.host === this) {
            return null;
        }

        const detached_logic = this.detach();

        this[AlierLogic._protected.logic] = vl;
        ViewLogic.attachTo(vl, this);

        const attached_logic = this.logic;
        this[AlierLogic._protected.shadowRoot].append(attached_logic.styles, attached_logic.container);

        this.show();

        return detached_logic;
    }

    /**
     * Detaches the attached {@link ViewLogic} from this AlierView.
     *
     * @returns
     * detached ViewLogic if it was attached, `null` otherwise.
     * 
     * @see
     * - {@link AlierView.prototype.attach}
     * - {@link AlierView.prototype.hide}
     * - {@link ViewLogic.detachFrom}
     */
    detach() {
        const detached_logic = this.logic;
        if (detached_logic == null) {
            return null;
        }

        this[AlierLogic._protected.logic] = null;

        ViewLogic.detachFrom(detached_logic, this);

        return detached_logic;
    }

}

AlierView.use();

export { AlierView };
