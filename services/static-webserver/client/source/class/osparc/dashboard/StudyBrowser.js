/* ************************************************************************

   osparc - the simcore frontend

   https://osparc.io

   Copyright:
     2018 IT'IS Foundation, https://itis.swiss

   License:
     MIT: https://opensource.org/licenses/MIT

   Authors:
     * Odei Maiz (odeimaiz)

************************************************************************ */

/**
 * Widget that shows lists user's studies.
 *
 * It is the entry point to start editing or creating a new study.
 *
 * Also takes care of retrieving the list of services and pushing the changes in the metadata.
 *
 * *Example*
 *
 * Here is a little example of how to use the widget.
 *
 * <pre class='javascript'>
 *   let studyBrowser = new osparc.dashboard.StudyBrowser();
 *   this.getRoot().add(studyBrowser);
 * </pre>
 */

qx.Class.define("osparc.dashboard.StudyBrowser", {
  extend: osparc.dashboard.ResourceBrowserBase,

  construct: function() {
    this._resourceType = "study";
    this.base(arguments);

    const store = osparc.store.Store.getInstance();
    this.bind("currentContext", store, "studyBrowserContext");
  },

  events: {
    "publishTemplate": "qx.event.type.Data",
  },

  properties: {
    currentContext: {
      check: ["studiesAndFolders", "workspaces", "search", "trash"],
      nullable: false,
      init: "studiesAndFolders",
      event: "changeCurrentContext"
    },

    currentWorkspaceId: {
      check: "Number",
      nullable: true,
      init: null,
      event: "changeCurrentWorkspaceId"
    },

    currentFolderId: {
      check: "Number",
      nullable: true,
      init: null,
      event: "changeCurrentFolderId"
    },

    // Ordering by Possibilities:
    // field: type | uuid | name | description | prj_owner | creation_date | last_change_date
    // direction: asc | desc
    orderBy: {
      check: "Object",
      init: {
        field: "last_change_date",
        direction: "desc"
      }
    }
  },

  members: {
    __dontShowTutorial: null,
    __header: null,
    __workspacesList: null,
    __foldersList: null,
    __loadingFolders: null,
    __loadingWorkspaces: null,
    __dragWidget: null,

    // overridden
    initResources: function() {
      this._resourcesList = [];
      this.__getActiveStudy()
        .then(() => {
          this.getChildControl("resources-layout");
          this.__attachEventHandlers();
          // set by the url or active study
          const loadStudyId = osparc.store.Store.getInstance().getCurrentStudyId();
          if (loadStudyId) {
            const cancelCB = () => this.reloadResources();
            const isStudyCreation = false;
            this._startStudyById(loadStudyId, null, cancelCB, isStudyCreation);
          } else {
            this.reloadResources();
          }
          // "Starting..." page
          this._hideLoadingPage();

          // since all the resources (templates, users, orgs...) were already loaded, notifications can be built
          osparc.data.Resources.get("notifications")
            .then(notifications => {
              osparc.notification.Notifications.getInstance().addNotifications(notifications);
            });
        })
        .catch(err => osparc.FlashMessenger.logError(err));
    },

    __getActiveStudy: function() {
      const params = {
        url: {
          tabId: osparc.utils.Utils.getClientSessionID()
        }
      };
      return osparc.data.Resources.fetch("studies", "getActive", params)
        .then(studyData => {
          if (studyData) {
            osparc.store.Store.getInstance().setCurrentStudyId(studyData["uuid"]);
          }
        })
        .catch(err => console.error(err));
    },

    reloadResources: function() {
      if (
        osparc.data.Permissions.getInstance().canDo("studies.user.read") &&
        osparc.auth.Manager.getInstance().isLoggedIn()
      ) {
        this.__reloadFolders();
        this.__reloadStudies();
      } else {
        this.__resetStudiesList();
      }
    },

    reloadMoreResources: function() {
      this.__reloadStudies();
    },

    __reloadWorkspaces: function() {
      if (
        !osparc.auth.Manager.getInstance().isLoggedIn() ||
        this.getCurrentContext() === "studiesAndFolders" ||
        this.__loadingWorkspaces
      ) {
        return;
      }

      let request = null;
      switch (this.getCurrentContext()) {
        case "search": {
          const filterData = this._searchBarFilter.getFilterData();
          const text = filterData.text ? encodeURIComponent(filterData.text) : "";
          request = osparc.store.Workspaces.getInstance().searchWorkspaces(text, this.getOrderBy());
          break;
        }
        case "workspaces": {
          request = osparc.store.Workspaces.getInstance().fetchWorkspaces();
          break;
        }
        case "trash":
          request = osparc.store.Workspaces.getInstance().fetchAllTrashedWorkspaces();
          break;
      }

      this.__loadingWorkspaces = true;
      this.__setWorkspacesToList([]);
      request
        .then(workspaces => {
          this.__setWorkspacesToList(workspaces);
          if (this.getCurrentContext() === "trash") {
            if (workspaces.length) {
              this.__header.getChildControl("empty-trash-button").show();
            }
          }
        })
        .catch(console.error)
        .finally(() => {
          this.__addNewWorkspaceButton();
          this.__loadingWorkspaces = null;
        });
    },

    __reloadFolders: function() {
      if (
        !osparc.auth.Manager.getInstance().isLoggedIn() ||
        this.getCurrentContext() === "workspaces" ||
        this.__loadingFolders
      ) {
        return;
      }

      let request = null;
      switch (this.getCurrentContext()) {
        case "search": {
          const filterData = this._searchBarFilter.getFilterData();
          const text = filterData.text ? encodeURIComponent(filterData.text) : ""; // name, description and uuid
          request = osparc.store.Folders.getInstance().searchFolders(text, this.getOrderBy());
          break;
        }
        case "studiesAndFolders": {
          const workspaceId = this.getCurrentWorkspaceId();
          const folderId = this.getCurrentFolderId();
          request = osparc.store.Folders.getInstance().fetchFolders(folderId, workspaceId, this.getOrderBy());
          break;
        }
        case "trash":
          request = osparc.store.Folders.getInstance().fetchAllTrashedFolders(this.getOrderBy());
          break;
      }

      this.__loadingFolders = true;
      this.__setFoldersToList([]);
      request
        .then(folders => {
          this.__setFoldersToList(folders);
          if (this.getCurrentContext() === "trash") {
            if (folders.length) {
              this.__header.getChildControl("empty-trash-button").show();
            }
          }
        })
        .catch(console.error)
        .finally(() => {
          // In favor of the NewPlusButton
          if (!osparc.product.Utils.hasNewPlusButton()) {
            this.__addNewFolderButton();
          }
          this.__loadingFolders = null;
        });
    },

    __reloadStudies: function() {
      if (
        !osparc.auth.Manager.getInstance().isLoggedIn() ||
        this.getCurrentContext() === "workspaces" ||
        this._loadingResourcesBtn.isFetching()
      ) {
        return;
      }

      osparc.data.Resources.get("tasks")
        .then(tasks => {
          if (tasks && tasks.length) {
            this.__tasksReceived(tasks);
          }
        });

      this._loadingResourcesBtn.setFetching(true);
      this._loadingResourcesBtn.setVisibility("visible");
      this.__getNextStudiesRequest()
        .then(resp => {
          // Context might have been changed while waiting for the response.
          // The new call is on the way, therefore this response can be ignored.
          const contextChanged = this.__didContextChange(resp["params"]["url"]);
          if (contextChanged) {
            return;
          }

          const studies = resp["data"];
          this.__addStudiesToList(studies);
          if (this._resourcesContainer.getFlatList()) {
            this._resourcesContainer.getFlatList().nextRequest = resp["_links"]["next"];
          }

          if (this.getCurrentContext() === "trash") {
            if (this._resourcesList.length) {
              this.__header.getChildControl("empty-trash-button").show();
            }
          }

          // Show Quick Start if there are no studies in the root folder of the personal workspace
          const quickStartInfo = osparc.product.quickStart.Utils.getQuickStart();
          if (quickStartInfo) {
            const dontShow = osparc.utils.Utils.localCache.getLocalStorageItem(quickStartInfo.localStorageStr);
            if (dontShow === "true" || this.__dontShowTutorial) {
              return;
            }
            const nStudies = "_meta" in resp ? resp["_meta"]["total"] : 0;
            if (
              nStudies === 0 &&
              this.getCurrentContext() === "studiesAndFolders" &&
              this.getCurrentWorkspaceId() === null &&
              this.getCurrentFolderId() === null
            ) {
              const quickStartWindow = quickStartInfo.tutorial();
              quickStartWindow.center();
              quickStartWindow.open();
              quickStartWindow.addListener("close", () => {
                this.__dontShowTutorial = true;
              }, this);
            }
          }
        })
        .catch(err => {
          osparc.FlashMessenger.logError(err);
          // stop fetching
          if (this._resourcesContainer.getFlatList()) {
            this._resourcesContainer.getFlatList().nextRequest = null;
          }
        })
        .finally(() => {
          this._loadingResourcesBtn.setFetching(false);
          if (this._resourcesContainer.getFlatList()) {
            this._loadingResourcesBtn.setVisibility(this._resourcesContainer.getFlatList().nextRequest === null ? "excluded" : "visible");
          }
          this._moreResourcesRequired();
        });
    },

    __resetStudiesList: function() {
      this._resourcesList = [];
      // It will remove the study cards
      this._reloadCards();
    },

    __addStudiesToList: function(studiesList) {
      studiesList.forEach(study => study["resourceType"] = "study");
      studiesList.forEach(study => {
        const idx = this._resourcesList.findIndex(std => std["uuid"] === study["uuid"]);
        if (idx === -1) {
          this._resourcesList.push(study);
        }
      });
      this.__reloadNewCards();

      studiesList.forEach(study => {
        const state = study["state"];
        if (state && "locked" in state && state["locked"]["value"] && state["locked"]["status"] === "CLOSING") {
          // websocket might have already notified that the state was closed.
          // But the /projects calls response got after the ws message. Ask again to make sure
          const delay = 2000;
          const studyId = study["uuid"];
          setTimeout(() => {
            const params = {
              url: {
                studyId
              }
            };
            osparc.data.Resources.fetch("studies", "getOne", params)
              .then(studyData => {
                this.__studyStateReceived(study["uuid"], studyData["state"]);
              });
          }, delay);
        }
      });
    },

    __setFoldersToList: function(folders) {
      this.__foldersList = folders;
      folders.forEach(folder => folder["resourceType"] = "folder");
      this.__reloadFolderCards();
    },

    __setWorkspacesToList: function(workspaces) {
      this.__workspacesList = workspaces;
      workspaces.forEach(workspace => workspace["resourceType"] = "workspace");
      this.__reloadWorkspaceCards();
    },

    _reloadCards: function() {
      const fetching = this._loadingResourcesBtn ? this._loadingResourcesBtn.getFetching() : false;
      const visibility = this._loadingResourcesBtn ? this._loadingResourcesBtn.getVisibility() : "excluded";

      this._resourcesContainer.setResourcesToList(this._resourcesList);
      const cards = this._resourcesContainer.reloadCards("studies");
      this.__configureStudyCards(cards);

      this.__addNewStudyButtons();

      const loadMoreBtn = this.__createLoadMoreButton();
      loadMoreBtn.set({
        fetching,
        visibility
      });
      loadMoreBtn.addListener("appear", () => this._moreResourcesRequired());
      this._resourcesContainer.addNonResourceCard(loadMoreBtn);

      osparc.filter.UIFilterController.dispatch("searchBarFilter");
    },

    __reloadNewCards: function() {
      this._resourcesContainer.setResourcesToList(this._resourcesList);
      const cards = this._resourcesContainer.reloadNewCards();
      this.__configureStudyCards(cards);

      osparc.filter.UIFilterController.dispatch("searchBarFilter");
    },

    // WORKSPACES
    __reloadWorkspaceCards: function() {
      this._resourcesContainer.setWorkspacesToList(this.__workspacesList);
      this._resourcesContainer.reloadWorkspaces();
    },

    __addNewWorkspaceButton: function() {
      if (this.getCurrentContext() !== "workspaces") {
        return;
      }

      const newWorkspaceCard = new osparc.dashboard.WorkspaceButtonNew();
      newWorkspaceCard.setCardKey("new-workspace");
      newWorkspaceCard.subscribeToFilterGroup("searchBarFilter");
      [
        "workspaceCreated",
        "workspaceDeleted",
        "workspaceUpdated",
      ].forEach(e => {
        newWorkspaceCard.addListener(e, () => this.__reloadWorkspaces());
      });
      this._resourcesContainer.addNewWorkspaceCard(newWorkspaceCard);
    },

    _workspaceSelected: function(workspaceId) {
      this._changeContext("studiesAndFolders", workspaceId, null);
    },

    _workspaceUpdated: function() {
      this.__reloadWorkspaces();
    },

    _trashWorkspaceRequested: function(workspaceId) {
      osparc.store.Workspaces.getInstance().trashWorkspace(workspaceId)
        .then(() => {
          this.__reloadWorkspaces();
          const msg = this.tr("Successfully deleted");
          osparc.FlashMessenger.logAs(msg, "INFO");
          this._resourceFilter.setTrashEmpty(false);
        })
        .catch(err => osparc.FlashMessenger.logError(err));
    },

    _untrashWorkspaceRequested: function(workspace) {
      osparc.store.Workspaces.getInstance().untrashWorkspace(workspace)
        .then(() => {
          this.__reloadWorkspaces();
          const msg = this.tr("Successfully restored");
          osparc.FlashMessenger.logAs(msg, "INFO");
          this._resourceFilter.evaluateTrashEmpty();
        })
        .catch(err => osparc.FlashMessenger.logError(err));
    },

    _deleteWorkspaceRequested: function(workspaceId) {
      osparc.store.Workspaces.getInstance().deleteWorkspace(workspaceId)
        .then(() => {
          this.__reloadWorkspaces();
          const msg = this.tr("Successfully deleted");
          osparc.FlashMessenger.logAs(msg, "INFO");
          this._resourceFilter.evaluateTrashEmpty();
        })
        .catch(err => osparc.FlashMessenger.logError(err))
    },
    // /WORKSPACES

    // FOLDERS
    __reloadFolderCards: function() {
      this._resourcesContainer.setFoldersToList(this.__foldersList);
      this._resourcesContainer.reloadFolders();
    },

    __addNewFolderButton: function() {
      if (this.getCurrentContext() !== "studiesAndFolders") {
        return;
      }
      const currentWorkspaceId = this.getCurrentWorkspaceId();
      if (currentWorkspaceId) {
        const currentWorkspace = osparc.store.Workspaces.getInstance().getWorkspace(this.getCurrentWorkspaceId());
        if (currentWorkspace && !currentWorkspace.getMyAccessRights()["write"]) {
          // If user can't write in workspace, do not show plus button
          return;
        }
      }

      const newFolderCard = new osparc.dashboard.FolderButtonNew();
      newFolderCard.setCardKey("new-folder");
      newFolderCard.subscribeToFilterGroup("searchBarFilter");
      newFolderCard.addListener("createFolder", e => {
        const data = e.getData();
        this.__createFolder(data);
      }, this);
      this._resourcesContainer.addNewFolderCard(newFolderCard);
    },

    __createFolder: function(data) {
      const currentFolder = osparc.store.Folders.getInstance().getFolder(this.getCurrentFolderId())
      const parentFolderId = currentFolder ? currentFolder.getFolderId() : null;
      const currentWorkspaceId = this.getCurrentWorkspaceId();
      osparc.store.Folders.getInstance().postFolder(data.name, parentFolderId, currentWorkspaceId)
        .then(() => this.__reloadFolders())
        .catch(err => console.error(err));
    },

    _folderSelected: function(folderId) {
      this._changeContext("studiesAndFolders", this.getCurrentWorkspaceId(), folderId);
    },

    _folderUpdated: function() {
      this.__reloadFolders();
    },

    __showMoveToDifferentWorkspaceWarningMessage: function() {
      const msg = this.tr("The permissions will be taken from the new workspace.");
      const win = new osparc.ui.window.Confirmation(msg).set({
        caption: this.tr("Move"),
        confirmText: this.tr("Move"),
      });
      win.open();
      return win;
    },

    _moveFolderToRequested: function(folderId) {
      const currentWorkspaceId = this.getCurrentWorkspaceId();
      const currentFolderId = this.getCurrentFolderId();
      const moveFolderTo = new osparc.dashboard.MoveResourceTo(currentWorkspaceId, currentFolderId);
      const title = this.tr("Move to...");
      const win = osparc.ui.window.Window.popUpInWindow(moveFolderTo, title, 400, 400);
      moveFolderTo.addListener("moveTo", e => {
        win.close();
        const data = e.getData();
        const destWorkspaceId = data["workspaceId"];
        const destFolderId = data["folderId"];
        this.__folderToFolderRequested(folderId, currentWorkspaceId, destWorkspaceId, destFolderId);
      });
      moveFolderTo.addListener("cancel", () => win.close());
    },

    __doMoveFolder: function(folderId, destWorkspaceId, destFolderId) {
      osparc.store.Folders.getInstance().moveFolderToWorkspace(folderId, destWorkspaceId) // first move to workspace
        .then(() => osparc.store.Folders.getInstance().moveFolderToFolder(folderId, destFolderId)) // then move to folder
        .then(() => this.__reloadFolders())
        .catch(err => osparc.FlashMessenger.logError(err));
    },

    __folderToFolderRequested: function(folderId, workspaceId, destWorkspaceId, destFolderId) {
      if (destWorkspaceId === workspaceId) {
        this.__doMoveFolder(folderId, destWorkspaceId, destFolderId);
      } else {
        const confirmationWin = this.__showMoveToDifferentWorkspaceWarningMessage();
        confirmationWin.addListener("close", () => {
          if (confirmationWin.getConfirmed()) {
            this.__doMoveFolder(folderId, destWorkspaceId, destFolderId);
          }
        }, this);
      }
    },

    __folderToTrash: function(folderId) {
      osparc.store.Folders.getInstance().trashFolder(folderId, this.getCurrentWorkspaceId())
        .then(() => {
          this.__reloadFolders();
          const msg = this.tr("Successfully deleted");
          osparc.FlashMessenger.logAs(msg, "INFO");
          this._resourceFilter.setTrashEmpty(false);
        })
        .catch(err => osparc.FlashMessenger.logError(err));
    },

    _trashFolderRequested: function(folderId) {
      const trashDays = osparc.store.StaticInfo.getInstance().getTrashRetentionDays();
      let msg = this.tr("Are you sure you want to delete the Folder and all its content?");
      msg += "<br><br>" + this.tr("It will be permanently deleted after ") + trashDays + " days.";
      const confirmationWin = new osparc.ui.window.Confirmation(msg).set({
        caption: this.tr("Delete"),
        confirmText: this.tr("Delete"),
        confirmAction: "warning",
      });
      confirmationWin.center();
      confirmationWin.open();
      confirmationWin.addListener("close", () => {
        if (confirmationWin.getConfirmed()) {
          this.__folderToTrash(folderId);
        }
      }, this);
    },

    _untrashFolderRequested: function(folder) {
      osparc.store.Folders.getInstance().untrashFolder(folder)
        .then(() => {
          this.__reloadFolders();
          const msg = this.tr("Successfully restored");
          osparc.FlashMessenger.logAs(msg, "INFO");
          this._resourceFilter.evaluateTrashEmpty();
        })
        .catch(err => osparc.FlashMessenger.logError(err))
    },

    _deleteFolderRequested: function(folderId) {
      osparc.store.Folders.getInstance().deleteFolder(folderId, this.getCurrentWorkspaceId())
        .then(() => {
          this.__reloadFolders();
          const msg = this.tr("Successfully deleted");
          osparc.FlashMessenger.logAs(msg, "INFO");
          this._resourceFilter.evaluateTrashEmpty();
        })
        .catch(err => console.error(err));
    },
    // /FOLDERS

    __configureStudyCards: function(cards) {
      cards.forEach(card => {
        card.setMultiSelectionMode(this.getMultiSelection());
        card.addListener("tap", e => this.__studyCardClicked(card, e.getNativeEvent().shiftKey), this);
        this._populateCardMenu(card);

        this.__attachDragHandlers(card);
      });
    },

    __attachDragHandlers: function(card) {
      card.setDraggable(true);

      card.addListener("dragstart", e => {
        const studyDataOrigin = card.getResourceData();
        osparc.dashboard.DragDropHelpers.moveStudy.dragStart(e, card, studyDataOrigin);
      });

      card.addListener("dragend", () => {
        osparc.dashboard.DragDropHelpers.dragEnd(card);
      });
    },

    __studyCardClicked: function(item, isShiftPressed) {
      if (item.isItemNotClickable()) {
        item.setSelected(false);
        return;
      }

      if (item.isMultiSelectionMode()) {
        item.setSelected(!item.getSelected());
        const studiesCont = this._resourcesContainer.getFlatList();
        if (isShiftPressed) {
          const lastIdx = studiesCont.getLastSelectedIndex();
          const currentIdx = studiesCont.getIndex(item);
          const minMax = [Math.min(lastIdx, currentIdx), Math.max(lastIdx, currentIdx)];
          for (let i=minMax[0]; i<=minMax[1]; i++) {
            const card = studiesCont.getChildren()[i];
            if (card.isVisible()) {
              card.setSelected(true);
            }
          }
        }
        studiesCont.setLastSelectedIndex(studiesCont.getIndex(item));
      } else {
        const studyData = this.__getStudyData(item.getUuid(), false);
        this._openResourceDetails(studyData);
        this.resetSelection();
      }
    },

    __attachEventHandlers: function() {
      const socket = osparc.wrapper.WebSocket.getInstance();
      socket.on("projectStateUpdated", data => {
        if (data) {
          const studyId = data["project_uuid"];
          const state = ("data" in data) ? data.data : {};
          const errors = ("errors" in data) ? data.errors : [];
          this.__studyStateReceived(studyId, state, errors);
        }
      }, this);

      const commandEsc = new qx.ui.command.Command("Esc");
      commandEsc.addListener("execute", e => {
        this.resetSelection();
        this.setMultiSelection(false);
      });

      const store = osparc.store.Store.getInstance();
      store.addListener("changeTags", () => {
        this.invalidateStudies();
        this.__reloadStudies();
      }, this);
      store.addListener("studyStateChanged", e => {
        const {
          studyId,
          state,
        } = e.getData();
        this.__studyStateChanged(studyId, state);
      });
      store.addListener("studyDebtChanged", e => {
        const {
          studyId,
          debt,
        } = e.getData();
        this.__studyDebtChanged(studyId, debt);
      });

      qx.event.message.Bus.subscribe("reloadStudies", () => {
        this.invalidateStudies();
        this.__reloadStudies();
      }, this);
    },

    __didContextChange: function(reqParams) {
      // not needed for the comparison
      delete reqParams["type"];
      delete reqParams["limit"];
      delete reqParams["offset"];
      delete reqParams["filters"];

      const cParams = this.__getRequestParams();
      const currentParams = {};
      Object.entries(cParams).forEach(([snakeKey, value]) => {
        const key = osparc.utils.Utils.snakeToCamel(snakeKey);
        currentParams[key] = value === "null" ? null : value;
      });

      // check the entries in currentParams are the same as the reqParams
      let sameContext = true;
      Object.entries(currentParams).forEach(([key, value]) => {
        // loose equality: will do a Number to String conversion if necessary
        sameContext &= key in reqParams && reqParams[key] == value;
      });
      // both ways
      Object.entries(reqParams).forEach(([key, value]) => {
        // loose equality: will do a Number to String conversion if necessary
        sameContext &= key in currentParams && currentParams[key] == value;
      });
      return !sameContext;
    },

    __getNextPageParams: function() {
      const studiesContainer = this._resourcesContainer.getFlatList();
      if (studiesContainer && studiesContainer.nextRequest) {
        // Context might have been changed while waiting for the response.
        // The new call is on the way, therefore this response can be ignored.
        const url = new URL(studiesContainer.nextRequest);
        const urlSearchParams = new URLSearchParams(url.search);
        const urlParams = {};
        for (const [snakeKey, value] of urlSearchParams.entries()) {
          const key = osparc.utils.Utils.snakeToCamel(snakeKey);
          urlParams[key] = value === "null" ? null : value;
        }
        const contextChanged = this.__didContextChange(urlParams);
        if (
          !contextChanged &&
          osparc.utils.Utils.hasParamFromURL(studiesContainer.nextRequest, "offset") &&
          osparc.utils.Utils.hasParamFromURL(studiesContainer.nextRequest, "limit")
        ) {
          return {
            offset: osparc.utils.Utils.getParamFromURL(studiesContainer.nextRequest, "offset"),
            limit: osparc.utils.Utils.getParamFromURL(studiesContainer.nextRequest, "limit")
          };
        }
      }
      return null;
    },

    __getRequestParams: function() {
      const requestParams = {};
      requestParams.orderBy = JSON.stringify(this.getOrderBy());

      switch (this.getCurrentContext()) {
        case "studiesAndFolders":
          requestParams.workspaceId = this.getCurrentWorkspaceId();
          requestParams.folderId = this.getCurrentFolderId();
          break;
        case "search": {
          // Use the ``search`` functionality only if the user types some text
          // tags should only be used to filter the current context (search context ot workspace/folder context)
          const filterData = this._searchBarFilter.getFilterData();
          if (filterData.text) {
            requestParams.text = filterData.text ? encodeURIComponent(filterData.text) : ""; // name, description and uuid
            requestParams["tagIds"] = filterData.tags.length ? filterData.tags.join(",") : "";
          }
          break;
        }
      }

      return requestParams;
    },

    __getNextStudiesRequest: function() {
      const params = {
        url: {
          offset: 0,
          limit: osparc.dashboard.ResourceBrowserBase.PAGINATED_STUDIES,
        }
      };
      const nextPageParams = this.__getNextPageParams();
      if (nextPageParams) {
        params.url.offset = nextPageParams.offset;
        params.url.limit = nextPageParams.limit;
      }
      const requestParams = this.__getRequestParams();
      Object.entries(requestParams).forEach(([key, value]) => {
        params.url[key] = value;
      });

      const options = {
        resolveWResponse: true
      };

      let request = null;
      switch (this.getCurrentContext()) {
        case "trash":
          request = osparc.data.Resources.fetch("studies", "getPageTrashed", params, options);
          break;
        case "search":
          request = osparc.data.Resources.fetch("studies", "getPageSearch", params, options);
          break;
        case "studiesAndFolders":
          request = osparc.data.Resources.fetch("studies", "getPage", params, options);
          break;
      }
      return request;
    },

    invalidateStudies: function() {
      osparc.store.Store.getInstance().invalidate("studies");
      this.__resetStudiesList();
      if (this._resourcesContainer.getFlatList()) {
        this._resourcesContainer.getFlatList().nextRequest = null;
      }
    },

    __addNewPlusButton: function() {
      const newPlusButton = new osparc.dashboard.NewPlusButton();
      this._leftFilters.add(newPlusButton);

      const newPlusButtonMenu = newPlusButton.getMenu();

      newPlusButtonMenu.addListener("createFolder", e => {
        const data = e.getData();
        this.__createFolder(data);
      }, this);

      newPlusButtonMenu.addListener("newEmptyStudyClicked", e => {
        const {
          newStudyLabel,
        } = e.getData();
        this.__newEmptyStudyBtnClicked(newStudyLabel);
      }, this);

      newPlusButtonMenu.addListener("newStudyFromTemplateClicked", e => {
        const {
          templateData,
          newStudyLabel,
        } = e.getData();
        if (templateData) {
          this.__newPlanBtnClicked(templateData, newStudyLabel);
        }
      }, this);

      newPlusButtonMenu.addListener("newStudyFromServiceClicked", e => {
        const {
          serviceMetadata,
          newStudyLabel,
        } = e.getData();
        if (serviceMetadata) {
          this.__newStudyFromServiceBtnClicked(serviceMetadata["key"], serviceMetadata["version"], newStudyLabel);
        }
      }, this);
    },

    __addNewStudyButtons: function() {
      if (this.getCurrentContext() !== "studiesAndFolders") {
        return;
      }
      const currentWorkspaceId = this.getCurrentWorkspaceId();
      if (currentWorkspaceId) {
        const currentWorkspace = osparc.store.Workspaces.getInstance().getWorkspace(currentWorkspaceId);
        if (currentWorkspace && !currentWorkspace.getMyAccessRights()["write"]) {
          // If user can't write in workspace, do not show plus buttons
          return;
        }
      }

      if (!osparc.product.Utils.hasNewPlusButton()) {
        switch (osparc.product.Utils.getProductName()) {
          case "tis":
          case "tiplite":
            // this one is different since it groups all new buttons in one new button
            this.__addTIPPlusButton();
            break;
          default:
            this.__addPlusButtons();
            break;
        }
      }
    },

    __addPlusButtons: function() {
      const plusButtonConfig = osparc.store.Products.getInstance().getNewStudiesUiConfig();
      if (plusButtonConfig) {
        plusButtonConfig["resources"].forEach(newStudyData => {
          if (newStudyData["resourceType"] === "study") {
            this.__addEmptyStudyPlusButton(newStudyData);
          } else if (newStudyData["resourceType"] === "service") {
            this.__addNewStudyFromServiceButton(newStudyData);
          }
        });
      }
    },

    __addEmptyStudyPlusButton: function(newStudyData) {
      const mode = this._resourcesContainer.getMode();
      const defTitle = this.tr("Empty") + " " + osparc.product.Utils.getStudyAlias({
        firstUpperCase: true
      });
      const title = newStudyData["title"] || defTitle;
      const desc = newStudyData["description"] || this.tr("Start with an empty study");
      const newEmptyStudyBtn = (mode === "grid") ? new osparc.dashboard.GridButtonNew(title, desc) : new osparc.dashboard.ListButtonNew(title, desc);
      newEmptyStudyBtn.setCardKey("new-study");
      newEmptyStudyBtn.subscribeToFilterGroup("searchBarFilter");
      osparc.utils.Utils.setIdToWidget(newEmptyStudyBtn, newStudyData["idToWidget"]);
      newEmptyStudyBtn.addListener("tap", () => this.__newEmptyStudyBtnClicked(newStudyData["newStudyLabel"]));
      this._resourcesContainer.addNonResourceCard(newEmptyStudyBtn);
    },

    __addNewStudyFromServiceButton: function(newStudyData) {
      if ("expectedKey" in newStudyData) {
        const key = newStudyData["expectedKey"];
        const latestMetadata = osparc.store.Services.getLatest(key);
        if (!latestMetadata) {
          return;
        }
        const title = newStudyData.title + " " + osparc.service.Utils.extractVersionDisplay(latestMetadata);
        const desc = newStudyData.description;
        const mode = this._resourcesContainer.getMode();
        const newStudyFromServiceButton = (mode === "grid") ? new osparc.dashboard.GridButtonNew(title, desc) : new osparc.dashboard.ListButtonNew(title, desc);
        newStudyFromServiceButton.setCardKey("new-"+key);
        if (newStudyData["idToWidget"]) {
          osparc.utils.Utils.setIdToWidget(newStudyFromServiceButton, newStudyData["idToWidget"]);
        }
        newStudyFromServiceButton.addListener("tap", () => this.__newStudyFromServiceBtnClicked(latestMetadata["key"], latestMetadata["version"], newStudyData.newStudyLabel));
        this._resourcesContainer.addNonResourceCard(newStudyFromServiceButton);
      } else if ("myMostUsed" in newStudyData) {
        const excludeFrontend = true;
        const excludeDeprecated = true
        osparc.store.Services.getServicesLatestList(excludeFrontend, excludeDeprecated)
          .then(servicesList => {
            osparc.service.Utils.sortObjectsBasedOn(servicesList, {
              "sort": "hits",
              "order": "down"
            });
            for (let i=0; i<newStudyData["myMostUsed"]; i++) {
              const latestMetadata = servicesList[i];
              const mode = this._resourcesContainer.getMode();
              const newStudyFromServiceButton = (mode === "grid") ? new osparc.dashboard.GridButtonNew(latestMetadata["name"]) : new osparc.dashboard.ListButtonNew(latestMetadata["name"]);
              newStudyFromServiceButton.addListener("tap", () => this.__newStudyFromServiceBtnClicked(latestMetadata["key"], latestMetadata["version"], latestMetadata["name"]));
              this._resourcesContainer.addNonResourceCard(newStudyFromServiceButton);
            }
          });
      }
    },

    __addTIPPlusButton: function() {
      const mode = this._resourcesContainer.getMode();
      const title = this.tr("New Plan");
      const newPlansBtn = (mode === "grid") ? new osparc.dashboard.GridButtonNew(title) : new osparc.dashboard.ListButtonNew(title);
      newPlansBtn.setCardKey("new-study");
      newPlansBtn.subscribeToFilterGroup("searchBarFilter");
      osparc.utils.Utils.setIdToWidget(newPlansBtn, "newPlansBtn");
      this._resourcesContainer.addNonResourceCard(newPlansBtn);
      newPlansBtn.setEnabled(false);

      const newStudiesConfig = osparc.store.Products.getInstance().getNewStudiesUiConfig();
      if (newStudiesConfig) {
        newPlansBtn.setEnabled(true);

        newPlansBtn.addListener("tap", () => {
          osparc.data.Resources.get("templates")
            .then(templates => {
              if (templates) {
                const newStudies = new osparc.dashboard.NewStudies(newStudiesConfig);
                newStudies.addListener("templatesLoaded", () => {
                  newStudies.setGroupBy("category");
                  const winTitle = this.tr("New Plan");
                  const win = osparc.ui.window.Window.popUpInWindow(newStudies, winTitle, osparc.dashboard.NewStudies.WIDTH+40, 300).set({
                    clickAwayClose: false,
                    resizable: true
                  });
                  newStudies.addListener("newStudyClicked", e => {
                    win.close();
                    const templateInfo = e.getData();
                    const templateData = templates.find(t => t.name === templateInfo.expectedTemplateLabel);
                    if (templateData) {
                      this.__newPlanBtnClicked(templateData, templateInfo.newStudyLabel);
                    }
                  });
                  osparc.utils.Utils.setIdToWidget(win, "newStudiesWindow");
                });
              }
            });
        });
      }
    },

    // LAYOUT //
    _createLayout: function() {
      this._createSearchBar();

      const header = this.__header = new osparc.dashboard.StudyBrowserHeader();
      this.__header.addListener("trashEmptied", () => this.reloadResources(), this);
      this._addToLayout(header);

      this._createResourcesLayout("studiesList");

      const importStudyButton = this.__createImportButton();
      const isDisabled = osparc.utils.DisabledPlugins.isImportDisabled();
      importStudyButton.setVisibility(isDisabled ? "excluded" : "visible");
      this._toolbar.add(importStudyButton);

      const selectStudiesButton = this.__createSelectButton();
      this._toolbar.add(selectStudiesButton);

      const studiesMoveButton = this.__createMoveStudiesButton();
      this._toolbar.add(studiesMoveButton);

      const studiesTrashButton = this.__createTrashStudiesButton();
      this._toolbar.add(studiesTrashButton);

      const studiesDeleteButton = this.__createDeleteStudiesButton();
      this._toolbar.add(studiesDeleteButton);

      this._toolbar.add(new qx.ui.core.Spacer(), {
        flex: 1
      });

      this.__addSortByButton();
      this._addViewModeButton();

      if (osparc.product.Utils.hasNewPlusButton()) {
        this.__addNewPlusButton();
      }

      this._addResourceFilter();

      this.__connectContexts();
      this.__connectDropHandlers();

      this.__addNewStudyButtons();

      const loadMoreBtn = this.__createLoadMoreButton();
      this._resourcesContainer.addNonResourceCard(loadMoreBtn);

      this.addListener("changeMultiSelection", e => {
        const multiEnabled = e.getData();
        const cards = this._resourcesContainer.getCards();
        cards.forEach(card => {
          if (!osparc.dashboard.ResourceBrowserBase.isCardButtonItem(card)) {
            card.setEnabled(!multiEnabled);
          }
        });
        importStudyButton.setEnabled(!multiEnabled);
      });

      this._resourcesContainer.addListener("changeSelection", e => {
        const currentContext = this.getCurrentContext();
        const selection = e.getData();

        studiesMoveButton.set({
          visibility: selection.length && currentContext === "studiesAndFolders" ? "visible" : "excluded",
          label: this.tr("Move") + (selection.length > 1 ? ` (${selection.length})` : ""),
        });

        studiesTrashButton.set({
          visibility: selection.length && currentContext === "studiesAndFolders" ? "visible" : "excluded",
          label: this.tr("Delete") + (selection.length > 1 ? ` (${selection.length})` : ""),
        });

        studiesDeleteButton.set({
          visibility: selection.length && currentContext === "trash" ? "visible" : "excluded",
          label: this.tr("Delete permanently") + (selection.length > 1 ? ` (${selection.length})` : ""),
        });
      });

      this._resourcesContainer.addListener("changeVisibility", () => this._moreResourcesRequired());

      return this._resourcesContainer;
    },

    __connectContexts: function() {
      const header = this.__header;
      header.addListener("locationChanged", () => {
        const workspaceId = header.getCurrentWorkspaceId();
        const folderId = header.getCurrentFolderId();
        this._changeContext("studiesAndFolders", workspaceId, folderId);
      }, this);

      const workspacesAndFoldersTree = this._resourceFilter.getWorkspacesAndFoldersTree();
      workspacesAndFoldersTree.addListener("locationChanged", e => {
        const context = e.getData();
        const workspaceId = context["workspaceId"];
        if (workspaceId === -1) {
          this._changeContext("workspaces");
        } else {
          const folderId = context["folderId"];
          this._changeContext("studiesAndFolders", workspaceId, folderId);
        }
      }, this);

      this._resourceFilter.addListener("trashContext", () => {
        this._changeContext("trash");
      });

      this._searchBarFilter.addListener("filterChanged", e => {
        const filterData = e.getData();
        if (filterData.text) {
          this._changeContext("search");
        } else {
          const workspaceId = this.getCurrentWorkspaceId();
          const folderId = this.getCurrentFolderId();
          this._changeContext("studiesAndFolders", workspaceId, folderId);
        }
      });
    },

    _changeContext: function(context, workspaceId = null, folderId = null) {
      if (
        context !== "search" && // reload studies for a new search
        context === this.getCurrentContext() &&
        workspaceId === this.getCurrentWorkspaceId() &&
        folderId === this.getCurrentFolderId()
      ) {
        // didn't really change
        return;
      }

      osparc.store.Store.getInstance().setStudyBrowserContext(context);
      this.set({
        currentContext: context,
        currentWorkspaceId: workspaceId,
        currentFolderId: folderId,
      });
      this.resetSelection();
      this.setMultiSelection(false);

      // reset lists
      this.__setWorkspacesToList([]);
      this.__setFoldersToList([]);
      this._resourcesList = [];
      this._resourcesContainer.setResourcesToList(this._resourcesList);
      this._resourcesContainer.reloadCards("studies");

      this._toolbar.show();
      switch (this.getCurrentContext()) {
        case "studiesAndFolders":
          this._searchBarFilter.resetFilters();
          this.__reloadFolders();
          this._loadingResourcesBtn.setFetching(false);
          this.invalidateStudies();
          this.__reloadStudies();
          break;
        case "workspaces":
          this._toolbar.exclude();
          this._searchBarFilter.resetFilters();
          this.__reloadWorkspaces();
          break;
        case "search":
          this.__reloadWorkspaces();
          this.__reloadFolders();
          this._loadingResourcesBtn.setFetching(false);
          this.invalidateStudies();
          this.__reloadStudies();
          break;
        case "trash":
          this._searchBarFilter.resetFilters();
          this.__reloadWorkspaces();
          this.__reloadFolders();
          this._loadingResourcesBtn.setFetching(false);
          this.invalidateStudies();
          this.__reloadStudies();
          break;
      }

      // notify header
      const header = this.__header;
      header.set({
        currentWorkspaceId: workspaceId,
        currentFolderId: folderId,
      });

      // notify Filters on the left
      this._resourceFilter.contextChanged(context, workspaceId, folderId);
    },

    __connectDropHandlers: function() {
      const workspacesAndFoldersTree = this._resourceFilter.getWorkspacesAndFoldersTree();
      workspacesAndFoldersTree.addListener("studyToFolderRequested", e => {
        const {
          studyData,
          destWorkspaceId,
          destFolderId,
        } = e.getData();
        this.__studyToFolderRequested(studyData, destWorkspaceId, destFolderId);
      });
      workspacesAndFoldersTree.addListener("folderToFolderRequested", e => {
        const {
          folderId,
          workspaceId,
          destWorkspaceId,
          destFolderId,
        } = e.getData();
        this.__folderToFolderRequested(folderId, workspaceId, destWorkspaceId, destFolderId);
      });

      this._resourceFilter.addListener("trashStudyRequested", e => {
        const studyData = e.getData();
        this.__trashStudyRequested(studyData);
      });
      this._resourceFilter.addListener("trashFolderRequested", e => {
        const folderId = e.getData();
        this._trashFolderRequested(folderId);
      });
    },

    _studyToFolderRequested: function(data) {
      const {
        studyData,
        destWorkspaceId,
        destFolderId,
      } = data;
      this.__studyToFolderRequested(studyData, destWorkspaceId, destFolderId);
    },

    _folderToFolderRequested: function(data) {
      const {
        folderId,
        workspaceId,
        destWorkspaceId,
        destFolderId,
      } = data;
      this.__folderToFolderRequested(folderId, workspaceId, destWorkspaceId, destFolderId);
    },

    __addSortByButton: function() {
      const sortByButton = new osparc.dashboard.SortedByMenuButton();
      sortByButton.set({
        appearance: "form-button-outlined"
      });
      osparc.utils.Utils.setIdToWidget(sortByButton, "sortByButton");
      sortByButton.addListener("sortByChanged", e => {
        this.setOrderBy(e.getData());
        this.invalidateStudies();
        this.reloadResources();
      }, this);
      this._toolbar.add(sortByButton);
    },

    __createLoadMoreButton: function() {
      const mode = this._resourcesContainer.getMode();
      const loadMoreBtn = this._loadingResourcesBtn = (mode === "grid") ? new osparc.dashboard.GridButtonLoadMore() : new osparc.dashboard.ListButtonLoadMore();
      loadMoreBtn.setCardKey("load-more");
      osparc.utils.Utils.setIdToWidget(loadMoreBtn, "studiesLoading");
      loadMoreBtn.addListener("tap", () => {
        this._moreResourcesRequired();
      });
      return loadMoreBtn;
    },

    __createImportButton: function() {
      const importButton = new qx.ui.form.Button(this.tr("Import"));
      importButton.set({
        appearance: "form-button-outlined"
      });
      importButton.addListener("execute", () => {
        const importStudy = new osparc.study.Import();
        const win = osparc.ui.window.Window.popUpInWindow(importStudy, this.tr("Import Study"), 400, 125);
        win.set({
          clickAwayClose: false
        });
        importStudy.addListener("fileReady", e => {
          win.close();
          const file = e.getData();
          if (file === null || file === undefined) {
            return;
          }
          const size = file.size;
          const maxSize = 10 * 1000 * 1000 * 1000; // 10 GB
          if (size > maxSize) {
            osparc.FlashMessenger.logAs(`The file is too big. Maximum size is ${maxSize}MB. Please provide with a smaller file or a repository URL.`, "ERROR");
            return;
          }
          this.__importStudy(file);
        }, this);
      }, this);
      return importButton;
    },

    __createMoveStudiesButton: function() {
      const moveStudiesButton = new qx.ui.form.Button(this.tr("Move to")).set({
        appearance: "form-button-outlined",
        visibility: "excluded",
      });
      moveStudiesButton.addListener("execute", () => {
        const currentWorkspaceId = this.getCurrentWorkspaceId();
        const currentFolderId = this.getCurrentFolderId();
        const moveStudyTo = new osparc.dashboard.MoveResourceTo(currentWorkspaceId, currentFolderId);
        const title = this.tr("Move to...");
        const win = osparc.ui.window.Window.popUpInWindow(moveStudyTo, title, 400, 400);
        moveStudyTo.addListener("moveTo", e => {
          win.close();
          const data = e.getData();
          const destWorkspaceId = data["workspaceId"];
          const destFolderId = data["folderId"];
          const moveStudies = () => {
            const selection = this._resourcesContainer.getSelection();
            selection.forEach(button => {
              const studyData = button.getResourceData();
              this.__doMoveStudy(studyData, destWorkspaceId, destFolderId);
            });
            this.resetSelection();
            this.setMultiSelection(false);
          }
          if (destWorkspaceId === currentWorkspaceId) {
            moveStudies();
          } else {
            const confirmationWin = this.__showMoveToDifferentWorkspaceWarningMessage();
            confirmationWin.addListener("close", () => {
              if (confirmationWin.getConfirmed()) {
                moveStudies();
              }
            }, this);
          }
        }, this);
        moveStudyTo.addListener("cancel", () => win.close());
      }, this);
      return moveStudiesButton;
    },

    __createTrashStudiesButton: function() {
      const trashButton = new qx.ui.form.Button(this.tr("Delete"), "@FontAwesome5Solid/trash/14").set({
        appearance: "warning-button",
        visibility: "excluded"
      });
      osparc.utils.Utils.setIdToWidget(trashButton, "deleteStudiesBtn");
      trashButton.addListener("execute", () => {
        const selection = this._resourcesContainer.getSelection();
        const preferencesSettings = osparc.Preferences.getInstance();
        if (preferencesSettings.getConfirmDeleteStudy()) {
          const win = this.__createConfirmTrashWindow(selection.map(button => button.getTitle()));
          win.center();
          win.open();
          win.addListener("close", () => {
            if (win.getConfirmed()) {
              this.__trashStudies(selection.map(button => this.__getStudyData(button.getUuid(), false)), false);
            }
          }, this);
        } else {
          this.__trashStudies(selection.map(button => this.__getStudyData(button.getUuid(), false)), false);
        }
      }, this);
      return trashButton;
    },

    __createDeleteStudiesButton: function() {
      const deleteButton = new qx.ui.form.Button(this.tr("Delete permanently"), "@FontAwesome5Solid/trash/14").set({
        appearance: "danger-button",
        visibility: "excluded"
      });
      osparc.utils.Utils.setIdToWidget(deleteButton, "deleteStudiesBtn");
      deleteButton.addListener("execute", () => {
        const selection = this._resourcesContainer.getSelection();
        const preferencesSettings = osparc.Preferences.getInstance();
        if (preferencesSettings.getConfirmDeleteStudy()) {
          const win = this.__createConfirmDeleteWindow(selection.map(button => button.getTitle()));
          win.center();
          win.open();
          win.addListener("close", () => {
            if (win.getConfirmed()) {
              this.__doDeleteStudies(selection.map(button => this.__getStudyData(button.getUuid(), false)), false);
            }
          }, this);
        } else {
          this.__doDeleteStudies(selection.map(button => this.__getStudyData(button.getUuid(), false)), false);
        }
      }, this);
      return deleteButton;
    },



    __createSelectButton: function() {
      const selectButton = new qx.ui.form.ToggleButton().set({
        appearance: "form-button-outlined",
        marginRight: 8
      });
      selectButton.bind("value", this, "multiSelection");
      selectButton.bind("value", selectButton, "label", {
        converter: val => val ? this.tr("Cancel Selection") : (this.tr("Select ") + osparc.product.Utils.getStudyAlias({
          plural: true,
          firstUpperCase: true
        }))
      });
      this.bind("multiSelection", selectButton, "value");
      this.bind("currentContext", selectButton, "visibility", {
        converter: currentContext => currentContext === "studiesAndFolders" ? "visible" : "excluded"
      });
      return selectButton;
    },

    // override
    _applyMultiSelection: function(value) {
      this._resourcesContainer.getCards().forEach(studyItem => {
        if (osparc.dashboard.ResourceBrowserBase.isCardButtonItem(studyItem)) {
          studyItem.setMultiSelectionMode(value);
          if (value === false) {
            studyItem.setSelected(false);
          }
        }
      });
    },
    // LAYOUT //

    __studyStateReceived: function(studyId, state, errors) {
      osparc.store.Store.getInstance().setStudyState(studyId, state);
      if (errors && errors.length) {
        console.error(errors);
      }
    },

    __studyStateChanged: function(studyId, state) {
      const idx = this._resourcesList.findIndex(study => study["uuid"] === studyId);
      if (idx > -1) {
        this._resourcesList[idx]["state"] = state;
      }
      const studyItem = this._resourcesContainer.getCards().find(card => osparc.dashboard.ResourceBrowserBase.isCardButtonItem(card) && card.getUuid() === studyId);
      if (studyItem) {
        studyItem.setState(state);
      }
    },

    __studyDebtChanged: function(studyId, debt) {
      const idx = this._resourcesList.findIndex(study => study["uuid"] === studyId);
      if (idx > -1) {
        this._resourcesList[idx]["debt"] = debt;
      }
      const studyItem = this._resourcesContainer.getCards().find(card => osparc.dashboard.ResourceBrowserBase.isCardButtonItem(card) && card.getUuid() === studyId);
      if (studyItem) {
        studyItem.setDebt(debt);
      }
    },

    __newEmptyStudyBtnClicked: function(newStudyLabel) {
      const existingNames = this._resourcesList.map(study => study["name"]);
      const title = osparc.utils.Utils.getUniqueName(newStudyLabel, existingNames);
      const minStudyData = osparc.data.model.Study.createMinStudyObject();
      minStudyData["name"] = title;
      minStudyData["workspaceId"] = this.getCurrentWorkspaceId();
      minStudyData["folderId"] = this.getCurrentFolderId();
      this._showLoadingPage(this.tr("Creating ") + (minStudyData.name || osparc.product.Utils.getStudyAlias()));
      const params = {
        data: minStudyData
      };
      osparc.study.Utils.createStudyAndPoll(params)
        .then(studyData => this.__startStudyAfterCreating(studyData["uuid"]))
        .catch(err => {
          this._hideLoadingPage();
          osparc.FlashMessenger.logError(err);
        });
    },

    __newPlanBtnClicked: function(templateData, newStudyName) {
      // do not override cached template data
      const templateCopyData = osparc.utils.Utils.deepCloneObject(templateData);
      const existingNames = this._resourcesList.map(study => study["name"]);
      const title = osparc.utils.Utils.getUniqueName(newStudyName, existingNames);
      templateCopyData.name = title;
      this._showLoadingPage(this.tr("Creating ") + (newStudyName || osparc.product.Utils.getStudyAlias()));
      const contextProps = {
        workspaceId: this.getCurrentWorkspaceId(),
        folderId: this.getCurrentFolderId(),
      };
      osparc.study.Utils.createStudyFromTemplate(templateCopyData, this._loadingPage, contextProps)
        .then(studyData => this.__startStudyAfterCreating(studyData["uuid"]))
        .catch(err => {
          this._hideLoadingPage();
          osparc.FlashMessenger.logError(err);
        });
    },

    __newStudyFromServiceBtnClicked: function(key, version, newStudyLabel) {
      this._showLoadingPage(this.tr("Creating ") + osparc.product.Utils.getStudyAlias());
      const contextProps = {
        workspaceId: this.getCurrentWorkspaceId(),
        folderId: this.getCurrentFolderId(),
      };
      osparc.study.Utils.createStudyFromService(key, version, this._resourcesList, newStudyLabel, contextProps)
        .then(studyId => this.__startStudyAfterCreating(studyId))
        .catch(err => {
          this._hideLoadingPage();
          osparc.FlashMessenger.logError(err);
        });
    },

    __startStudyAfterCreating: function(studyId) {
      const openCB = () => this._hideLoadingPage();
      const cancelCB = () => {
        this._hideLoadingPage();
        const params = {
          url: {
            studyId
          }
        };
        osparc.data.Resources.fetch("studies", "delete", params);
      };
      const isStudyCreation = true;
      this._startStudyById(studyId, openCB, cancelCB, isStudyCreation);
    },

    _updateStudyData: function(studyData) {
      studyData["resourceType"] = "study";
      const index = this._resourcesList.findIndex(study => study["uuid"] === studyData["uuid"]);
      if (index === -1) {
        // add it in first position, most likely it's a new study
        this._resourcesList.unshift(studyData);
      } else {
        this._resourcesList[index] = studyData;
      }
      // it will render the studies in the right order
      this._reloadCards();
    },

    __removeFromStudyList: function(studyId) {
      const idx = this._resourcesList.findIndex(study => study["uuid"] === studyId);
      if (idx > -1) {
        this._resourcesList.splice(idx, 1);
      }
      this._resourcesContainer.removeCard(studyId);
    },

    _populateCardMenu: function(card) {
      const menu = card.getMenu();
      const studyData = card.getResourceData();

      const trashed = Boolean(studyData["trashedAt"]);
      const writeAccess = osparc.data.model.Study.canIWrite(studyData["accessRights"]);
      const deleteAccess = osparc.data.model.Study.canIDelete(studyData["accessRights"]);

      if (this.getCurrentContext() === "trash") {
        if (trashed) {
          if (writeAccess) {
            const untrashButton = this.__getUntrashStudyMenuButton(studyData);
            menu.add(untrashButton);
          }
          if (deleteAccess) {
            const deleteButton = this.__getDeleteStudyMenuButton(studyData, false);
            menu.addSeparator();
            menu.add(deleteButton);
          }
        }
        return;
      }

      const openButton = this._getOpenMenuButton(studyData);
      if (openButton) {
        menu.add(openButton);
      }

      if (this.getCurrentContext() === "search") {
        const renameStudyButton = this.__getOpenLocationMenuButton(studyData);
        menu.add(renameStudyButton);
      }

      if (writeAccess) {
        const renameStudyButton = this.__getRenameStudyMenuButton(studyData);
        menu.add(renameStudyButton);
      }

      if (writeAccess) {
        const editThumbnailButton = this.__getThumbnailStudyMenuButton(studyData);
        menu.add(editThumbnailButton);
      }

      const duplicateStudyButton = this.__getDuplicateMenuButton(studyData);
      menu.add(duplicateStudyButton);

      if (osparc.product.Utils.hasConvertToPipelineEnabled()) {
        const convertToPipelineButton = this.__getConvertToPipelineMenuButton(studyData);
        menu.add(convertToPipelineButton);
      }

      if (osparc.product.Utils.hasExportCMisEnabled()) {
        const exportStudyButton = this.__getExportCMisMenuButton(studyData);
        menu.add(exportStudyButton);
      }

      menu.addSeparator();

      // Access Rights are set at workspace level)
      if (writeAccess && this.getCurrentWorkspaceId() === null) {
        const shareButton = this._getShareMenuButton(card);
        if (shareButton) {
          menu.add(shareButton);
        }
      }

      if (writeAccess) {
        const tagsButton = this._getTagsMenuButton(card);
        if (tagsButton) {
          menu.add(tagsButton);
        }
      }

      const studyDataButton = this.__getStudyDataMenuButton(card);
      menu.add(studyDataButton);

      if (osparc.desktop.credits.Utils.areWalletsEnabled()) {
        const billingsSettingsButton = this.__getBillingMenuButton(card);
        menu.add(billingsSettingsButton);
      }

      menu.addSeparator();

      const moveToButton = this.__getMoveStudyToMenuButton(studyData);
      if (moveToButton) {
        menu.add(moveToButton);
      }

      if (deleteAccess) {
        menu.addSeparator();
        const trashButton = this.__getTrashStudyMenuButton(studyData, false);
        menu.add(trashButton);
      } else if (this.__deleteOrRemoveMe(studyData) === "remove") {
        // if I'm a collaborator, let me remove myself from the study. In that case it would be a Delete for me
        menu.addSeparator();
        const deleteButton = this.__getDeleteStudyMenuButton(studyData, false);
        menu.add(deleteButton);
      }

      card.evaluateMenuButtons();
    },

    __getOpenLocationMenuButton: function(studyData) {
      const openLocationButton = new qx.ui.menu.Button(this.tr("Open location"), "@FontAwesome5Solid/external-link-alt/12");
      openLocationButton.addListener("execute", () => {
        this._changeContext("studiesAndFolders", studyData["workspaceId"], studyData["folderId"]);
      }, this);
      return openLocationButton;
    },

    __getRenameStudyMenuButton: function(studyData) {
      const renameButton = new qx.ui.menu.Button(this.tr("Rename..."), "@FontAwesome5Solid/pencil-alt/12");
      renameButton.addListener("execute", () => {
        const renamer = new osparc.widget.Renamer(studyData["name"]);
        renamer.addListener("labelChanged", e => {
          renamer.close();
          const newLabel = e.getData()["newLabel"];
          this.__updateName(studyData, newLabel);
        }, this);
        renamer.center();
        renamer.open();
      }, this);
      return renameButton;
    },

    __getThumbnailStudyMenuButton: function(studyData) {
      const thumbButton = new qx.ui.menu.Button(this.tr("Thumbnail..."), "@FontAwesome5Solid/image/12");
      thumbButton.addListener("execute", () => {
        osparc.editor.ThumbnailSuggestions.extractThumbnailSuggestions(studyData)
          .then(suggestions => {
            const title = this.tr("Edit Thumbnail");
            const oldThumbnail = studyData.thumbnail;
            const thumbnailEditor = new osparc.editor.ThumbnailEditor(oldThumbnail, suggestions);
            const win = osparc.ui.window.Window.popUpInWindow(thumbnailEditor, title, suggestions.length > 2 ? 500 : 350, 280);
            thumbnailEditor.addListener("updateThumbnail", e => {
              win.close();
              const newUrl = e.getData();
              this.__updateThumbnail(studyData, newUrl);
            }, this);
            thumbnailEditor.addListener("cancel", () => win.close());
          })
          .catch(err => console.error(err));
      }, this);
      return thumbButton;
    },

    __updateName: function(studyData, name) {
      osparc.store.Study.patchStudyData(studyData, "name", name)
        .then(() => this._updateStudyData(studyData))
        .catch(err => osparc.FlashMessenger.logError(err, this.tr("Something went wrong while renaming")));
    },

    __updateThumbnail: function(studyData, url) {
      osparc.store.Study.patchStudyData(studyData, "thumbnail", url)
        .then(() => this._updateStudyData(studyData))
        .catch(err => osparc.FlashMessenger.logError(err, this.tr("Something went wrong while updating the thumbnail")));
    },

    __getStudyDataMenuButton: function(card) {
      const text = osparc.utils.Utils.capitalize(osparc.product.Utils.getStudyAlias()) + this.tr(" files...");
      const studyDataButton = new qx.ui.menu.Button(text, "@FontAwesome5Solid/file/12");
      studyDataButton["studyDataButton"] = true;
      studyDataButton.addListener("tap", () => card.openData(), this);
      return studyDataButton;
    },

    __getBillingMenuButton: function(card) {
      const text = osparc.utils.Utils.capitalize(this.tr("Billing Settings..."));
      const studyBillingSettingsButton = new qx.ui.menu.Button(text);
      studyBillingSettingsButton["billingSettingsButton"] = true;
      studyBillingSettingsButton.addListener("tap", () => card.openBilling(), this);
      return studyBillingSettingsButton;
    },

    __doMoveStudy: function(studyData, destWorkspaceId, destFolderId) {
      this.__moveStudyToWorkspace(studyData, destWorkspaceId) // first move to workspace
        .then(() => this.__moveStudyToFolder(studyData, destFolderId)) // then move to folder
        .then(() => this.__removeFromStudyList(studyData["uuid"]))
        .catch(err => osparc.FlashMessenger.logError(err));
    },

    __studyToFolderRequested: function(studyData, destWorkspaceId, destFolderId) {
      if (studyData["workspaceId"] === destWorkspaceId) {
        this.__doMoveStudy(studyData, destWorkspaceId, destFolderId);
      } else {
        const confirmationWin = this.__showMoveToDifferentWorkspaceWarningMessage();
        confirmationWin.addListener("close", () => {
          if (confirmationWin.getConfirmed()) {
            this.__doMoveStudy(studyData, destWorkspaceId, destFolderId);
          }
        }, this);
      }
    },

    __getMoveStudyToMenuButton: function(studyData) {
      const moveToButton = new qx.ui.menu.Button(this.tr("Move to..."), "@FontAwesome5Solid/folder/12");
      moveToButton["moveToButton"] = true;
      moveToButton.addListener("tap", () => {
        const currentWorkspaceId = this.getCurrentWorkspaceId();
        const currentFolderId = this.getCurrentFolderId();
        const moveStudyTo = new osparc.dashboard.MoveResourceTo(currentWorkspaceId, currentFolderId);
        const title = this.tr("Move to...");
        const win = osparc.ui.window.Window.popUpInWindow(moveStudyTo, title, 400, 400);
        moveStudyTo.addListener("moveTo", e => {
          win.close();
          const data = e.getData();
          const destWorkspaceId = data["workspaceId"];
          const destFolderId = data["folderId"];
          this.__studyToFolderRequested(studyData, destWorkspaceId, destFolderId);
        }, this);
        moveStudyTo.addListener("cancel", () => win.close());
      }, this);
      return moveToButton;
    },

    __moveStudyToWorkspace: function(studyData, destWorkspaceId) {
      if (studyData["workspaceId"] === destWorkspaceId) {
        // resolve right away
        return new Promise(resolve => resolve());
      }
      const params = {
        url: {
          studyId: studyData["uuid"],
          workspaceId: destWorkspaceId,
        }
      };
      return osparc.data.Resources.fetch("studies", "moveToWorkspace", params)
        .then(() => studyData["workspaceId"] = destWorkspaceId);
    },

    __moveStudyToFolder: function(studyData, destFolderId) {
      if (studyData["folderId"] === destFolderId) {
        // resolve right away
        return new Promise(resolve => resolve());
      }
      const params = {
        url: {
          studyId: studyData["uuid"],
          folderId: destFolderId,
        }
      };
      return osparc.data.Resources.fetch("studies", "moveToFolder", params)
        .then(() => studyData["folderId"] = destFolderId);
    },

    __getDuplicateMenuButton: function(studyData) {
      const duplicateButton = new qx.ui.menu.Button(this.tr("Duplicate"), "@FontAwesome5Solid/copy/12");
      duplicateButton["duplicateButton"] = true;
      duplicateButton.addListener("execute", () => this.__duplicateStudy(studyData), this);
      return duplicateButton;
    },

    __getConvertToPipelineMenuButton: function(studyData) {
      const convertToPipelineButton = new qx.ui.menu.Button(this.tr("Convert to Pipeline"), null);
      convertToPipelineButton["convertToPipelineButton"] = true;
      const uiMode = osparc.study.Utils.getUiMode(studyData);
      convertToPipelineButton.setVisibility(uiMode === "standalone" ? "visible" : "excluded");
      convertToPipelineButton.addListener("execute", () => {
        this.__updateUIMode(studyData, "workbench")
          .catch(err => osparc.FlashMessenger.logError(err, this.tr("Something went wrong while converting to pipeline")));
      }, this);
      return convertToPipelineButton;
    },

    __updateUIMode: function(studyData, uiMode) {
      const studyUI = osparc.utils.Utils.deepCloneObject(studyData["ui"]);
      studyUI["mode"] = uiMode;
      return osparc.info.StudyUtils.patchStudyData(studyData, "ui", studyUI)
        .then(() => this._updateStudyData(studyData))
    },

    __getExportCMisMenuButton: function(studyData) {
      const exportButton = new qx.ui.menu.Button(this.tr("Export cMIS"), "@FontAwesome5Solid/cloud-download-alt/12");
      exportButton["exportCMISButton"] = true;
      const isDisabled = osparc.utils.DisabledPlugins.isExportDisabled();
      exportButton.setVisibility(isDisabled ? "excluded" : "visible");
      exportButton.addListener("execute", () => this.__exportStudy(studyData), this);
      return exportButton;
    },

    _deleteResourceRequested: function(studyId) {
      if (this.getCurrentContext() === "trash") {
        this.__deleteStudyRequested(this.__getStudyData(studyId));
      } else {
        this.__trashStudyRequested(this.__getStudyData(studyId));
      }
    },

    __trashStudyRequested: function(studyData) {
      const preferencesSettings = osparc.Preferences.getInstance();
      if (preferencesSettings.getConfirmDeleteStudy()) {
        const win = this.__createConfirmTrashWindow([studyData.name]);
        win.center();
        win.open();
        win.addListener("close", () => {
          if (win.getConfirmed()) {
            this.__trashStudy(studyData);
          }
        }, this);
      } else {
        this.__trashStudy(studyData);
      }
    },

    __deleteStudyRequested: function(studyData) {
      const preferencesSettings = osparc.Preferences.getInstance();
      if (preferencesSettings.getConfirmDeleteStudy()) {
        const win = this.__deleteOrRemoveMe(studyData) === "remove" ? this.__createConfirmRemoveForMeWindow(studyData.name) : this.__createConfirmDeleteWindow([studyData.name]);
        win.center();
        win.open();
        win.addListener("close", () => {
          if (win.getConfirmed()) {
            this.__doDeleteStudy(studyData);
          }
        }, this);
      } else {
        this.__doDeleteStudy(studyData);
      }
    },

    __getTrashStudyMenuButton: function(studyData) {
      const trashButton = new qx.ui.menu.Button(this.tr("Delete"), "@FontAwesome5Solid/trash/12");
      trashButton["trashButton"] = true;
      trashButton.set({
        appearance: "menu-button"
      });
      osparc.utils.Utils.setIdToWidget(trashButton, "studyItemMenuDelete");
      trashButton.addListener("execute", () => this.__trashStudyRequested(studyData), this);
      return trashButton;
    },

    __getUntrashStudyMenuButton: function(studyData) {
      const restoreButton = new qx.ui.menu.Button(this.tr("Restore"), "@MaterialIcons/restore_from_trash/16");
      restoreButton["untrashButton"] = true;
      restoreButton.set({
        appearance: "menu-button"
      });
      restoreButton.addListener("execute", () => this.__untrashStudy(studyData), this);
      return restoreButton;
    },

    __getDeleteStudyMenuButton: function(studyData) {
      const deleteButton = new qx.ui.menu.Button(this.tr("Delete permanently"), "@FontAwesome5Solid/trash/12");
      deleteButton["deleteButton"] = true;
      deleteButton.set({
        appearance: "menu-button"
      });
      osparc.utils.Utils.setIdToWidget(deleteButton, "studyItemMenuDelete");
      deleteButton.addListener("execute", () => this.__deleteStudyRequested(studyData), this);
      return deleteButton;
    },

    __getStudyData: function(id) {
      return this._resourcesList.find(study => study.uuid === id);
    },

    __createDuplicateCard: function(studyName) {
      const isGrid = this._resourcesContainer.getMode() === "grid";
      const duplicatingStudyCard = isGrid ? new osparc.dashboard.GridButtonPlaceholder() : new osparc.dashboard.ListButtonPlaceholder();
      duplicatingStudyCard.buildLayout(
        this.tr("Duplicating ") + studyName,
        osparc.task.Duplicate.ICON + (isGrid ? "60" : "24"),
        null,
        true
      );
      return duplicatingStudyCard;
    },

    __duplicateStudy: function(studyData) {
      const text = this.tr("Duplicate process started and added to the background tasks");
      osparc.FlashMessenger.logAs(text, "INFO");

      const params = {
        url: {
          "studyId": studyData["uuid"]
        }
      };
      const options = {
        pollTask: true
      };
      const fetchPromise = osparc.data.Resources.fetch("studies", "duplicate", params, options);
      const interval = 1000;
      const pollTasks = osparc.data.PollTasks.getInstance();
      pollTasks.createPollingTask(fetchPromise, interval)
        .then(task => this.__taskDuplicateReceived(task, studyData["name"]))
        .catch(err => osparc.FlashMessenger.logError(err, this.tr("Something went wrong while duplicating")));
    },

    __exportStudy: function(studyData) {
      const exportTask = new osparc.task.Export(studyData);
      exportTask.start();
      exportTask.setSubtitle(this.tr("Preparing files"));
      const text = this.tr("Exporting process started and added to the background tasks");
      osparc.FlashMessenger.logAs(text, "INFO");

      const url = window.location.href + "v0/projects/" + studyData["uuid"] + ":xport";
      const progressCB = () => {
        const textSuccess = this.tr("Download started");
        exportTask.setSubtitle(textSuccess);
      };
      osparc.utils.Utils.downloadLink(url, "POST", null, progressCB)
        .catch(err => {
          const msg = osparc.data.Resources.getErrorMsg(JSON.parse(err.response)) || this.tr("Something went wrong while exporting the study");
          osparc.FlashMessenger.logError(err, msg);
        })
        .finally(() => {
          exportTask.stop();
        });
    },

    __importStudy: function(file) {
      const uploadingLabel = this.tr("Uploading file");
      const importTask = new osparc.task.Import();
      importTask.start();
      importTask.setSubtitle(uploadingLabel);

      const text = this.tr("Importing process started and added to the background tasks");
      osparc.FlashMessenger.logAs(text, "INFO");

      const isGrid = this._resourcesContainer.getMode() === "grid";
      const importingStudyCard = isGrid ? new osparc.dashboard.GridButtonPlaceholder() : new osparc.dashboard.ListButtonPlaceholder();
      importingStudyCard.buildLayout(
        this.tr("Importing Study..."),
        "@FontAwesome5Solid/cloud-upload-alt/" + (isGrid ? "60" : "24"),
        uploadingLabel,
        true
      );
      importingStudyCard.subscribeToFilterGroup("searchBarFilter");
      this._resourcesContainer.addNonResourceCard(importingStudyCard);

      const body = new FormData();
      body.append("fileName", file);

      const req = new XMLHttpRequest();
      req.upload.addEventListener("progress", ep => {
        // updateProgress
        if (ep.lengthComputable) {
          const percentComplete = ep.loaded / ep.total * 100;
          importingStudyCard.getChildControl("progress-bar").setValue(percentComplete);
          if (percentComplete === 100) {
            const processingLabel = this.tr("Processing study");
            importingStudyCard.getChildControl("state-label").setValue(processingLabel);
            importTask.setSubtitle(processingLabel);
            importingStudyCard.getChildControl("progress-bar").exclude();
          }
        } else {
          console.log("Unable to compute progress information since the total size is unknown");
        }
      }, false);
      req.addEventListener("load", e => {
        // transferComplete
        if (req.status == 200) {
          const processingLabel = this.tr("Processing study");
          importingStudyCard.getChildControl("state-label").setValue(processingLabel);
          importTask.setSubtitle(processingLabel);
          importingStudyCard.getChildControl("progress-bar").exclude();
          const data = JSON.parse(req.responseText);
          const params = {
            url: {
              "studyId": data["data"]["uuid"]
            }
          };
          osparc.data.Resources.fetch("studies", "getOne", params)
            .then(studyData => this._updateStudyData(studyData))
            .catch(err => osparc.FlashMessenger.logError(err, this.tr("Something went wrong while fetching the study")))
            .finally(() => {
              importTask.stop();
              this._resourcesContainer.removeNonResourceCard(importingStudyCard);
            });
        } else if (req.status == 400) {
          importTask.stop();
          this._resourcesContainer.removeNonResourceCard(importingStudyCard);
          const msg = osparc.data.Resources.getErrorMsg(JSON.parse(req.response)) || this.tr("Something went wrong while importing the study");
          osparc.FlashMessenger.logError(msg);
        }
      });
      req.addEventListener("error", e => {
        // transferFailed
        importTask.stop();
        this._resourcesContainer.removeNonResourceCard(importingStudyCard);
        const msg = osparc.data.Resources.getErrorMsg(e) || this.tr("Something went wrong while importing the study");
        osparc.FlashMessenger.logError(msg);
      });
      req.addEventListener("abort", e => {
        // transferAborted
        importTask.stop();
        this._resourcesContainer.removeNonResourceCard(importingStudyCard);
        const msg = osparc.data.Resources.getErrorMsg(e) || this.tr("Something went wrong while importing the study");
        osparc.FlashMessenger.logError(msg);
      });
      req.open("POST", "/v0/projects:import", true);
      req.send(body);
    },

    __untrashStudy: function(studyData) {
      osparc.store.Store.getInstance().untrashStudy(studyData.uuid)
        .then(() => {
          this.__removeFromStudyList(studyData.uuid);
          const msg = this.tr("Successfully restored");
          osparc.FlashMessenger.logAs(msg, "INFO");
          this._resourceFilter.evaluateTrashEmpty();
        })
        .catch(err => osparc.FlashMessenger.logError(err))
        .finally(() => this.resetSelection());
    },

    __trashStudy: function(studyData) {
      osparc.store.Store.getInstance().trashStudy(studyData.uuid)
        .then(() => {
          this.__removeFromStudyList(studyData.uuid);
          const msg = this.tr("Successfully deleted");
          osparc.FlashMessenger.logAs(msg, "INFO");
          this._resourceFilter.setTrashEmpty(false);
        })
        .catch(err => osparc.FlashMessenger.logError(err))
        .finally(() => this.resetSelection());
    },

    __trashStudies: function(studiesData) {
      studiesData.forEach(studyData => this.__trashStudy(studyData));
    },

    __deleteOrRemoveMe: function(studyData) {
      const deleteAccess = osparc.data.model.Study.canIDelete(studyData["accessRights"]);
      const myGid = osparc.auth.Data.getInstance().getGroupId();
      const collabGids = Object.keys(studyData["accessRights"]);
      const amICollaborator = collabGids.indexOf(myGid) > -1;
      return (!deleteAccess && collabGids.length > 1 && amICollaborator) ? "remove" : "delete";
    },

    __removeMeFromCollaborators: function(studyData) {
      const arCopy = osparc.utils.Utils.deepCloneObject(studyData["accessRights"]);
      // remove me from collaborators
      const myGid = osparc.auth.Data.getInstance().getGroupId();
      delete arCopy[myGid];
      return osparc.store.Study.patchStudyData(studyData, "accessRights", arCopy);
    },

    __doDeleteStudy: function(studyData) {
      let operationPromise = null;
      if (this.__deleteOrRemoveMe(studyData) === "remove") {
        operationPromise = this.__removeMeFromCollaborators(studyData);
      } else {
        // delete study
        operationPromise = osparc.store.Store.getInstance().deleteStudy(studyData.uuid);
      }
      operationPromise
        .then(() => this.__removeFromStudyList(studyData.uuid))
        .catch(err => osparc.FlashMessenger.logError(err))
        .finally(() => this.resetSelection());
    },

    __doDeleteStudies: function(studiesData) {
      studiesData.forEach(studyData => this.__doDeleteStudy(studyData));
    },

    __createConfirmTrashWindow: function(studyNames) {
      let msg = this.tr("Are you sure you want to delete");
      if (studyNames.length > 1) {
        const studiesText = osparc.product.Utils.getStudyAlias({plural: true});
        msg += ` ${studyNames.length} ${studiesText}?`;
      } else {
        msg += ` '${studyNames[0]}'?`;
      }
      const trashDays = osparc.store.StaticInfo.getInstance().getTrashRetentionDays();
      msg += "<br><br>" + (studyNames.length > 1 ? "They" : "It") + this.tr(` will be permanently deleted after ${trashDays} days.`);
      const confirmationWin = new osparc.ui.window.Confirmation(msg).set({
        caption: this.tr("Delete"),
        confirmText: this.tr("Delete"),
        confirmAction: "warning",
      });
      osparc.utils.Utils.setIdToWidget(confirmationWin.getConfirmButton(), "confirmDeleteStudyBtn");
      return confirmationWin;
    },

    __createConfirmRemoveForMeWindow: function(studyName) {
      const msg = `'${studyName} ` + this.tr("will be removed from your list. Collaborators will still have access.");
      const confirmationWin = new osparc.ui.window.Confirmation(msg).set({
        caption: this.tr("Remove"),
        confirmText: this.tr("Remove"),
        confirmAction: "delete"
      });
      osparc.utils.Utils.setIdToWidget(confirmationWin.getConfirmButton(), "confirmDeleteStudyBtn");
      return confirmationWin;
    },

    __createConfirmDeleteWindow: function(studyNames) {
      let msg = this.tr("Are you sure you want to delete");
      const studyAlias = osparc.product.Utils.getStudyAlias({plural: studyNames.length > 1});
      msg += (studyNames.length > 1 ? ` ${studyNames.length} ${studyAlias}?` : ` <b>${studyNames[0]}</b>?`);
      const confirmationWin = new osparc.ui.window.Confirmation(msg).set({
        caption: this.tr("Delete") + " " + studyAlias,
        confirmText: this.tr("Delete permanently"),
        confirmAction: "delete"
      });
      osparc.utils.Utils.setIdToWidget(confirmationWin.getConfirmButton(), "confirmDeleteStudyBtn");
      return confirmationWin;
    },

    // TASKS //
    __tasksReceived: function(tasks) {
      tasks.forEach(taskData => this._taskDataReceived(taskData));
    },

    _taskDataReceived: function(taskData) {
      // a bit hacky
      if (taskData["task_id"].includes("from_study") && !taskData["task_id"].includes("as_template")) {
        const interval = 1000;
        const pollTasks = osparc.data.PollTasks.getInstance();
        const task = pollTasks.addTask(taskData, interval);
        if (task === null) {
          return;
        }
        // ask backend for studyData?
        const studyName = "";
        this.__taskDuplicateReceived(task, studyName);
      }
    },

    __taskDuplicateReceived: function(task, studyName) {
      const duplicateTaskUI = new osparc.task.Duplicate(studyName);
      duplicateTaskUI.setTask(task);
      duplicateTaskUI.start();
      const duplicatingStudyCard = this.__createDuplicateCard(studyName);
      duplicatingStudyCard.setTask(task);
      duplicatingStudyCard.subscribeToFilterGroup("searchBarFilter");
      this._resourcesContainer.addNonResourceCard(duplicatingStudyCard);
      this.__attachDuplicateEventHandler(task, duplicateTaskUI, duplicatingStudyCard);
    },

    __attachDuplicateEventHandler: function(task, taskUI, duplicatingStudyCard) {
      const finished = (msg, msgLevel) => {
        if (msg) {
          osparc.FlashMessenger.logAs(msg, msgLevel);
        }
        taskUI.stop();
        this._resourcesContainer.removeNonResourceCard(duplicatingStudyCard);
      };

      task.addListener("taskAborted", () => {
        const msg = this.tr("Duplication cancelled");
        finished(msg, "INFO");
      });
      task.addListener("resultReceived", e => {
        finished();
        const duplicatedStudyData = e.getData();
        this._updateStudyData(duplicatedStudyData);
      });
      task.addListener("pollingError", e => {
        const err = e.getData();
        const msg = this.tr("Something went wrong while duplicating the study<br>") + err.message;
        finished(msg, "ERROR");
      });
    }
    // TASKS //
  }
});
