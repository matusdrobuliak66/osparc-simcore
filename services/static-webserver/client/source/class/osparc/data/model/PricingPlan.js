/* ************************************************************************

   osparc - the simcore frontend

   https://osparc.io

   Copyright:
     2024 IT'IS Foundation, https://itis.swiss

   License:
     MIT: https://opensource.org/licenses/MIT

   Authors:
     * Odei Maiz (odeimaiz)

************************************************************************ */

/**
 * Class that stores PricingPlan data.
 */

qx.Class.define("osparc.data.model.PricingPlan", {
  extend: qx.core.Object,

  /**
   * @param pricingPlanData {Object} Object containing the serialized PricingPlan Data
   */
  construct: function(pricingPlanData) {
    this.base(arguments);

    this.set({
      pricingPlanId: pricingPlanData.pricingPlanId,
      pricingPlanKey: pricingPlanData.pricingPlanKey,
      classification: pricingPlanData.classification,
      name: pricingPlanData.displayName,
      description: pricingPlanData.description,
      isActive: pricingPlanData.isActive,
      pricingUnits: [],
    });

    if (pricingPlanData.pricingUnits) {
      pricingPlanData.pricingUnits.forEach(pricingUnitData => {
        const pricingUnit = new osparc.data.model.PricingUnit(pricingUnitData);
        this.getPricingUnits().push(pricingUnit);
      });
    }
  },

  properties: {
    pricingPlanId: {
      check: "Number",
      nullable: false,
      init: null,
      event: "changePricingPlanId"
    },

    pricingPlanKey: {
      check: "String",
      nullable: true,
      init: null,
      event: "changePricingPlanKey"
    },

    pricingUnits: {
      check: "Array",
      nullable: true,
      init: [],
      event: "changePricingUnits"
    },

    classification: {
      check: ["TIER", "LICENSE"],
      nullable: false,
      init: null,
      event: "changeClassification"
    },

    name: {
      check: "String",
      nullable: false,
      init: null,
      event: "changeName"
    },

    description: {
      check: "String",
      nullable: true,
      init: null,
      event: "changeDescription"
    },

    isActive: {
      check: "Boolean",
      nullable: false,
      init: false,
      event: "changeIsActive"
    },
  },
});
