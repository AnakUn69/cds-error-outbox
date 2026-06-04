sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "error/outbox/admin/model/Formatter"
], function (Controller, MessageBox, MessageToast, Formatter) {
  "use strict";

  return Controller.extend("error.outbox.admin.controller.Detail", {
    formatter: Formatter,

    onInit: function () {
      var oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("detail").attachPatternMatched(this._onDetailMatched, this);
    },

    // ── Routing ───────────────────────────────────────────────────────────────

    _onDetailMatched: function (oEvent) {
      var sId = oEvent.getParameter("arguments").id;
      this.getView().bindElement({
        path: "/Errors(ID=" + sId + ")",
        parameters: {
          $select: "ID,service,action,message,count,firstSeen,lastSeen,sent,stack,hash"
        }
      });
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("list");
    },

    // ── Actions ───────────────────────────────────────────────────────────────

    onAcknowledge: function () {
      var oCtx = this.getView().getBindingContext();
      if (!oCtx) { return; }

      var oModel = this.getView().getModel();
      var oOp    = oModel.bindContext("ErrorOutboxAdminService.acknowledge(...)", oCtx);
      oOp.execute()
        .then(function () {
          MessageToast.show("Error acknowledged.");
          oCtx.refresh();
        })
        .catch(function (oErr) {
          MessageBox.error("Acknowledge failed:\n" + (oErr.message || oErr));
        });
    },

    onDelete: function () {
      var oCtx = this.getView().getBindingContext();
      if (!oCtx) { return; }

      MessageBox.confirm("Delete this error record?", {
        title: "Confirm Delete",
        emphasizedAction: MessageBox.Action.OK,
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) { return; }
          oCtx.delete("$auto")
            .then(function () {
              MessageToast.show("Error deleted.");
              this.getOwnerComponent().getRouter().navTo("list");
            }.bind(this))
            .catch(function (oErr) {
              MessageBox.error("Delete failed:\n" + (oErr.message || oErr));
            });
        }.bind(this)
      });
    }
  });
});
