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
 * @ignore(URL)
 * @ignore(sessionStorage)
 * @ignore(fetch)
 * @ignore(URLSearchParams)
 */

/**
 * Sandbox of static methods that do not fit in other utils classes.
 */

qx.Class.define("osparc.utils.Utils", {
  type: "static",

  statics: {
    localCache: {
      setLocalStorageItem: function(key, value) {
        window.localStorage.setItem(key, value);
      },
      getLocalStorageItem: function(name) {
        return window.localStorage.getItem(name);
      },

      getLastCommitVcsRefUI: function() {
        return this.getLocalStorageItem("lastVcsRefUI");
      },
      setLastCommitVcsRefUI: function(vcsRef) {
        this.setLocalStorageItem("lastVcsRefUI", vcsRef);
      },

      getDontShowAnnouncements: function() {
        return this.getLocalStorageItem("dontShowAnnouncements") ? JSON.parse(this.getLocalStorageItem("dontShowAnnouncements")) : [];
      },
      setDontShowAnnouncement: function(announcementId) {
        const oldDontShowAnnouncements = this.getDontShowAnnouncements();
        oldDontShowAnnouncements.push(announcementId);
        this.setLocalStorageItem("dontShowAnnouncements", JSON.stringify(oldDontShowAnnouncements));
      },
      isDontShowAnnouncement: function(announcementId) {
        return this.getDontShowAnnouncements().includes(announcementId);
      },

      serviceToFavs: function(serviceKey) {
        let serviceFavs = this.getLocalStorageItem("services");
        if (serviceFavs) {
          serviceFavs = JSON.parse(serviceFavs);
        } else {
          serviceFavs = {};
        }
        if (serviceFavs && (serviceKey in serviceFavs)) {
          serviceFavs[serviceKey]["hits"]++;
        } else {
          serviceFavs[serviceKey] = {
            hits: 1
          };
        }
        this.setLocalStorageItem("services", JSON.stringify(serviceFavs));
      },

      getFavServices: function() {
        const serviceFavs = this.getLocalStorageItem("services");
        if (serviceFavs) {
          return JSON.parse(serviceFavs);
        }
        return [];
      },

      getSortedFavServices: function() {
        const serviceFavs = this.getFavServices();
        const favServices = Object.keys().sort((a, b) => serviceFavs[b]["hits"] - serviceFavs[a]["hits"]);
        return favServices;
      }
    },

    FLOATING_Z_INDEX: 1000001 + 1,

    getBounds: function(widget) {
      const bounds = widget.getBounds();
      const cel = widget.getContentElement();
      if (cel) {
        const domeEle = cel.getDomElement();
        if (domeEle) {
          const rect = domeEle.getBoundingClientRect();
          bounds.left = parseInt(rect.x);
          bounds.top = parseInt(rect.y);
          bounds.width = parseInt(rect.width);
          bounds.height = parseInt(rect.height);
        }
      }
      return bounds;
    },

    replaceIconWithThumbnail: function(widget, thumbnailUrl, size = 24) {
      if (thumbnailUrl) {
        const thumbnail = new osparc.ui.basic.Thumbnail(thumbnailUrl, size, size).set({
          minHeight: size,
          minWidth: size,
        });
        thumbnail.getChildControl("image").set({
          anonymous: true,
          decorator: "rounded",
        });
        switch (widget.classname) {
          case "qx.ui.menu.Button":
            // eslint-disable-next-line no-underscore-dangle
            widget._add(thumbnail, {column: 0});
            break;
          case "qx.ui.toolbar.RadioButton":
            // eslint-disable-next-line no-underscore-dangle
            widget._addAt(thumbnail, 0);
            break;
        }
      }
    },

    disableAutocomplete: function(control) {
      if (control && control.getContentElement()) {
        control.getContentElement().setAttribute("autocomplete", "off");
        control.getContentElement().setAttribute("type", "search");
        control.getContentElement().setAttribute("name", "osparcdontautomplete");
        control.getContentElement().setAttribute("id", "osparcdontautomplete");
      }
    },

    checkImageExists: function(url) {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });
    },

    setUrlSourceToImage: function(image, imgSrc) {
      let source = osparc.product.Utils.getThumbnailUrl();
      this.checkImageExists(imgSrc)
        .then(exists => {
          if (exists) {
            source = imgSrc;
          }
        })
        .finally(() => image.setSource(source));
    },

    addWhiteSpaces: function(integer) {
      return new Intl.NumberFormat("fr-FR").format(integer); // french will add white spaces every 3 digits
    },

    updateTabName: function(name) {
      document.title = name;
    },

    composeTabName: function() {
      let newName = osparc.store.StaticInfo.getInstance().getDisplayName();
      const platformName = osparc.store.StaticInfo.getInstance().getPlatformName();
      if (osparc.utils.Utils.isInZ43()) {
        newName += " Z43";
      }
      if (platformName) {
        newName += ` (${platformName})`;
      }
      return newName;
    },

    getIconFromResource: function(resourceMetadata) {
      if (resourceMetadata) {
        if (resourceMetadata["icon"]) {
          return resourceMetadata["icon"];
        }
        if (resourceMetadata["thumbnail"]) {
          return resourceMetadata["thumbnail"];
        }
      }
      return osparc.dashboard.CardBase.PRODUCT_ICON;
    },

    isEmail: function(value) {
      const reg = /^([A-Za-z0-9_\-.+])+@([A-Za-z0-9_\-.])+\.([A-Za-z]{2,})$/;
      return reg.test(value);
    },

    replaceTokens: function(str, key, value) {
      // `str` might be a a localized string, get the string first
      str = str.toString ? str.toString() : str;
      const regex = new RegExp("\\${"+key+"\\}", "g");
      return str.replace(regex, value);
    },

    /**
     * @param {qx.ui.basic.Image} image
     */
    forceRatioAfterLoad: function(image, force ="width", maxDimension = null) {
      image.set({
        scale: true,
        allowStretchX: true,
        allowStretchY: true,
        alignX: "center",
        alignY: "middle"
      });

      const recheckSize = () => {
        const source = image.getSource();
        if (source) {
          const srcWidth = qx.io.ImageLoader.getWidth(source);
          const srcHeight = qx.io.ImageLoader.getHeight(source);
          if (srcWidth && srcHeight) {
            const aspectRatio = srcWidth/srcHeight;
            switch (force) {
              case "width": {
                const newHeight = maxDimension/aspectRatio;
                image.set({
                  maxWidth: maxDimension,
                  maxHeight: parseInt(newHeight)
                });
                break;
              }
              case "height": {
                const newWidth = maxDimension*aspectRatio;
                image.set({
                  maxHeight: maxDimension,
                  maxWidth: parseInt(newWidth)
                });
                break;
              }
            }
          }
        }
      };
      [
        "appear",
        "loaded"
      ].forEach(eventName => {
        image.addListener(eventName, () => recheckSize(), this);
      });
    },

    /**
     * @param {qx.ui.basic.Image} image
     */
    openImageOnTap: function(image) {
      const source = image.getSource();
      if (source) {
        image.set({
          cursor: "pointer"
        });
        image.addListener("tap", () => window.open(source, "_blank"));
      }
    },

    getDefaultFont: function() {
      const defaultFont = {
        family: null,
        size: null
      };
      const defFont = qx.theme.manager.Font.getInstance().resolve("default");
      if (defFont) {
        const family = defFont.getFamily();
        if (family) {
          defaultFont["family"] = family[0];
        }
        defaultFont["color"] = defFont.getColor();
        defaultFont["size"] = defFont.getSize();
      }
      return defaultFont;
    },

    animateUsage: function(domElement) {
      const desc = {
        duration: 500,
        timing: "ease-out",
        keyFrames: {
          0: {
            "opacity": 1
          },
          70: {
            "opacity": 0.8
          },
          100: {
            "opacity": 1
          }
        }
      };
      qx.bom.element.Animation.animate(domElement, desc);
    },

    getGridsFirstColumnWidth: function(grid) {
      let firstColumnWidth = null;
      const firstElement = grid.getCellWidget(0, 0);
      const secondElement = grid.getCellWidget(0, 1);
      if (firstElement && secondElement) {
        const firstCellBounds = firstElement.getBounds();
        const secondCellBounds = secondElement.getBounds();
        if (firstCellBounds && secondCellBounds) {
          const left1 = firstCellBounds.left;
          const left2 = secondCellBounds.left;
          firstColumnWidth = left2 - left1;
        }
      }
      return firstColumnWidth;
    },

    makeButtonBlink: function(button, nTimes = 1) {
      const onTime = 1000;
      const oldBgColor = button.getBackgroundColor();
      let count = 0;

      const blinkIt = btn => {
        count++;
        btn.setBackgroundColor("strong-main");
        setTimeout(() => {
          btn && btn.setBackgroundColor(oldBgColor);
        }, onTime);
      };

      // make it "blink": show it as strong button during onTime" nTimes
      blinkIt(button);
      const intervalId = setInterval(() => {
        (count < nTimes) ? blinkIt(button) : clearInterval(intervalId);
      }, 2*onTime);
    },

    hardRefresh: function() {
      // https://stackoverflow.com/questions/5721704/window-location-reload-with-clear-cache
      // No cigar. Tried:
      // eslint-disable-next-line no-self-assign
      // window.location.href = window.location.href;
      // window.location.href = window.location.origin + window.location.pathname + window.location.search + (window.location.search ? "&" : "?") + "reloadTime=" + Date.now().toString() + window.location.hash;
      // window.location.href = window.location.href.replace(/#.*$/, "");
    },

    reloadNoCacheButton: function() {
      const reloadButton = new qx.ui.form.Button().set({
        label: qx.locale.Manager.tr("Reload"),
        icon: "@FontAwesome5Solid/redo/16",
        font: "text-16",
        gap: 10,
        appearance: "strong-button",
        allowGrowX: false,
        center: true,
        alignX: "center",
      });
      reloadButton.addListener("execute", () => {
        // this argument, which is passed and consumed by the boot.js init file,
        // adds a `nocache=rand()` query argument to the js resource calls.
        // This forces a hard reload
        const noCacheUrl = window.location.href + "?qooxdoo:add-no-cache=true";
        window.location.href = noCacheUrl;
      });
      return reloadButton;
    },

    getUniqueName: function(preferredName, existingNames) {
      let title = preferredName;
      if (existingNames.includes(title)) {
        let cont = 1;
        while (existingNames.includes(`${title} (${cont})`)) {
          cont++;
        }
        title += ` (${cont})`;
      }
      return title;
    },

    isElementOnScreen: function(element) {
      if (element) {
        const rect = element.getBoundingClientRect();
        const html = document.documentElement;
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top >= 0 &&
          rect.left >= 0 &&
          // a bit of tolerance to deal with zooming factors
          rect.bottom*0.95 <= (window.innerHeight || html.clientHeight) &&
          rect.right*0.95 <= (window.innerWidth || html.clientWidth)
        );
      }
      return false;
    },

    isWidgetOnScreen: function(widget) {
      const domElem = widget.getContentElement().getDomElement();
      const isWidgetOnScreen = this.isElementOnScreen(domElem);
      return isWidgetOnScreen;
    },

    growSelectBox: function(selectBox, maxWidth) {
      let largest = 0;
      selectBox.getSelectables().forEach(listItem => {
        largest = Math.max(listItem.getSizeHint().width, largest);
      });
      largest += 15;
      selectBox.set({
        width: maxWidth ? Math.min(maxWidth, largest) : largest,
        minWidth: 120
      });
    },

    toTwoDecimals: function(value) {
      return Math.round(100*value)/100;
    },

    computeServiceUrl: function(resp) {
      const data = {
        srvUrl: null,
        isDynamicV2: null
      };
      const isDynamicV2 = resp["boot_type"] === "V2" || false;
      data["isDynamicV2"] = isDynamicV2;
      if (isDynamicV2) {
        // dynamic service
        const srvUrl = window.location.protocol + "//" + resp["service_uuid"] + ".services." + window.location.host;
        data["srvUrl"] = srvUrl;
      } else {
        // old implementation
        const servicePath = resp["service_basepath"];
        const entryPointD = resp["entry_point"];
        if (servicePath) {
          const entryPoint = entryPointD ? ("/" + entryPointD) : "/";
          const srvUrl = servicePath + entryPoint;
          data["srvUrl"] = srvUrl;
        }
      }
      return data;
    },

    computeServiceRetrieveUrl: function(srvUrl) {
      const urlRetrieve = srvUrl + "/retrieve";
      return urlRetrieve.replace("//retrieve", "/retrieve");
    },

    computeServiceV2RetrieveUrl: function(studyId, nodeId) {
      const urlBase = window.location.protocol + "//" + window.location.host + "/v0";
      return urlBase + "/projects/" + studyId + "/nodes/" + nodeId + ":retrieve";
    },

    setZoom: function(el, zoom) {
      const transformOrigin = [0, 0];
      const p = ["webkit", "moz", "ms", "o"];
      const s = `scale(${zoom})`;
      const oString = (transformOrigin[0] * 100) + "% " + (transformOrigin[1] * 100) + "%";
      for (let i = 0; i < p.length; i++) {
        el.style[p[i] + "Transform"] = s;
        el.style[p[i] + "TransformOrigin"] = oString;
      }
      el.style["transform"] = s;
      el.style["transformOrigin"] = oString;
    },

    isMouseOnElement: function(element, event, offset = 0) {
      const domElement = element.getContentElement().getDomElement();
      const boundRect = domElement && domElement.getBoundingClientRect();
      if (boundRect &&
        event.x > boundRect.x - offset &&
        event.y > boundRect.y - offset &&
        event.x < (boundRect.x + boundRect.width) + offset &&
        event.y < (boundRect.y + boundRect.height) + offset) {
        return true;
      }
      return false;
    },

    sleep: function(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    isValidHttpUrl: function(string) {
      let url;
      try {
        url = new URL(string);
      } catch (_) {
        return false;
      }
      return url.protocol === "http:" || url.protocol === "https:";
    },

    isDevelopmentPlatform: function() {
      const platformName = osparc.store.StaticInfo.getInstance().getPlatformName();
      return (["dev", "master"].includes(platformName));
    },

    eventDrivenPatch: function() {
      return osparc.utils.DisabledPlugins.isRTCEnabled();
    },

    getEditButton: function(isVisible = true) {
      return new qx.ui.form.Button(null, "@FontAwesome5Solid/pencil-alt/12").set({
        appearance: "form-button-outlined",
        allowGrowY: false,
        padding: 3,
        maxWidth: 20,
        visibility: isVisible ? "visible" : "excluded"
      });
    },

    getLinkButton: function(isVisible = true) {
      return new qx.ui.form.Button(null, "@FontAwesome5Solid/link/12").set({
        appearance: "form-button-outlined",
        allowGrowY: false,
        padding: 3,
        maxWidth: 20,
        visibility: isVisible ? "visible" : "excluded"
      });
    },

    getCopyButton: function() {
      const button = new qx.ui.form.Button(null, "@FontAwesome5Solid/copy/12").set({
        allowGrowY: false,
        toolTipText: qx.locale.Manager.tr("Copy to clipboard"),
        padding: 3,
        maxWidth: 20
      });
      return button;
    },

    /**
      * @param value {Date Object} Date Object
      */
    formatDate: function(value) {
      // create a date format like "Oct. 19, 11:31 AM" if it's this year
      const dateFormat = new qx.util.format.DateFormat(
        qx.locale.Date.getDateFormat("medium")
      );

      let dateStr = null;
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (today.toDateString() === value.toDateString()) {
        dateStr = qx.locale.Manager.tr("Today");
      } else if (yesterday.toDateString() === value.toDateString()) {
        dateStr = qx.locale.Manager.tr("Yesterday");
      } else if (tomorrow.toDateString() === value.toDateString()) {
        dateStr = qx.locale.Manager.tr("Tomorrow");
      } else {
        const currentYear = today.getFullYear();
        if (value.getFullYear() === currentYear) {
          // Remove the year if it's the current year
          const shortDateFormat = new qx.util.format.DateFormat("MMM d");
          dateStr = shortDateFormat.format(value);
        } else {
          dateStr = dateFormat.format(value);
        }
      }
      return dateStr;
    },

    formatDateYyyyMmDd(date) {
      const offset = date.getTimezoneOffset();
      const ret = new Date(date.getTime() - (offset*60*1000));
      return ret.toISOString().split("T")[0]
    },

    /**
      * @param value {Date Object} Date Object
      */
    formatTime: function(value, long = false) {
      const timeFormat = new qx.util.format.DateFormat(
        qx.locale.Date.getTimeFormat(long ? "long" : "short")
      );
      const timeStr = timeFormat.format(value);
      return timeStr;
    },

    /**
      * @param value {Date Object} Date Object
      */
    formatDateAndTime: function(value) {
      return osparc.utils.Utils.formatDate(value) + " " + osparc.utils.Utils.formatTime(value);
    },

    formatMsToHHMMSS: function(ms) {
      const absMs = Math.abs(ms)
      const nHours = Math.floor(absMs / 3600000)
      const remaining1 = absMs - (nHours * 3600000)
      const nMinutes = Math.floor(remaining1 / 60000)
      const remaining2 = remaining1 - (nMinutes * 60000)
      const nSeconds = Math.round(remaining2 / 1000)
      return `${ms < 0 ? "-" : ""}${nHours}:${nMinutes.toString().padStart(2, "0")}:${nSeconds.toString().padStart(2, "0")}`
    },

    formatSeconds: function(seconds) {
      const min = Math.floor(seconds / 60);
      const sec = seconds - min * 60;
      const minutesStr = ("0" + min).slice(-2);
      const secondsStr = ("0" + sec).slice(-2);
      return `${minutesStr}:${secondsStr}`;
    },

    daysBetween: function(day1, day2) {
      // The number of milliseconds in one day
      const ONE_DAY = 1000 * 60 * 60 * 24;
      // Calculate the difference in milliseconds
      const differenceMs = day2 - day1;
      // Convert back to days and return
      const daysBetween = Math.round(differenceMs / ONE_DAY);
      return daysBetween;
    },

    getReleaseTag: function() {
      const rData = osparc.store.StaticInfo.getInstance().getReleaseData();
      const platformVersion = osparc.utils.LibVersions.getPlatformVersion();
      let text = (rData["tag"] && rData["tag"] !== "latest") ? rData["tag"] : platformVersion.version;
      return text;
    },

    getReleaseLink: function() {
      const rData = osparc.store.StaticInfo.getInstance().getReleaseData();
      return rData["url"] || osparc.utils.LibVersions.getVcsRefUrl();
    },

    createReleaseNotesLink: function() {
      let text = "osparc-simcore " + this.getReleaseTag();
      const platformName = osparc.store.StaticInfo.getInstance().getPlatformName();
      text += platformName.length ? ` (${platformName})` : "";
      const url = this.self().getReleaseLink();
      const versionLink = new osparc.ui.basic.LinkLabel();
      versionLink.set({
        value: text,
        url
      });
      return versionLink;
    },

    expirationMessage: function(daysToExpiration) {
      let msg = "";
      if (daysToExpiration === 0) {
        msg = qx.locale.Manager.tr("Your account will expire today.");
      } else if (daysToExpiration === 1) {
        msg = qx.locale.Manager.tr("Your account will expire tomorrow.");
      } else {
        msg = qx.locale.Manager.tr("Your account will expire in ") + daysToExpiration + qx.locale.Manager.tr(" days.");
      }
      msg += "</br>";
      msg += qx.locale.Manager.tr("Please contact us via email:");
      msg += "</br>";
      const supportEmail = osparc.store.VendorInfo.getInstance().getSupportEmail();
      msg += supportEmail;
      return msg;
    },

    // used for showing it to Guest users
    createAccountMessage: function() {
      const productName = osparc.store.StaticInfo.getInstance().getDisplayName();
      const manuals = osparc.store.Support.getManuals();
      const manualLink = (manuals && manuals.length) ? manuals[0].url : "";
      let msg = "";
      msg += qx.locale.Manager.tr("To use all ");
      msg += this.createHTMLLink(productName + " features", manualLink);

      if (osparc.product.Utils.getCreateAccountAction() === "REQUEST_ACCOUNT_FORM") {
        // if the product is configured to show a form to request an account,
        // then show a link to it in the message
        msg += qx.locale.Manager.tr(", please request an account in the following link:");
        msg += "</br>";
        msg += osparc.store.Support.requestAccountLink();
        return msg;
      }
      msg += qx.locale.Manager.tr(", please send us an e-mail to create an account:");
      msg += "</br>";
      const supportEmail = osparc.store.VendorInfo.getInstance().getSupportEmail();
      const mailto = osparc.store.Support.mailToLink(supportEmail, "Request Account " + productName);
      msg += mailto;
      return msg;
    },

    createHTMLLink: function(text, link) {
      const color = qx.theme.manager.Color.getInstance().resolve("text");
      return `<a href=${link} style='color: ${color}' target='_blank'>${text}</a>`;
    },

    getNameFromEmail: function(email) {
      return email.split("@")[0];
    },

    uuidV4: function() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
    },

    isInZ43: function() {
      return window.location.hostname.includes("speag");
    },

    addBorder: function(widget, width = 1, color = "transparent") {
      widget.getContentElement().setStyle("border", width+"px solid " + color);
    },

    updateBorderColor: function(widget, color = "inherit") {
      widget.getContentElement().setStyle("border-color", color);
    },

    addBackground: function(widget, color = "transparent") {
      widget.getContentElement().setStyle("background-color", color);
    },

    removeBackground: function(widget) {
      widget.getContentElement().setStyle("background-color", "transparent");
    },

    hideBorder: function(widget) {
      widget.getContentElement().setStyle("border", "1px solid transparent");
    },

    addBorderLeftRadius: function(widget) {
      widget.getContentElement().setStyles({
        "border-top-left-radius": "4px",
        "border-bottom-left-radius": "4px"
      });
    },

    addBorderRightRadius: function(widget) {
      widget.getContentElement().setStyles({
        "border-top-right-radius": "4px",
        "border-bottom-right-radius": "4px"
      });
    },

    __setStyleToIFrame: function(domEl) {
      if (domEl && domEl.contentDocument && domEl.contentDocument.documentElement) {
        const iframeDocument = domEl.contentDocument.documentElement;
        const colorManager = qx.theme.manager.Color.getInstance();
        const bgColor = colorManager.resolve("loading-page-background-color");
        const textColor = colorManager.resolve("loading-page-text");
        const spinnerColor = colorManager.resolve("loading-page-spinner");
        iframeDocument.style.setProperty("--background-color", bgColor);
        iframeDocument.style.setProperty("--text-color", textColor);
        iframeDocument.style.setProperty("--spinner-color", spinnerColor);
      }
    },

    compareVersionNumbers: function(v1, v2) {
      // https://stackoverflow.com/questions/6832596/how-to-compare-software-version-number-using-js-only-number/47500834
      // - a number < 0 if a < b
      // - a number > 0 if a > b
      // - 0 if a = b
      const regExStrip0 = /(\.0+)+$/;
      const segmentsA = v1.replace(regExStrip0, "").split(".");
      const segmentsB = v2.replace(regExStrip0, "").split(".");
      const l = Math.min(segmentsA.length, segmentsB.length);

      for (let i = 0; i < l; i++) {
        const diff = parseInt(segmentsA[i], 10) - parseInt(segmentsB[i], 10);
        if (diff) {
          return diff;
        }
      }
      return segmentsA.length - segmentsB.length;
    },

    // deep clone of nested objects
    deepCloneObject: function(src) {
      return JSON.parse(JSON.stringify(src));
    },

    prettifyJson: function(json) {
      return JSON.stringify(json, undefined, 2);
    },

    getRandomColor: function() {
      let letters = "0123456789ABCDEF";
      let color = "#";
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
    },

    getColorLuminance: function(color) {
      const rgb = qx.util.ColorUtil.isRgbString(color) || qx.util.ColorUtil.isRgbaString(color) ? qx.util.ColorUtil.stringToRgb(color) : qx.util.ColorUtil.hexStringToRgb(color);
      const luminance = 0.2126*(rgb[0]/255) + 0.7152*(rgb[1]/255) + 0.0722*(rgb[2]/255);
      return luminance;
    },

    getContrastedTextColor: function(color) {
      const L = this.getColorLuminance(color);
      return L > 0.35 ? "contrasted-text-dark" : "contrasted-text-light";
    },

    getContrastedBinaryColor: function(color) {
      const L = this.getColorLuminance(color);
      return L > 0.35 ? "#202020" : "#D0D0D0";
    },

    getRoundedBinaryColor: function(color) {
      const L = this.getColorLuminance(color);
      return L > 0.35 ? "#FFF" : "#000";
    },

    namedColorToHex: function(namedColor) {
      if (qx.util.ExtendedColor.isExtendedColor(namedColor)) {
        const rgb = qx.util.ExtendedColor.toRgb(namedColor);
        return qx.util.ColorUtil.rgbToHexString(rgb);
      }
      return "#888888";
    },

    bytesToSize: function(bytes, decimals = 2, isDecimalCollapsed = true) {
      if (!+bytes) {
        return "0 Bytes";
      }

      const k = 1000;
      const dm = decimals < 0 ? 0 : decimals;
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      const value = (bytes / Math.pow(k, i)).toFixed(dm);
      const metrics = ["Bytes", "kB", "MB", "GB", "TB"];
      const metric = i < metrics.length ? metrics[i] : "";
      return `${isDecimalCollapsed ? parseFloat(value) : value} ${metric}`
    },

    bytesToGB: function(bytes) {
      const b2gb = 1000*1000*1000;
      return Math.round(100*bytes/b2gb)/100;
    },

    bytesToGiB: function(bytes) {
      const b2gib = 1024*1024*1024;
      return Math.round(100*bytes/b2gib)/100;
    },

    gBToBytes: function(gBytes) {
      const b2gb = 1000*1000*1000;
      return gBytes*b2gb;
    },

    giBToBytes: function(giBytes) {
      const b2gib = 1024*1024*1024;
      return giBytes*b2gib;
    },

    retrieveURLAndDownload: function(locationId, fileId) {
      return new Promise((resolve, reject) => {
        let fileName = fileId.split("/");
        fileName = fileName[fileName.length-1];
        const download = true;
        const dataStore = osparc.store.Data.getInstance();
        dataStore.getPresignedLink(download, locationId, fileId)
          .then(presignedLinkData => {
            if (presignedLinkData.resp) {
              const link = presignedLinkData.resp.link;
              const fileNameFromLink = this.fileNameFromPresignedLink(link);
              fileName = fileNameFromLink ? fileNameFromLink : fileName;
              resolve({
                link,
                fileName
              });
            } else {
              resolve(null);
            }
          })
          .catch(err => reject(err));
      });
    },

    downloadLink: function(url, method, fileName, progressCb, loadedCb) {
      return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.responseType = "blob";
        xhr.addEventListener("readystatechange", () => {
          if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
            // The responseType value can be changed at any time before the readyState reaches 3.
            // When the readyState reaches 2, we have access to the response headers to make that decision with.
            if (xhr.status >= 200 && xhr.status < 400) {
              xhr.responseType = "blob";
            } else {
              // get ready for handling an error
              xhr.responseType = "text";
            }
          }
        });
        xhr.addEventListener("progress", e => {
          if (
            progressCb &&
            xhr.readyState === XMLHttpRequest.LOADING &&
            (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 400)) &&
            e["type"] === "progress"
          ) {
            progressCb(e.loaded / e.total);
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status == 200) {
            const blob = new Blob([xhr.response]);
            if (!fileName) {
              fileName = this.self().filenameFromContentDisposition(xhr);
            }
            this.self().downloadBlobContent(blob, fileName);
            if (loadedCb) {
              loadedCb();
            }
            resolve();
          } else {
            reject(xhr);
          }
        });
        xhr.addEventListener("error", () => reject(xhr));
        xhr.addEventListener("abort", () => reject(xhr));
        xhr.send();
      });
    },

    downloadBlobContent: function(blob, filename = "file") {
      let downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", window.URL.createObjectURL(blob));
      downloadAnchorNode.setAttribute("download", filename);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    },

    filenameFromContentDisposition: function(xhr) {
      // https://stackoverflow.com/questions/40939380/how-to-get-file-name-from-content-disposition
      let filename = "";
      const disposition = xhr.getResponseHeader("Content-Disposition");
      if (disposition && disposition.indexOf("attachment") !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, "");
        }
      }
      return filename;
    },

    fileNameFromPresignedLink: function(link) {
      // regex match /([^/]+)\?
      const fileNames = new URL(link).pathname.split("/");
      if (fileNames.length) {
        return fileNames.pop();
      }
      return null;
    },

    /**
     * Function that takes an indefinite number of strings as separated parameters, and concatenates them capitalizing the first letter.
     */
    capitalize: function() {
      let res = "";
      for (let i=0; i<arguments.length; i++) {
        if (typeof arguments[i] === "string" || arguments[i] instanceof String !== false) {
          const capitalized = arguments[i].charAt(0).toUpperCase() + arguments[i].slice(1);
          res = res.concat(capitalized);
        } else if (typeof arguments[i] === "object" && "classname" in arguments[i] && arguments[i]["classname"] === "qx.locale.LocalizedString") {
          // qx.locale.Manager
          // eslint-disable-next-line no-underscore-dangle
          const capitalized = arguments[i].__txt.charAt(0).toUpperCase() + arguments[i].__txt.slice(1);
          res = res.concat(capitalized);
        }
      }
      return res;
    },

    /**
     * Copies the given text to the clipboard
     *
     * @param text {String} Text to be copied
     * @return {Boolean} True if it was successful
     */
    copyTextToClipboard: function(text) {
      // from https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
      const textArea = document.createElement("textarea");

      //
      // *** This styling is an extra step which is likely not required. ***
      //
      // Why is it here? To ensure:
      // 1. the element is able to have focus and selection.
      // 2. if element was to flash render it has minimal visual impact.
      // 3. less flakyness with selection and copying which **might** occur if
      //    the textarea element is not visible.
      //
      // The likelihood is the element won't even render, not even a
      // flash, so some of these are just precautions. However in
      // Internet Explorer the element is visible whilst the popup
      // box asking the user for permission for the web page to
      // copy to the clipboard.
      //

      // Place in top-left corner of screen regardless of scroll position.
      // Ensure it has a small width and height. Setting to 1px / 1em
      // doesn't work as this gives a negative w/h on some browsers.
      // We don't need padding, reducing the size if it does flash render.
      // Clean up any borders.
      // Avoid flash of white box if rendered for any reason.
      textArea.style = {
        position: "fixed",
        top: 0,
        left: 0,
        width: "2em",
        height: "2em",
        padding: 0,
        border: "none",
        outline: "none",
        boxShadow: "none",
        background: "transparent"
      };
      textArea.value = text;

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch (err) {
        console.error("Oops, unable to copy");
      }

      document.body.removeChild(textArea);

      if (copied) {
        osparc.FlashMessenger.logAs(qx.locale.Manager.tr("Copied to clipboard"));
      }

      return copied;
    },

    cookie: {
      setCookie: (cname, cvalue, expDays) => {
        if (expDays) {
          const d = new Date();
          d.setTime(d.getTime() + (expDays * 24 * 60 * 60 * 1000));
          document.cookie = cname + "=" + cvalue + ";Expires=" + d.toUTCString() + ";path=/";
        } else {
          document.cookie = cname + "=" + cvalue + ";path=/";
        }
      },

      getCookie: cname => {
        const name = cname + "=";
        const ca = document.cookie.split(";");
        for (let i = 0; i < ca.length; i++) {
          let c = ca[i];
          while (c.charAt(0) == " ") {
            c = c.substring(1);
          }
          if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
          }
        }
        return null;
      },

      deleteCookie: cname => {
        document.cookie = cname + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }
    },

    parseURLFragment: () => {
      let urlHash = window.location.hash.slice(1);
      const parsedFragment = {};
      if (urlHash.length) {
        urlHash = urlHash.split("?");
        if (urlHash.length < 3) {
          // Nav
          urlHash[0].split("/").forEach(fragmentPart => {
            if (fragmentPart.length) {
              parsedFragment.nav = parsedFragment.nav || [];
              parsedFragment.nav.push(decodeURIComponent(fragmentPart));
            }
          });
          if (urlHash.length === 2) {
            // Params
            parsedFragment.params = parsedFragment.params || {};
            urlHash[1].replace(/([^=&]+)=([^&]*)/g, function(m, key, value) {
              parsedFragment.params[decodeURIComponent(key)] = decodeURIComponent(value);
            });
          }
        } else {
          console.error("URL fragment doesn't have the correct format.");
          return null;
        }
      }
      return parsedFragment;
    },

    getParamFromURL: (urlStr, param) => {
      const url = new URL(urlStr);
      const urlParams = new URLSearchParams(url.search);
      return urlParams.get(param);
    },

    hasParamFromURL: (urlStr, param) => {
      const url = new URL(urlStr);
      const urlParams = new URLSearchParams(url.search);
      return urlParams.has(param);
    },

    isUrl: url => /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/gm.test(url),

    snakeToCamel: str => {
      if (str.includes("_")) {
        return str.toLowerCase().replace(/([-_][a-z])/g, group =>
          group
            .toUpperCase()
            .replace("-", "")
            .replace("_", "")
        );
      }
      return str;
    },

    setIdToWidget: (qWidget, id) => {
      if (qWidget.getContentElement && qWidget.getContentElement() && id) {
        qWidget.getContentElement().setAttribute("osparc-test-id", id);
      }
    },

    getIdFromWidget: qWidget => {
      if (qWidget.getContentElement && qWidget.getContentElement()) {
        return qWidget.getContentElement().getAttribute("osparc-test-id");
      }
      return null;
    },

    removeIdAttribute: qWidget => {
      if (qWidget.getContentElement && qWidget.getContentElement()) {
        return qWidget.getContentElement().removeAttribute("osparc-test-id");
      }
      return null;
    },

    setKeyToWidget: (qWidget, id) => {
      if (qWidget.getContentElement && qWidget.getContentElement()) {
        qWidget.getContentElement().setAttribute("osparc-test-key", id);
      }
    },

    setAltToImage: (qWidget, altText) => {
      if (qWidget.getContentElement && qWidget.getContentElement()) {
        qWidget.getContentElement().removeAttribute("alt");
        qWidget.getContentElement().setAttribute("alt", altText);
      }
    },

    // Function that creates a unique tabId even for duplicated tabs
    getClientSessionID: function() {
      const getUniqueSessionId = () => {
        // before creating a new one, check if the websocket has it set
        const webSocket = osparc.wrapper.WebSocket.getInstance().getSocket();
        const clientSessionId = webSocket ? webSocket.io.engine.opts.query["client_session_id"] : osparc.utils.Utils.uuidV4();
        // Set window.name. This property is persistent on window reloads, but it doesn't get copied in a duplicated tab
        window.name = clientSessionId;
        sessionStorage.setItem("clientsessionid", clientSessionId);
        return clientSessionId;
      };

      let uniqueSessionId = sessionStorage.getItem("clientsessionid");
      if (uniqueSessionId) {
        // Check if the tab was duplicated
        // window.name is one of the few things it doesn't get copied, but persists on window reload
        if (window.name !== uniqueSessionId) {
          // Tab has been duplicated, generate a new uniqueId for the duplicated tab
          uniqueSessionId = getUniqueSessionId();
        }
      } else {
        // If no tabId exists in sessionStorage, generate one
        uniqueSessionId = getUniqueSessionId();
      }

      return uniqueSessionId;
    },

    getFreeDistanceToWindowEdges: function(layoutItem) {
      const domElement = layoutItem.getContentElement().getDomElement();
      if (domElement === null) {
        return null;
      }
      const location = qx.bom.element.Location.get(domElement);
      return {
        top: location.top,
        right: window.innerWidth - location.right,
        bottom: window.innerHeight - location.bottom,
        left: location.left
      };
    },

    fetchJSON: function() {
      return fetch.apply(null, arguments).then(response => response.json());
    },

    firstsUp: function(...args) {
      const labels = [];
      args.forEach(arg => labels.push(qx.lang.String.firstUp(arg)));
      return labels.length > 1 ? labels.join(" ") : labels[0];
    },

    onlyFirstsUp: function(word) {
      word = word.toLowerCase();
      return this.firstsUp(word);
    },

    isObject: function(v) {
      return typeof v === "object" && v !== null && !Array.isArray(v);
    },

    centerTabIcon: function(tabpage) {
      const button = tabpage.getButton();
      button.set({
        alignX: "center",
        alignY: "middle"
      });
      // eslint-disable-next-line no-underscore-dangle
      const btnLayout = button._getLayout();
      btnLayout.setColumnFlex(0, 1); // icon
      btnLayout.setColumnAlign(0, "center", "middle"); // icon
    },

    addClass: function(element, className) {
      if (element) {
        const currentClass = element.getAttribute("class");
        if (currentClass && currentClass.includes(className.trim())) {
          return;
        }
        element.setAttribute("class", ((currentClass || "") + " " + className).trim());
      }
    },

    removeClass: function(element, className) {
      const currentClass = element.getAttribute("class");
      if (currentClass) {
        const regex = new RegExp(className.trim(), "g");
        element.setAttribute("class", currentClass.replace(regex, ""));
      }
    },

    closeHangingWindows: function() {
      const children = qx.core.Init.getApplication().getRoot().getChildren();
      children.forEach(child => {
        const isWindow = "modal" in qx.util.PropertyUtil.getAllProperties(child.constructor);
        if (isWindow) {
          // Do not call .close(), it will trigger the close signal and it might not be handled correctly
          child.hide();
          child.dispose();
        }
      });
    },

    removeAllChildren: function(container) {
      const nChildren = container.getChildren().length;
      for (let i=nChildren-1; i>=0; i--) {
        container.remove(container.getChildren()[i]);
      }
    }
  }
});
