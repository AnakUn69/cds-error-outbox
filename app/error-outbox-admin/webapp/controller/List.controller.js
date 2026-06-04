sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel",
  "error/outbox/admin/model/Formatter"
], function (Controller, Filter, FilterOperator, MessageBox, MessageToast, JSONModel, Formatter) {
  "use strict";

  return Controller.extend("error.outbox.admin.controller.List", {
    formatter: Formatter,

    onInit: function () {
      this._sStatusFilter = "all";
      this._sSearchQuery  = "";

      // stats model for KPI tiles + charts
      this.getView().setModel(new JSONModel({
        total: 0, pending: 0, sent: 0,
        pieData: [],
        barData: []
      }), "stats");

      var oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("list").attachPatternMatched(this._onListMatched, this);
    },

    // ── Routing ──────────────────────────────────────────────────────────────

    _onListMatched: function () {
      this._refreshTable();
      // also hook initial data load (before first refresh)
      var oBinding = this.byId("errorsList").getBinding("items");
      if (oBinding) {
        oBinding.attachEventOnce("dataReceived", this._computeStats, this);
      }
    },

    // ── Stats ───────────────────────────────────────────────────

    _computeStats: function () {
      var oBinding = this.byId("errorsList").getBinding("items");
      if (!oBinding) { return; }
      var aCtx = oBinding.getContexts(0, oBinding.getLength());
      var iTotal   = aCtx.length;
      var iPending = 0;
      var iSent    = 0;
      var mSvc     = {};

      aCtx.forEach(function (oCtx) {
        var bSent = oCtx.getProperty("sent");
        if (bSent) { iSent++; } else { iPending++; }
        var sSvc = oCtx.getProperty("service") || "Unknown";
        var iCount = oCtx.getProperty("count") || 1;
        mSvc[sSvc] = (mSvc[sSvc] || 0) + iCount;
      });

      var aBarData = Object.keys(mSvc)
        .map(function (s) { return { service: s, count: mSvc[s] }; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 6);

      var maxCount = aBarData.length ? aBarData[0].count : 1;
      aBarData.forEach(function (d) { d.stats_pct = Math.round(d.count / maxCount * 100); });

      var iSentPct = iTotal > 0 ? Math.round(iSent / iTotal * 100) : 0;

      this.getView().getModel("stats").setData({
        total:        iTotal,
        pending:      iPending,
        sent:         iSent,
        sentPct:      iSentPct,
        sentPctLabel: iSentPct + "% sent",
        pieData: [
          { status: "Pending", count: iPending },
          { status: "Sent",    count: iSent    }
        ],
        barData: aBarData
      });
    },

    // ── Data ─────────────────────────────────────────────────────────────────

    _refreshTable: function () {
      var oBinding = this.byId("errorsList").getBinding("items");
      if (oBinding) {
        oBinding.refresh();
        oBinding.attachEventOnce("dataReceived", this._computeStats, this);
      }
    },

    _applyFilters: function () {
      var oBinding = this.byId("errorsList").getBinding("items");
      if (!oBinding) { return; }

      var aFilters = [];

      if (this._sSearchQuery) {
        aFilters.push(new Filter({
          filters: [
            new Filter("service", FilterOperator.Contains, this._sSearchQuery),
            new Filter("action",  FilterOperator.Contains, this._sSearchQuery),
            new Filter("message", FilterOperator.Contains, this._sSearchQuery)
          ],
          and: false
        }));
      }

      if (this._sStatusFilter === "pending") {
        aFilters.push(new Filter("sent", FilterOperator.EQ, false));
      } else if (this._sStatusFilter === "sent") {
        aFilters.push(new Filter("sent", FilterOperator.EQ, true));
      }

      oBinding.filter(aFilters);

      // Update count label after filter
      oBinding.attachEventOnce("dataReceived", function () {
        var iCount = oBinding.getLength();
        this.byId("countText").setText(iCount !== undefined ? iCount + " item(s)" : "");
      }.bind(this));
    },

    // ── Search / filter ───────────────────────────────────────────────────────

    onSearch: function (oEvent) {
      this._sSearchQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
      this._applyFilters();
    },

    onStatusFilter: function (oEvent) {
      this._sStatusFilter = oEvent.getParameter("item").getKey();
      this._applyFilters();
    },

    // ── Selection ─────────────────────────────────────────────────────────────

    onSelectionChange: function () {
      var iSelected = this.byId("errorsList").getSelectedItems().length;
      this.byId("btnAcknowledge").setEnabled(iSelected > 0);
      this.byId("btnDelete").setEnabled(iSelected > 0);
    },

    // ── Row expand / collapse ─────────────────────────────────────────────────

    onItemPress: function (oEvent) {
      var oItem    = oEvent.getSource();                   // CustomListItem
      var oWrapper = oItem.getContent()[0];                // outer VBox
      var oRow     = oWrapper.getItems()[0];               // FlexBox.eoListRow
      var oDetail  = oWrapper.getItems()[1];               // VBox.eoListDetail
      var bExpanded = oDetail.getVisible();
      oDetail.setVisible(!bExpanded);

      // Rotate chevron icon (last item in row FlexBox — a VBox wrapper)
      var aItems    = oRow.getItems();
      var oWrapper  = aItems[aItems.length - 1];            // VBox.eoExpandIconWrapper
      var oChevron  = oWrapper && oWrapper.getItems ? oWrapper.getItems()[0] : null;
      if (oChevron && oChevron.addStyleClass) {
        if (bExpanded) {
          oChevron.removeStyleClass("expanded");
        } else {
          oChevron.addStyleClass("expanded");
        }
      }
    },

    onAcknowledgeSingle: function (oEvent) {
      var oCtx   = oEvent.getSource().getBindingContext();
      var oModel = this.getView().getModel();
      oModel.bindContext("ErrorOutboxAdminService.acknowledge(...)", oCtx).execute()
        .then(function () {
          this._showMsg("Success", "Error acknowledged.");
          this._refreshTable();
        }.bind(this))
        .catch(function (oErr) {
          MessageBox.error("Acknowledge failed:\n" + (oErr.message || oErr));
        });
    },

    onDeleteSingle: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext();
      MessageBox.confirm("Delete this error?", {
        title: "Confirm Delete",
        emphasizedAction: MessageBox.Action.OK,
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) { return; }
          oCtx.delete("$auto")
            .then(function () {
              this._showMsg("Success", "Error deleted.");
            }.bind(this))
            .catch(function (oErr) {
              MessageBox.error("Delete failed:\n" + (oErr.message || oErr));
            });
        }.bind(this)
      });
    },

    onOpenDetail: function (oEvent) {
      var sId = oEvent.getSource().getBindingContext().getProperty("ID");
      this.getOwnerComponent().getRouter().navTo("detail", { id: sId });
    },

    // ── Actions ───────────────────────────────────────────────────────────────

    onAcknowledge: function () {
      var oList     = this.byId("errorsList");
      var aSelected = oList.getSelectedItems();
      if (!aSelected.length) { return; }

      var oModel    = this.getView().getModel();
      var aPromises = aSelected.map(function (oItem) {
        var oCtx = oItem.getBindingContext();
        return oModel.bindContext("ErrorOutboxAdminService.acknowledge(...)", oCtx).execute();
      });

      Promise.all(aPromises)
        .then(function () {
          this._showMsg("Success", aSelected.length + " error(s) acknowledged.");
          oList.removeSelections(true);
          this.onSelectionChange();
          this._refreshTable();
        }.bind(this))
        .catch(function (oErr) {
          MessageBox.error("Acknowledge failed:\n" + (oErr.message || oErr));
        });
    },

    onDelete: function () {
      var oList     = this.byId("errorsList");
      var aSelected = oList.getSelectedItems();
      if (!aSelected.length) { return; }

      MessageBox.confirm("Delete " + aSelected.length + " selected error(s)?", {
        title: "Confirm Delete",
        emphasizedAction: MessageBox.Action.OK,
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) { return; }
          var aPromises = aSelected.map(function (oItem) {
            return oItem.getBindingContext().delete("$auto");
          });
          Promise.all(aPromises)
            .then(function () {
              this._showMsg("Success", aSelected.length + " error(s) deleted.");
              this.onSelectionChange();
            }.bind(this))
            .catch(function (oErr) {
              MessageBox.error("Delete failed:\n" + (oErr.message || oErr));
            });
        }.bind(this)
      });
    },

    onPurgeSent: function () {
      MessageBox.confirm("Delete all sent / acknowledged errors?", {
        title: "Purge Sent Errors",
        emphasizedAction: MessageBox.Action.OK,
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) { return; }
          var oModel = this.getView().getModel();
          var oOp    = oModel.bindContext("/purgeSent(...)");
          oOp.execute()
            .then(function () {
              var sMsg = oOp.getBoundContext().getProperty("value") || "Sent errors purged.";
              this._showMsg("Success", sMsg);
              this._refreshTable();
            }.bind(this))
            .catch(function (oErr) {
              MessageBox.error("Purge failed:\n" + (oErr.message || oErr));
            });
        }.bind(this)
      });
    },

    onRefresh: function () {
      this._refreshTable();
      MessageToast.show("Refreshed.");
    },

    // ── Helpers ───────────────────────────────────────────────────────────────

    _showMsg: function (sType, sText) {
      var oStrip = this.byId("msgStrip");
      oStrip.setType(sType);
      oStrip.setText(sText);
      oStrip.setVisible(true);
    }
  });
});
