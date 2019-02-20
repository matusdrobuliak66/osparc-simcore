/* ************************************************************************

   qxapp - the simcore frontend

   https://osparc.io

   Copyright:
     2018 IT'IS Foundation, https://itis.swiss

   License:
     MIT: https://opensource.org/licenses/MIT

   Authors:
     * Odei Maiz (odeimaiz)

************************************************************************ */

/**
 * Class that stores Node data.
 *
 *   For the given version-key, this class will take care of pulling the metadata, store it and
 * fill in all the information.
 *
 *                                    -> {NODES}
 * PROJECT -> METADATA + WORKBENCH ->|
 *                                    -> {LINKS}
 *
 * *Example*
 *
 * Here is a little example of how to use the widget.
 *
 * <pre class='javascript'>
 *   let node = new qxapp.data.model.Node(this, key, version, uuid);
 *   if (nodeData) {
 *     node.populateNodeData(nodeData);
 *   }
 * </pre>
 */

qx.Class.define("qxapp.data.model.Node", {
  extend: qx.core.Object,

  /**
    * @param workbench {qxapp.data.model.Workbench} workbench owning the widget the node
    * @param key {String} key of the service represented by the node (not needed for Containers)
    * @param version {String} version of the service represented by the node (not needed for Containers)
    * @param uuid {String} uuid of the service represented by the node (not needed fpr new Nodes)
  */
  construct: function(workbench, key, version, uuid) {
    this.setWorkbench(workbench);

    this.base(arguments);

    this.__metaData = {};
    this.__innerNodes = {};
    this.__inputNodes = [];
    this.__inputsDefault = {};
    this.__outputs = {};
    this.__logs = [];

    this.set({
      nodeId: uuid || qxapp.utils.Utils.uuidv4()
    });

    if (key && version) {
      // not container
      this.set({
        key: key,
        version: version
      });
      let store = qxapp.data.Store.getInstance();
      let metaData = this.__metaData = store.getNodeMetaData(key, version);
      if (metaData) {
        if (metaData.name) {
          this.setLabel(metaData.name);
        }
        if (metaData.inputsDefault) {
          this.__addInputsDefault(metaData.inputsDefault);
        }
        if (metaData.inputs) {
          this.__addInputs(metaData.inputs);
        }
        if (metaData.outputs) {
          this.__addOutputs(metaData.outputs);
        }
      }
    }
  },

  properties: {
    workbench: {
      check: "qxapp.data.model.Workbench",
      nullable: false
    },

    key: {
      check: "String",
      nullable: true
    },

    version: {
      check: "String",
      nullable: true
    },

    nodeId: {
      check: "String",
      nullable: false
    },

    label: {
      check: "String",
      nullable: true,
      event: "changeLabel"
    },

    propsWidget: {
      check: "qxapp.component.form.renderer.PropForm",
      init: null,
      nullable: true
    },

    inputsMapper: {
      check: "qx.ui.core.Widget",
      init: null,
      nullable: true
    },

    parentNodeId: {
      check: "String",
      nullable: true
    },

    isOutputNode: {
      check: "Boolean",
      init: false,
      nullable: false
    },

    serviceUrl: {
      check: "String",
      nullable: true
    },

    iFrame: {
      check: "qxapp.component.widget.PersistentIframe",
      init: null
    },

    restartIFrameButton: {
      check: "qx.ui.form.Button",
      init: null
    },

    retrieveIFrameButton: {
      check: "qx.ui.form.Button",
      init: null
    },

    progress: {
      check: "Number",
      init: 0,
      event: "changeProgress"
    }
  },

  events: {
    "updatePipeline": "qx.event.type.Data",
    "showInLogger": "qx.event.type.Data"
  },

  members: {
    __metaData: null,
    __innerNodes: null,
    __inputNodes: null,
    __settingsForm: null,
    __inputsDefault: null,
    __inputsDefaultWidget: null,
    __outputs: null,
    __outputWidget: null,
    __posX: null,
    __posY: null,
    __logs: null,

    addLog: function(log) {
      this.__logs.push(log);
    },

    isContainer: function() {
      return (this.getKey() === null);
    },

    getMetaData: function() {
      return this.__metaData;
    },

    getInputValues: function() {
      if (this.isPropertyInitialized("propsWidget") && this.getPropsWidget()) {
        return this.getPropsWidget().getValues();
      }
      return {};
    },

    getInputsDefault: function() {
      return this.__inputsDefault;
    },

    getInput: function(outputId) {
      return this.__inputs[outputId];
    },

    getInputs: function() {
      return this.__inputs;
    },

    getOutput: function(outputId) {
      return this.__outputs[outputId];
    },

    getOutputs: function() {
      return this.__outputs;
    },

    getOutputValues: function() {
      let output = {};
      for (const outputId in this.__outputs) {
        if (this.__outputs[outputId].value) {
          output[outputId] = this.__outputs[outputId].value;
        }
      }
      return output;
    },

    getInnerNodes: function(recursive = false) {
      let innerNodes = Object.assign({}, this.__innerNodes);
      if (recursive) {
        for (const innerNodeId in this.__innerNodes) {
          let myInnerNodes = this.__innerNodes[innerNodeId].getInnerNodes(true);
          innerNodes = Object.assign(innerNodes, myInnerNodes);
        }
      }
      return innerNodes;
    },

    addInnerNode: function(innerNodeId, innerNode) {
      this.__innerNodes[innerNodeId] = innerNode;
    },

    removeInnerNode: function(innerNodeId) {
      delete this.__innerNodes[innerNodeId];
    },

    isInnerNode: function(inputNodeId) {
      return (inputNodeId in this.__innerNodes);
    },

    getExposedInnerNodes: function(recursive = false) {
      const innerNodes = this.getInnerNodes(recursive);
      let exposedInnerNodes = {};
      for (const innerNodeId in innerNodes) {
        const innerNode = innerNodes[innerNodeId];
        if (innerNode.getIsOutputNode()) {
          exposedInnerNodes[innerNodeId] = innerNode;
        }
      }
      return exposedInnerNodes;
    },

    getInputNodes: function() {
      return this.__inputNodes;
    },

    populateNodeData: function(nodeData) {
      this.__startInteractiveNode();

      if (nodeData) {
        if (nodeData.label) {
          this.setLabel(nodeData.label);
        }

        this.setInputData(nodeData);
        this.setOutputData(nodeData);

        if (nodeData.inputNodes) {
          this.__inputNodes = nodeData.inputNodes;
        }

        if (nodeData.outputNode) {
          this.setIsOutputNode(nodeData.outputNode);
        }

        if (nodeData.position) {
          this.setPosition(nodeData.position.x, nodeData.position.y);
        }

        if (nodeData.progress) {
          this.setProgress(nodeData.progress);
        }
      }

      if (this.__inputsDefaultWidget) {
        this.__inputsDefaultWidget.populatePortsData();
      }
      if (this.__outputWidget) {
        this.__outputWidget.populatePortsData();
      }
    },

    repopulateOutputPortData: function() {
      if (this.__outputWidget) {
        this.__outputWidget.populatePortsData();
      }
    },

    getInputsDefaultWidget: function() {
      return this.__inputsDefaultWidget;
    },

    __addInputsDefaultWidgets: function() {
      const isInputModel = false;
      this.__inputsDefaultWidget = new qxapp.component.widget.NodePorts(this, isInputModel);
    },

    /**
     * Remove those inputs that can't be respresented in the settings form
     * (Those are needed for creating connections between nodes)
     *
     */
    __removeNonSettingInputs: function(inputs) {
      let filteredInputs = JSON.parse(JSON.stringify(inputs));
      for (const inputId in filteredInputs) {
        let input = filteredInputs[inputId];
        if (input.type.includes("data:application/s4l-api/")) {
          delete filteredInputs[inputId];
        }
      }
      return filteredInputs;
    },


    /**
     * Add mapper widget if any
     *
     */
    __addMapper: function(inputs) {
      let filteredInputs = JSON.parse(JSON.stringify(inputs));
      if (filteredInputs.mapper) {
        let inputsMapper = new qxapp.component.widget.InputsMapper(this, filteredInputs["mapper"]);
        this.setInputsMapper(inputsMapper);
        delete filteredInputs["mapper"];
      }
      return filteredInputs;
    },

    /**
     * Add settings widget with those inputs that can be represented in a form
     *
     */
    __addSetttings: function(inputs) {
      let form = this.__settingsForm = new qxapp.component.form.Auto(inputs, this);
      form.addListener("linkAdded", e => {
        let changedField = e.getData();
        this.getPropsWidget().linkAdded(changedField);
      }, this);
      form.addListener("linkRemoved", e => {
        let changedField = e.getData();
        this.getPropsWidget().linkRemoved(changedField);
      }, this);

      let propsWidget = new qxapp.component.form.renderer.PropForm(form, this.getWorkbench(), this);
      this.setPropsWidget(propsWidget);
      propsWidget.addListener("RemoveLink", e => {
        let changedField = e.getData();
        this.__settingsForm.removeLink(changedField);
      }, this);
    },

    getOutputWidget: function() {
      return this.__outputWidget;
    },

    __addOutputWidget: function() {
      const isInputModel = true;
      this.__outputWidget = new qxapp.component.widget.NodePorts(this, isInputModel);
    },

    __addInputsDefault: function(inputsDefault) {
      this.__inputsDefault = inputsDefault;

      this.__addInputsDefaultWidgets();
    },

    __addInputs: function(inputs) {
      this.__inputs = inputs;

      if (inputs === null) {
        return;
      }

      let filteredInputs = this.__removeNonSettingInputs(inputs);
      filteredInputs = this.__addMapper(filteredInputs);
      this.__addSetttings(filteredInputs);
    },

    __addOutputs: function(outputs) {
      this.__outputs = outputs;

      this.__addOutputWidget();
    },

    setInputData: function(nodeData) {
      if (this.__settingsForm && nodeData) {
        this.__settingsForm.setData(nodeData.inputs);
      }
    },

    setOutputData: function(nodeData) {
      if (nodeData.outputs) {
        for (const outputKey in nodeData.outputs) {
          this.__outputs[outputKey].value = nodeData.outputs[outputKey];
        }
      }
    },

    addPortLink: function(toPortId, fromNodeId, fromPortId) {
      this.__settingsForm.addLink(toPortId, fromNodeId, fromPortId);
    },

    addInputNode: function(inputNodeId) {
      if (!this.__inputNodes.includes(inputNodeId)) {
        this.__inputNodes.push(inputNodeId);
      }
    },

    removeInputNode: function(inputNodeId) {
      const index = this.__inputNodes.indexOf(inputNodeId);
      if (index > -1) {
        // remove node connection
        this.__inputNodes.splice(index, 1);

        // remove port connections
        let inputs = this.getInputValues();
        for (const portId in inputs) {
          if (inputs[portId] && Object.prototype.hasOwnProperty.call(inputs[portId], "nodeUuid")) {
            if (inputs[portId]["nodeUuid"] === inputNodeId) {
              this.__settingsForm.removeLink(portId);
            }
          }
        }
        return true;
      }
      return false;
    },

    isInputNode: function(inputNodeId) {
      const index = this.__inputNodes.indexOf(inputNodeId);
      return (index > -1);
    },

    __restartIFrame: function(loadThis) {
      if (this.getIFrame() === null) {
        this.setIFrame(new qxapp.component.widget.PersistentIframe());
      }
      if (loadThis) {
        this.getIFrame().resetSource();
        this.getIFrame().setSource(loadThis);
      } else if (this.getServiceUrl() !== null) {
        this.getIFrame().resetSource();
        if (this.getKey().includes("3d-viewer")) {
          // HACK: add this argument to only load the defined colorMaps
          // https://github.com/Kitware/visualizer/commit/197acaf
          const srvUrl = this.getServiceUrl();
          let arg = "?serverColorMaps";
          if (srvUrl[srvUrl.length-1] !== "/") {
            arg = "/" + arg;
          }
          this.getIFrame().setSource(srvUrl + arg);
        } else {
          this.getIFrame().setSource(this.getServiceUrl());
        }
      }
    },

    __showLoadingIFrame: function() {
      const loadingUri = qxapp.utils.Utils.getLoaderUri();
      this.__restartIFrame(loadingUri);
    },

    __retrieveInputs: function() {
      this.__updateBackendAndRetrieveInputs();
    },

    __updateBackendAndRetrieveInputs: function() {
      this.fireDataEvent("updatePipeline", this);
    },

    retrieveInputs: function() {
      let urlUpdate = this.getServiceUrl() + "/retrieve";
      urlUpdate = urlUpdate.replace("//retrieve", "/retrieve");
      let updReq = new qx.io.request.Xhr();
      updReq.set({
        url: urlUpdate,
        method: "GET"
      });
      updReq.send();
    },

    __startInteractiveNode: function() {
      let metaData = this.getMetaData();
      if (metaData && ("type" in metaData) && metaData.type == "dynamic") {
        let retrieveBtn = new qx.ui.form.Button().set({
          icon: "@FontAwesome5Solid/spinner/32"
        });
        retrieveBtn.addListener("execute", e => {
          this.__retrieveInputs();
        }, this);
        retrieveBtn.setEnabled(false);
        this.setRetrieveIFrameButton(retrieveBtn);

        let restartBtn = new qx.ui.form.Button().set({
          icon: "@FontAwesome5Solid/redo-alt/32"
        });
        restartBtn.addListener("execute", e => {
          this.__restartIFrame();
        }, this);
        restartBtn.setEnabled(false);
        this.setRestartIFrameButton(restartBtn);

        this.__showLoadingIFrame();

        const msg = "Starting " + metaData.key + ":" + metaData.version + "...";
        const msgData = {
          nodeLabel: this.getLabel(),
          msg: msg
        };
        this.fireDataEvent("showInLogger", msgData);

        // start the service
        const url = "/running_interactive_services";
        let query = "?service_key=" + encodeURIComponent(metaData.key) + "&service_tag=" + encodeURIComponent(metaData.version) + "&service_uuid=" + encodeURIComponent(this.getNodeId());
        if (metaData.key.includes("/neuroman")) {
          // HACK: Only Neuroman should enter here
          query = "?service_key=" + encodeURIComponent("simcore/services/dynamic/modeler/webserver") + "&service_tag=" + encodeURIComponent("2.8.0") + "&service_uuid=" + encodeURIComponent(this.getNodeId());
        }
        let request = new qxapp.io.request.ApiRequest(url+query, "POST");
        request.addListener("success", this.__onInteractiveNodeStarted, this);
        request.addListener("error", e => {
          const errorMsg = "Error when starting " + metaData.key + ":" + metaData.version + ": " + e.getTarget().getResponse()["error"];
          const errorMsgData = {
            nodeLabel: this.getLabel(),
            msg: errorMsg
          };
          this.fireDataEvent("showInLogger", errorMsgData);
        }, this);
        request.addListener("fail", e => {
          const failMsg = "Failed starting " + metaData.key + ":" + metaData.version + ": " + e.getTarget().getResponse()["error"];
          const failMsgData = {
            nodeLabel: this.getLabel(),
            msg: failMsg
          };
          this.fireDataEvent("showInLogger", failMsgData);
        }, this);
        request.send();
      }
    },

    __onInteractiveNodeStarted: function(e) {
      let req = e.getTarget();
      const {
        data, error
      } = req.getResponse();

      if (error) {
        const msg = "Error received: " + error;
        const msgData = {
          nodeLabel: this.getLabel(),
          msg: msg
        };
        this.fireDataEvent("showInLogger", msgData);
        return;
      }
      const publishedPort = data["published_port"];
      const servicePath=data["service_basepath"];
      const entryPointD = data["entry_point"];
      const nodeId = data["service_uuid"];
      if (nodeId !== this.getNodeId()) {
        return;
      }
      if (servicePath) {
        const entryPoint = entryPointD ? ("/" + entryPointD) : "/";
        let srvUrl = servicePath + entryPoint;
        // FIXME: this is temporary until the reverse proxy works for these services
        if (this.getKey().includes("neuroman") || this.getKey().includes("modeler")) {
          srvUrl = "http://" + window.location.hostname + ":" + publishedPort + srvUrl;
        } else if (this.getKey().includes("3d-viewer")) {
          srvUrl = "http://" + window.location.hostname + ":" + publishedPort + entryPoint;
        }
        this.setServiceUrl(srvUrl);
        const msg = "Service ready on " + srvUrl;
        const msgData = {
          nodeLabel: this.getLabel(),
          msg: msg
        };
        this.fireDataEvent("showInLogger", msgData);

        this.getRetrieveIFrameButton().setEnabled(true);
        this.getRestartIFrameButton().setEnabled(true);
        // FIXME: Apparently no all services are inmediately ready when they publish the port
        const waitFor = 4000;
        qx.event.Timer.once(ev => {
          this.__restartIFrame();
        }, this, waitFor);
      }
    },

    removeNode: function() {
      this.__stopInteractiveNode();
    },

    __stopInteractiveNode: function() {
      if (this.getMetaData().type == "dynamic") {
        let url = "/running_interactive_services";
        let query = "/"+encodeURIComponent(this.getNodeId());
        let request = new qxapp.io.request.ApiRequest(url+query, "DELETE");
        request.send();
      }
    },

    setPosition: function(x, y) {
      this.__posX = x;
      this.__posY = y;
    },

    getPosition: function() {
      return {
        x: this.__posX,
        y: this.__posY
      };
    }
  }
});
