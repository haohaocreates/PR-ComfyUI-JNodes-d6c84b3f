
import { $el } from "/scripts/ui.js";

import { BatchOptionManagerButton } from "./BatchOptionManagerButton.js";

import { utilitiesInstance } from "../../common/Utilities.js";
import { ClassInstanceFactory, imageDrawerComponentManagerInstance } from "../Core/ImageDrawerModule.js";
import { getCurrentContextObject } from "../ContextSelector.js";

class BatchDeletionManager extends BatchOptionManagerButton {

    constructor(args) {

        super(args);

        this.bConfirmState = false;

        this.confirmText = null;
    }

    makeWidget() {

        const superWidget = super.makeWidget();

        {
            const recycleIcon = $el("label", {
                textContent: "♻️",
                style: {
                    color: "white",
                    fontWeight: "bolder",
                    pointerEvents: "none"
                }
            });
            superWidget.button.appendChild(recycleIcon);
        }

        {
            this.confirmText = $el("label", {
                textContent: "Confirm?",
                style: {
                    color: "white",
                    pointerEvents: "none",
                    display: "none"
                }
            });
            superWidget.button.appendChild(this.confirmText);
        }

        // Subscribe to when the selection manager's count is updated
        const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager");
        batchSelectionManagerInstance.registerCheckedItemCountUpdatedMulticastFunction(() => {

            const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager");
            let lastCheckedItemCount = batchSelectionManagerInstance.lastCheckedItemCount;

            if (Object.keys(lastCheckedItemCount).length == 0) {
                lastCheckedItemCount = batchSelectionManagerInstance.countCheckedItems();
            }

            this.setWidgetVisible(lastCheckedItemCount.selectedCount > 0);
        });

        this.setWidgetVisible();

        return superWidget;
    }

    onClickButton() {

        if (!this.bConfirmState) {

            this.setConfirmState(true);

        } else {

            const currentContextObject = getCurrentContextObject();
            if (currentContextObject) {
                currentContextObject.onRequestBatchDeletion();

                const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager");
                batchSelectionManagerInstance.updateWidget();
            }
        }
    }

    setWidgetVisible(bNewVisibile) {

        this.setConfirmState(false);
        super.setWidgetVisible(bNewVisibile);
    }

    setConfirmState(bNewConfirmState) {

        this.bConfirmState = bNewConfirmState;
        utilitiesInstance.setElementVisible(this.confirmText, this.bConfirmState);
    }
}

const factoryInstance = new ClassInstanceFactory(BatchDeletionManager, {
    tooltipText: "Trash, recycle or delete all selected items", buttonClass: "JNodes-image-drawer-menu-delete-selected-button"
});