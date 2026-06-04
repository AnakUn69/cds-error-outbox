'use strict';

const cds = require('@sap/cds');

const ENTITY = 'error.outbox.Errors';

module.exports = class ErrorOutboxAdminService extends cds.ApplicationService {

  async init() {

    // ── acknowledge (bound action on individual Errors record) ───────────────
    // Sets sent = true on the selected record, effectively silencing it.
    this.on('acknowledge', 'Errors', async (req) => {
      const { ID } = req.params[0];
      const db = await cds.connect.to('db');
      const affected = await db.run(
        UPDATE(ENTITY).set({ sent: true }).where({ ID })
      );
      if (!affected) return req.error(404, `Error record ${ID} not found.`);
      return req.reply();
    });

    // ── purgeSent (unbound action on service) ────────────────────────────────
    // Deletes all error records that have already been sent.
    this.on('purgeSent', async (req) => {
      const db = await cds.connect.to('db');
      const deleted = await db.run(
        DELETE.from(ENTITY).where({ sent: true })
      );
      const count = typeof deleted === 'number' ? deleted : 0;
      return `Deleted ${count} sent error record(s).`;
    });

    return super.init();
  }
};
