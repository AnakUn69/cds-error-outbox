sap.ui.define([], function () {
  "use strict";

  return {
    /**
     * Formats an ISO 8601 date string (OData V4) to a locale-aware string.
     */
    formatDate: function (sValue) {
      if (!sValue) { return ""; }
      try {
        var oDate = new Date(sValue);
        if (isNaN(oDate.getTime())) { return sValue; }
        return oDate.toLocaleString(undefined, {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit"
        });
      } catch (e) {
        return sValue;
      }
    },

    sentStatus: function (vSent) {
      return vSent === true || vSent === "true" || vSent === 1 ? "Sent" : "Pending";
    },

    sentState: function (vSent) {
      return vSent === true || vSent === "true" || vSent === 1 ? "Success" : "Warning";
    },

    rowHighlight: function (vSent) {
      return vSent === true || vSent === "true" || vSent === 1 ? "None" : "Warning";
    },

    notSent: function (vSent) {
      return !(vSent === true || vSent === "true" || vSent === 1);
    },

    sentMessage: function (vSent) {
      return vSent === true || vSent === "true" || vSent === 1
        ? "This error has been acknowledged and sent."
        : "This error is pending \u2014 it has not yet been sent or acknowledged.";
    }
  };
});
