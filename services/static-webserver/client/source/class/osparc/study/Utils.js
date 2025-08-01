/* ************************************************************************

   osparc - the simcore frontend

   https://osparc.io

   Copyright:
     2020 IT'IS Foundation, https://itis.swiss

   License:
     MIT: https://opensource.org/licenses/MIT

   Authors:
     * Odei Maiz (odeimaiz)

************************************************************************ */

/**
 * Collection of methods for studies
 */

qx.Class.define("osparc.study.Utils", {
  type: "static",

  statics: {
    createStudyFromService: function(key, version, existingStudies, newStudyLabel, contextProps = {}) {
      return new Promise((resolve, reject) => {
        osparc.store.Services.getService(key, version)
          .then(metadata => {
            const newUuid = osparc.utils.Utils.uuidV4();
            // context props, otherwise Study will be created in the root folder of my personal workspace
            const minStudyData = Object.assign(osparc.data.model.Study.createMinStudyObject(), contextProps);
            if (newStudyLabel === undefined) {
              newStudyLabel = metadata["name"];
            }
            if (existingStudies) {
              const existingNames = existingStudies.map(study => study["name"]);
              const title = osparc.utils.Utils.getUniqueName(newStudyLabel, existingNames);
              minStudyData["name"] = title;
            } else {
              minStudyData["name"] = newStudyLabel;
            }
            if (metadata["thumbnail"]) {
              minStudyData["thumbnail"] = metadata["thumbnail"];
            }
            minStudyData["workbench"][newUuid] = {
              "key": metadata["key"],
              "version": metadata["version"],
              "label": metadata["name"]
            };
            if (!("ui" in minStudyData)) {
              minStudyData["ui"] = {};
            }
            if (!("workbench" in minStudyData["ui"])) {
              minStudyData["ui"]["workbench"] = {};
            }
            minStudyData["ui"]["workbench"][newUuid] = {
              "position": {
                "x": 250,
                "y": 100
              }
            };
            if (!("mode" in minStudyData["ui"])) {
              minStudyData["ui"]["mode"] = metadata["type"] && metadata["type"] === "dynamic" ? "standalone" : "pipeline";
            }
            const inaccessibleServices = osparc.store.Services.getInaccessibleServices(minStudyData["workbench"])
            if (inaccessibleServices.length) {
              const msg = osparc.store.Services.getInaccessibleServicesMsg(inaccessibleServices, minStudyData["workbench"]);
              reject({
                message: msg
              });
              return;
            }
            osparc.study.Utils.createStudyAndPoll(minStudyData)
              .then(studyData => resolve(studyData["uuid"]))
              .catch(err => reject(err));
          })
          .catch(err => osparc.FlashMessenger.logError(err));
      });
    },

    createStudyAndPoll: function(studyData) {
      return new Promise((resolve, reject) => {
        const pollPromise = osparc.store.Study.getInstance().createStudy(studyData);
        const pollTasks = osparc.store.PollTasks.getInstance();
        const interval = 1000;
        pollTasks.createPollingTask(pollPromise, interval)
          .then(task => {
            task.addListener("resultReceived", e => {
              const resultData = e.getData();
              resolve(resultData);
            });
            task.addListener("pollingError", e => {
              const err = e.getData();
              reject(err);
            });
          })
          .catch(err => reject(err));
      });
    },

    createStudyFromTemplate: function(templateData, loadingPage, contextProps = {}) {
      return new Promise((resolve, reject) => {
        osparc.store.Services.getStudyServicesMetadata(templateData)
          .finally(() => {
            const inaccessibleServices = osparc.store.Services.getInaccessibleServices(templateData["workbench"]);
            if (inaccessibleServices.length) {
              const msg = osparc.store.Services.getInaccessibleServicesMsg(inaccessibleServices, templateData["workbench"]);
              reject({
                message: msg
              });
              return;
            }
            // context props, otherwise Study will be created in the root folder of my personal workspace
            const minStudyData = Object.assign(osparc.data.model.Study.createMinStudyObject(), contextProps);
            minStudyData["name"] = templateData["name"];
            minStudyData["description"] = templateData["description"];
            minStudyData["thumbnail"] = templateData["thumbnail"];
            const pollPromise = osparc.store.Study.getInstance().createStudyFromTemplate(templateData["uuid"], minStudyData);
            const pollTasks = osparc.store.PollTasks.getInstance();
            const interval = 1000;
            pollTasks.createPollingTask(pollPromise, interval)
              .then(task => {
                const title = qx.locale.Manager.tr("CREATING ") + osparc.product.Utils.getStudyAlias({allUpperCase: true}) + " ...";
                const progressSequence = new osparc.widget.ProgressSequence(title).set({
                  minHeight: 180 // four tasks
                });
                progressSequence.addOverallProgressBar();
                loadingPage.clearMessages();
                loadingPage.addWidgetToMessages(progressSequence);
                task.addListener("updateReceived", e => {
                  const updateData = e.getData();
                  if ("task_progress" in updateData && loadingPage) {
                    const taskProgress = updateData["task_progress"];
                    const message = taskProgress["message"];
                    const percent = osparc.data.PollTask.extractProgress(updateData);
                    progressSequence.setOverallProgress(percent);
                    const existingTask = progressSequence.getTask(message);
                    if (existingTask) {
                      // update task
                      osparc.widget.ProgressSequence.updateTaskProgress(existingTask, {
                        value: percent,
                        progressLabel: parseFloat((percent*100).toFixed(2)) + "%"
                      });
                    } else {
                      // new task
                      // all the previous steps to 100%
                      progressSequence.getTasks().forEach(tsk => osparc.widget.ProgressSequence.updateTaskProgress(tsk, {
                        value: 1,
                        progressLabel: "100%"
                      }));
                      // and move to the next new task
                      const subTask = progressSequence.addNewTask(message);
                      osparc.widget.ProgressSequence.updateTaskProgress(subTask, {
                        value: percent,
                        progressLabel: "0%"
                      });
                    }
                  }
                }, this);
                task.addListener("resultReceived", e => {
                  const studyData = e.getData();
                  resolve(studyData);
                }, this);
                task.addListener("pollingError", e => {
                  const err = e.getData();
                  reject(err);
                }, this);
              })
              .catch(err => reject(err));
          });
      });
    },

    duplicateStudy: function(studyData) {
      const text = qx.locale.Manager.tr("Duplicate process started and added to the background tasks");
      osparc.FlashMessenger.logAs(text, "INFO");

      const pollPromise = osparc.store.Study.getInstance().duplicateStudy(studyData["uuid"]);
      const pollTasks = osparc.store.PollTasks.getInstance();
      return pollTasks.createPollingTask(pollPromise)
    },

    createTemplateTypeSB: function() {
      const templateTypeSB = new qx.ui.form.SelectBox().set({
        allowGrowX: false,
      });
      const templateTypes = [{
        label: "Template",
        id: osparc.data.model.StudyUI.TEMPLATE_TYPE,
      }, {
        label: "Tutorial",
        id: osparc.data.model.StudyUI.TUTORIAL_TYPE,
      }, {
        label: "Hypertool",
        id: osparc.data.model.StudyUI.HYPERTOOL_TYPE,
      }]
      templateTypes.forEach(tempType => {
        const tItem = new qx.ui.form.ListItem(tempType.label, null, tempType.id);
        templateTypeSB.add(tItem);
      });
      return templateTypeSB;
    },

    extractTemplateType: function(templateData) {
      if (templateData && templateData["ui"] && templateData["ui"]["templateType"]) {
        return templateData["ui"]["templateType"];
      }
      return null;
    },

    isAnyLinkedNodeMissing: function(studyData) {
      const existingNodeIds = Object.keys(studyData["workbench"]);
      const linkedNodeIds = osparc.data.model.Workbench.getLinkedNodeIds(studyData["workbench"]);
      const allExist = linkedNodeIds.every(linkedNodeId => existingNodeIds.includes(linkedNodeId));
      return !allExist;
    },

    extractUniqueServices: function(workbench) {
      const services = new Set([]);
      Object.values(workbench).forEach(srv => {
        services.add({
          key: srv.key,
          version: srv.version
        });
      });
      return Array.from(services);
    },

    extractComputationalServices: function(workbench) {
      const computationals = Object.values(workbench).filter(node => {
        const metadata = osparc.store.Services.getMetadata(node["key"], node["version"]);
        return metadata && osparc.data.model.Node.isComputational(metadata);
      });
      return computationals;
    },

    extractDynamicServices: function(workbench) {
      const dynamics = Object.values(workbench).filter(node => {
        const metadata = osparc.store.Services.getMetadata(node["key"], node["version"]);
        return metadata && osparc.data.model.Node.isDynamic(metadata);
      });
      return dynamics;
    },

    extractFilePickers: function(workbench) {
      const parameters = Object.values(workbench).filter(srv => srv["key"].includes("simcore/services/frontend/file-picker"));
      return parameters;
    },

    extractParameters: function(workbench) {
      const parameters = Object.values(workbench).filter(srv => osparc.data.model.Node.isParameter(srv));
      return parameters;
    },

    extractFunctionableParameters: function(workbench) {
      // - for now, only float types are allowed
      const parameters = Object.values(workbench).filter(srv => osparc.data.model.Node.isParameter(srv) && srv["key"].includes("parameter/number"));
      return parameters;
    },

    extractProbes: function(workbench) {
      const parameters = Object.values(workbench).filter(srv => osparc.data.model.Node.isProbe(srv));
      return parameters;
    },

    extractFunctionableProbes: function(workbench) {
      // - for now, only float types are allowed
      const parameters = Object.values(workbench).filter(srv => osparc.data.model.Node.isProbe(srv) && srv["key"].includes("probe/number"));
      return parameters;
    },

    isPotentialFunction: function(workbench) {
      // in order to create a function, the pipeline needs:
      // - at least one parameter or one probe
      //   - for now, only float types are allowed
      // - at least one computational service
      // - no dynamic services

      // const filePickers = osparc.study.Utils.extractFilePickers(workbench);
      // const parameters = osparc.study.Utils.extractParameters(workbench);
      // const probes = osparc.study.Utils.extractProbes(workbench);
      // return (filePickers.length + parameters.length) && probes.length;

      const parameters = osparc.study.Utils.extractFunctionableParameters(workbench);
      const probes = osparc.study.Utils.extractFunctionableProbes(workbench);
      const computationals = osparc.study.Utils.extractComputationalServices(workbench);
      const dynamics = osparc.study.Utils.extractDynamicServices(workbench);

      return (
        (parameters.length || probes.length) &&
        computationals.length > 0 &&
        dynamics.length === 0
      );
    },

    getCantReadServices: function(studyServices = []) {
      return studyServices.filter(studyService => studyService["myAccessRights"]["execute"] === false);
    },

    anyServiceRetired: function(studyServices) {
      const isRetired = studyServices.some(studyService => {
        if (studyService["release"] && studyService["release"]["retired"]) {
          const retirementDate = new Date(studyService["release"]["retired"]);
          const currentDate = new Date();
          return retirementDate < currentDate;
        }
        return false;
      });
      return isRetired;
    },

    anyServiceDeprecated: function(studyServices) {
      const isDeprecated = studyServices.some(studyService => {
        if (studyService["release"] && studyService["release"]["retired"]) {
          const retirementDate = new Date(studyService["release"]["retired"]);
          const currentDate = new Date();
          return retirementDate > currentDate;
        }
        return false;
      });
      return isDeprecated;
    },

    anyServiceUpdatable: function(studyServices) {
      const isUpdatable = studyServices.some(studyService => {
        if (studyService["release"] && studyService["release"]["compatibility"]) {
          return Boolean(studyService["release"]["compatibility"]);
        }
        return false;
      });
      return isUpdatable;
    },

    updatableNodeIds: function(workbench, studyServices) {
      const nodeIds = [];
      for (const nodeId in workbench) {
        const node = workbench[nodeId];
        const studyServiceFound = studyServices.find(studyService => studyService["key"] === node["key"] && studyService["release"]["version"] === node["version"]);
        if (studyServiceFound && studyServiceFound["release"] && studyServiceFound["release"]["compatibility"]) {
          nodeIds.push(nodeId);
        }
      }
      return nodeIds;
    },

    isInDebt: function(studyData) {
      return osparc.store.Study.getInstance().isStudyInDebt(studyData["uuid"]);
    },

    extractDebtFromError: function(studyId, err) {
      const msg = err["message"];
      // The backend might have thrown a 402 because the wallet was negative
      const match = msg.match(/last transaction of\s([-]?\d+(\.\d+)?)\sresulted/);
      let debt = null;
      if ("debtAmount" in err) {
        // the study has some debt that needs to be paid
        debt = err["debtAmount"];
      } else if (match) {
        // the study has some debt that needs to be paid
        debt = parseFloat(match[1]); // Convert the captured string to a number
      }
      if (debt) {
        // if get here, it means that the 402 was thrown due to the debt
        osparc.store.Study.getInstance().setStudyDebt(studyId, debt);
      }
      return debt;
    },

    getUiMode: function(studyData) {
      if ("ui" in studyData && "mode" in studyData["ui"]) {
        return studyData["ui"]["mode"];
      }
      return null;
    },

    state: {
      getProjectStatus: function(state) {
        if (
          state &&
          "shareState" in state &&
          "status" in state["shareState"]
        ) {
          return state["shareState"]["status"];
        }
        return null;
      },

      isProjectLocked: function(state) {
        if (
          state &&
          "shareState" in state &&
          "locked" in state["shareState"]
        ) {
          return state["shareState"]["locked"];
        }
        return false;
      },

      getCurrentGroupIds: function(state) {
        if (
          state &&
          "shareState" in state &&
          "currentUserGroupids" in state["shareState"]
        ) {
          return state["shareState"]["currentUserGroupids"];
        }

        return [];
      },

      getPipelineState: function(state) {
        if (
          state &&
          "state" in state &&
          "value" in state["state"]
        ) {
          return state["state"]["value"];
        }
        return undefined;
      },

      PIPELINE_RUNNING_STATES: [
        "PUBLISHED",
        "PENDING",
        "WAITING_FOR_RESOURCES",
        "WAITING_FOR_CLUSTER",
        "STARTED",
        "STOPPING",
        "RETRY",
      ],

      isPipelineRunning: function(state) {
        const pipelineState = this.getPipelineState(state);
        if (pipelineState) {
          return this.PIPELINE_RUNNING_STATES.includes(pipelineState);
        }
        return false;
      },
    },

    __getBlockedState: function(studyData) {
      if (studyData["services"] === null) {
        return "UNKNOWN_SERVICES";
      } else if (studyData["services"]) {
        const cantReadServices = osparc.study.Utils.getCantReadServices(studyData["services"]);
        const inaccessibleServices = osparc.store.Services.getInaccessibleServices(studyData["workbench"]);
        if (cantReadServices.length || inaccessibleServices.length) {
          return "UNKNOWN_SERVICES";
        }
      }
      if (studyData["state"] && studyData["state"]["shareState"] && studyData["state"]["shareState"]["locked"]) {
        return "IN_USE";
      }
      if (this.isInDebt(studyData)) {
        return "IN_DEBT";
      }
      return false;
    },

    canBeOpened: function(studyData) {
      const blocked = this.__getBlockedState(studyData);
      if (osparc.utils.DisabledPlugins.isRTCEnabled()) {
        return ["IN_USE", false].includes(blocked);
      }
      return [false].includes(blocked);
    },

    canShowBillingOptions: function(studyData) {
      const blocked = this.__getBlockedState(studyData);
      return ["IN_DEBT", false].includes(blocked);
    },

    canShowServiceUpdates: function(studyData) {
      const blocked = this.__getBlockedState(studyData);
      return [false].includes(blocked);
    },

    canShowServiceBootOptions: function(studyData) {
      const blocked = this.__getBlockedState(studyData);
      return [false].includes(blocked);
    },

    canShowStudyData: function(studyData) {
      const blocked = this.__getBlockedState(studyData);
      return ["UNKNOWN_SERVICES", false].includes(blocked);
    },

    canShowPreview: function(studyData) {
      const blocked = this.__getBlockedState(studyData);
      if (osparc.utils.DisabledPlugins.isRTCEnabled()) {
        return ["IN_USE", false].includes(blocked);
      }
      return [false].includes(blocked);
    },

    canBeDeleted: function(studyData) {
      const blocked = this.__getBlockedState(studyData);
      return ["UNKNOWN_SERVICES", false].includes(blocked);
    },

    canBeDuplicated: function(studyData) {
      const blocked = this.__getBlockedState(studyData);
      return [false].includes(blocked);
    },

    canBeExported: function(studyData) {
      const blocked = this.__getBlockedState(studyData);
      return ["UNKNOWN_SERVICES", false].includes(blocked);
    },

    canMoveTo: function(studyData) {
      const blocked = this.__getBlockedState(studyData);
      return ["UNKNOWN_SERVICES", false].includes(blocked);
    },

    getNonFrontendNodes: function(studyData) {
      return Object.values(studyData["workbench"]).filter(nodeData => !osparc.data.model.Node.isFrontend(nodeData));
    },

    guessIcon: function(studyData) {
      if (
        (osparc.product.Utils.isProduct("tis") || osparc.product.Utils.isProduct("tiplite")) &&
        ["app", "guided"].includes(studyData["ui"]["mode"])
      ) {
        return new Promise(resolve => resolve(this.__guessTIPIcon(studyData)));
      }
      return this.__guessIcon(studyData);
    },

    __guessIcon: function(studyData) {
      return new Promise(resolve => {
        if (studyData["ui"]["mode"] === "pipeline") {
          resolve(osparc.data.model.StudyUI.PIPELINE_ICON);
        } else {
          const productIcon = osparc.dashboard.CardBase.PRODUCT_ICON;
          const wbServices = this.getNonFrontendNodes(studyData);
          if (wbServices.length === 1) {
            const wbService = wbServices[0];
            osparc.store.Services.getService(wbService.key, wbService.version)
              .then(serviceMetadata => {
                if (serviceMetadata && serviceMetadata["icon"]) {
                  resolve(serviceMetadata["icon"]);
                }
                resolve(productIcon);
              })
              .catch(() => resolve(productIcon));
          } else {
            resolve(osparc.data.model.StudyUI.PIPELINE_ICON);
          }
        }
      });
    },

    __guessTIPIcon: function(studyData) {
      // the was to guess the TI type is to check the boot mode of the ti-postpro in the pipeline
      const tiPostpro = Object.values(studyData["workbench"]).find(srv => srv.key.includes("ti-postpro"));
      if (tiPostpro && tiPostpro["bootOptions"]) {
        switch (tiPostpro["bootOptions"]["boot_mode"]) {
          case "0":
            // classic TI
            return "osparc/icons/TI.png";
          case "1":
            // multichannel
            return "osparc/icons/MC.png";
          case "2":
            // phase-modulation
            return "osparc/icons/PM.png";
          case "3":
            // personalized TI
            return "osparc/icons/pTI.png";
          case "4":
            // personalized multichannel
            return "osparc/icons/pMC.png";
          case "5":
            // personalized phase-modulation
            return "osparc/icons/pPM.png";
          default:
            return "osparc/icons/TI.png";
        }
      }
      return "osparc/icons/TI.png";
    },
  }
});
