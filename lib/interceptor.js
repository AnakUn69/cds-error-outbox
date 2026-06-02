'use strict';

const cds = require('@sap/cds');
const { upsertError } = require('./dedup');

/**
 * Attach a fire-and-forget error interceptor to the given CDS service.
 * The handler never blocks or delays the request pipeline — errors are
 * persisted to the DB asynchronously via setImmediate.
 *
 * @param {object} srv    - CDS service instance
 * @param {object} config - merged plugin config
 */
function attach(srv, config) {
  // CAP's srv.handle() is the correct override point — it runs before/on/after
  // handlers and any error thrown there propagates out of handle().
  // dispatch() causes infinite recursion (it calls this.dispatch on sub-tx),
  // srv.on('*') never fires when a before-handler throws.
  // The CAP docs say: "Subclasses should overload handle instead of dispatch".
  const _handle = srv.handle.bind(srv);
  srv.handle = async function (req) {
    try {
      return await _handle(req);
    } catch (err) {
      // Persist asynchronously — never block or swallow the error.
      setImmediate(async () => {
        try {
          const message = (err && err.message) ? String(err.message) : String(err);
          const stack   = (err && err.stack)   ? String(err.stack)   : '';
          const service = srv.name || 'unknown';
          const action  =
            (req && req.event)  ? req.event  :
            (req && req.path)   ? req.path   :
            (req && req.method) ? req.method :
            'unknown';

          // cds.tx() opens a brand-new root-level transaction that is completely
          // independent of the failed request's already-rolled-back transaction.
          // Without this, CAP's AsyncLocalStorage would propagate the dead
          // transaction context into our INSERT/UPDATE, causing the
          // "Transaction is rolled back" error.
          await cds.tx(async (tx) => {
            await upsertError(tx, { message, stack, service, action }, config);
          });
        } catch (internalError) {
          // Never re-throw — log internally to avoid crashing the app.
          console.error(
            `[cds-error-outbox] Failed to persist error from service "${srv.name}":`,
            internalError.message
          );
        }
      });

      throw err; // re-throw so CAP still sends the error response to the client
    }
  };
}

module.exports = { attach };
