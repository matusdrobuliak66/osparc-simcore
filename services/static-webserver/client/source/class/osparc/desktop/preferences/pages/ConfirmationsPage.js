/* ************************************************************************

   osparc - the simcore frontend

   https://osparc.io

   Copyright:
     2021 IT'IS Foundation, https://itis.swiss

   License:
     MIT: https://opensource.org/licenses/MIT

   Authors:
     * Odei Maiz (odeimaiz)

************************************************************************ */

/**
 * Confirmations in preferences dialog
 */

qx.Class.define("osparc.desktop.preferences.pages.ConfirmationsPage", {
  extend: osparc.desktop.preferences.pages.BasePage,

  construct: function() {
    const iconSrc = "@FontAwesome5Solid/question-circle/24";
    const title = this.tr("Confirmation Settings");
    this.base(arguments, title, iconSrc);

    const confirmationSettings = this.__createConfirmationsSettings();
    this.add(confirmationSettings);

    if (osparc.product.Utils.showPreferencesExperimental()) {
      const experimentalSettings = this.__createExperimentalSettings();
      this.add(experimentalSettings);
    }
  },

  members: {
    __createConfirmationsSettings: function() {
      // layout
      const label = this._createHelpLabel(this.tr("Ask for confirmation for the following actions:"));
      this.add(label);

      this.add(new qx.ui.core.Spacer(null, 10));

      const preferencesSettings = osparc.Preferences.getInstance();

      const box = new qx.ui.container.Composite(new qx.ui.layout.VBox(10)).set({
        paddingLeft: 10
      });

      const cbConfirmBackToDashboard = new qx.ui.form.CheckBox(this.tr("Go back to the Dashboard"));
      preferencesSettings.bind("confirmBackToDashboard", cbConfirmBackToDashboard, "value");
      cbConfirmBackToDashboard.addListener("changeValue", e => osparc.Preferences.patchPreferenceField("confirmBackToDashboard", cbConfirmBackToDashboard, e.getData()));
      box.add(cbConfirmBackToDashboard);

      const studyAlias = osparc.product.Utils.getStudyAlias({firstUpperCase: true});
      const cbConfirmDeleteStudy = new qx.ui.form.CheckBox(this.tr("Delete a ") + studyAlias);
      preferencesSettings.bind("confirmDeleteStudy", cbConfirmDeleteStudy, "value");
      cbConfirmDeleteStudy.addListener("changeValue", e => {
        if (e.getData()) {
          osparc.Preferences.patchPreferenceField("confirmDeleteStudy", cbConfirmDeleteStudy, true);
        } else {
          const msg = this.tr("Warning: deleting a ") + studyAlias + this.tr(" cannot be undone");
          const win = new osparc.ui.window.Confirmation(msg).set({
            confirmText: this.tr("Understood"),
            confirmAction: "delete"
          });
          win.center();
          win.open();
          win.addListener("close", () => {
            if (win.getConfirmed()) {
              osparc.Preferences.patchPreferenceField("confirmDeleteStudy", cbConfirmDeleteStudy, false);
            } else {
              cbConfirmDeleteStudy.setValue(true);
            }
          }, this);
        }
      }, this);
      box.add(cbConfirmDeleteStudy);

      if (!(osparc.product.Utils.isProduct("tis") || osparc.product.Utils.isProduct("s4llite"))) {
        const cbConfirmDeleteNode = new qx.ui.form.CheckBox(this.tr("Delete a Node"));
        preferencesSettings.bind("confirmDeleteNode", cbConfirmDeleteNode, "value");
        cbConfirmDeleteNode.addListener("changeValue", e => {
          if (e.getData()) {
            osparc.Preferences.patchPreferenceField("confirmDeleteNode", cbConfirmDeleteNode, true);
          } else {
            const msg = this.tr("Warning: deleting a node cannot be undone");
            const win = new osparc.ui.window.Confirmation(msg).set({
              confirmText: this.tr("Understood"),
              confirmAction: "delete"
            });
            win.center();
            win.open();
            win.addListener("close", () => {
              if (win.getConfirmed()) {
                osparc.Preferences.patchPreferenceField("confirmDeleteNode", cbConfirmDeleteNode, false);
              } else {
                cbConfirmDeleteNode.setValue(true);
              }
            }, this);
          }
        }, this);
        box.add(cbConfirmDeleteNode);

        const cbConfirmStopNode = new qx.ui.form.CheckBox(this.tr("Stop Node"));
        preferencesSettings.bind("confirmStopNode", cbConfirmStopNode, "value");
        cbConfirmStopNode.addListener("changeValue", e => osparc.Preferences.patchPreferenceField("confirmStopNode", cbConfirmStopNode, e.getData()));
        box.add(cbConfirmStopNode);

        const cbSnapNodeToGrid = new qx.ui.form.CheckBox(this.tr("Snap Node to grid"));
        preferencesSettings.bind("snapNodeToGrid", cbSnapNodeToGrid, "value");
        cbSnapNodeToGrid.addListener("changeValue", e => osparc.Preferences.patchPreferenceField("snapNodeToGrid", cbSnapNodeToGrid, e.getData()));
        box.add(cbSnapNodeToGrid);
      }

      return box;
    },

    __createExperimentalSettings: function() {
      // layout
      const box = this._createSectionBox("Experimental preferences");

      const label = this._createHelpLabel(this.tr(
        "This is a list of experimental preferences"
      ));
      box.add(label);

      const preferencesSettings = osparc.Preferences.getInstance();

      const cbAutoPorts = new qx.ui.form.CheckBox(this.tr("Connect ports automatically"));
      preferencesSettings.bind("autoConnectPorts", cbAutoPorts, "value");
      cbAutoPorts.addListener("changeValue", e => osparc.Preferences.patchPreferenceField("autoConnectPorts", cbAutoPorts, e.getData()));
      box.add(cbAutoPorts);

      return box;
    }
  }
});
