/* ************************************************************************

   osparc - the simcore frontend

   https://osparc.io

   Copyright:
     2025 IT'IS Foundation, https://itis.swiss

   License:
     MIT: https://opensource.org/licenses/MIT

   Authors:
     * Odei Maiz (odeimaiz)

************************************************************************ */

qx.Class.define("osparc.data.model.LicensedItemResource", {
  extend: qx.core.Object,

  /**
   * @param licensedItemResourceData {Object} Object containing the serialized LicensedItem Data
   */
  construct: function(licensedItemResourceData) {
    this.base(arguments);

    let description = licensedItemResourceData["description"] || "";
    let title = "";
    let subtitle = null;
    description = description.replace(/SPEAG/g, " "); // remove SPEAG substring
    const delimiter = " - ";
    let titleAndSubtitle = description.split(delimiter);
    if (titleAndSubtitle.length > 0) {
      title = titleAndSubtitle[0];
      titleAndSubtitle.shift();
    }
    if (titleAndSubtitle.length > 0) {
      subtitle = titleAndSubtitle.join(delimiter);
    }

    const manufacturerData = {};
    if (licensedItemResourceData["thumbnail"]) {
      if (licensedItemResourceData["thumbnail"].includes("itis.swiss")) {
        manufacturerData["label"] = "IT'IS Foundation";
        manufacturerData["link"] = "https://itis.swiss/virtual-population/";
        manufacturerData["icon"] = "https://media.licdn.com/dms/image/v2/C4D0BAQE_FGa66IyvrQ/company-logo_200_200/company-logo_200_200/0/1631341490431?e=2147483647&v=beta&t=7f_IK-ArGjPrz-1xuWolAT4S2NdaVH-e_qa8hsKRaAc";
      } else if (licensedItemResourceData["thumbnail"].includes("speag.swiss")) {
        manufacturerData["label"] = "Speag";
        manufacturerData["link"] = "https://speag.swiss/products/em-phantoms/overview-2/";
        manufacturerData["icon"] = "https://media.licdn.com/dms/image/v2/D4E0BAQG2CYG28KAKbA/company-logo_200_200/company-logo_200_200/0/1700045977122/schmid__partner_engineering_ag_logo?e=2147483647&v=beta&t=6CZb1jjg5TnnzQWkrZBS9R3ebRKesdflg-_xYi4dwD8";
      }
    }

    this.set({
      modelId: licensedItemResourceData.id,
      description: description,
      title: title,
      subtitle: subtitle,
      thumbnail: licensedItemResourceData.thumbnail || "",
      features: licensedItemResourceData.features || {},
      doi: licensedItemResourceData.doi || null,
      termsOfUseUrl: licensedItemResourceData.termsOfUseUrl || null,
      manufacturerLabel: manufacturerData.label || null,
      manufacturerLink: manufacturerData.link || null,
      manufacturerIcon: manufacturerData.icon || null,
    });
  },

  properties: {
    modelId: {
      check: "Number",
      nullable: false,
      init: null,
      event: "changeModelId",
    },

    description: {
      check: "String",
      nullable: false,
      init: null,
      event: "changeDescription",
    },

    title: {
      check: "String",
      nullable: false,
      init: null,
      event: "changeTitle",
    },

    subtitle: {
      check: "String",
      nullable: true,
      init: null,
      event: "changeSubtitle",
    },

    thumbnail: {
      check: "String",
      nullable: false,
      init: null,
      event: "changeThumbnail",
    },

    features: {
      check: "Object",
      nullable: false,
      init: null,
      event: "changeFeatures",
    },

    doi: {
      check: "String",
      nullable: true,
      init: null,
      event: "changeDoi",
    },

    termsOfUseUrl: {
      check: "String",
      nullable: true,
      init: null,
      event: "changeTermsOfUseUrl",
    },

    manufacturerLabel: {
      check: "String",
      nullable: true,
      init: null,
      event: "changeManufacturerLabel",
    },

    manufacturerLink: {
      check: "String",
      nullable: true,
      init: null,
      event: "changeManufacturerLink",
    },

    manufacturerIcon: {
      check: "String",
      nullable: true,
      init: null,
      event: "changeManufacturerIcon",
    },
  },

  statics: {
    longName: function(licensedResource) {
      const name = licensedResource.getFeatures()["name"] || licensedResource.getSubtitle();
      const version = licensedResource.getFeatures()["version"] || "";
      const functionality = licensedResource.getFeatures()["functionality"] || "Static";
      return `${name} ${version}, ${functionality}`;
    },
  },

  members: {
  }
});
