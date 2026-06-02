'use strict';

const cds = require('@sap/cds');
const { formatHtmlEmail } = require('./formatter');

const ENTITY = 'error.outbox.Errors';

let _handle = null;

/**
 * Start the interval-based batch scheduler.
 *
 * @param {object} config   - merged plugin config
 * @param {object} provider - email provider instance ({ send: Function })
 * @returns {NodeJS.Timeout} interval handle (can be passed to stop())
 */
function start(config, provider) {
  if (_handle) {
    clearInterval(_handle);
    _handle = null;
  }

  _handle = setInterval(() => {
    runBatch(config, provider).catch((err) => {
      // runBatch already guards internally; this is a last-resort safety net.
      console.error('[cds-error-outbox] Unhandled error in runBatch:', err.message);
    });
  }, config.interval);

  // Allow Node.js process to exit gracefully even if the interval is active.
  if (typeof _handle.unref === 'function') _handle.unref();

  console.info(
    `[cds-error-outbox] Scheduler started — ` +
    `interval: ${config.interval}ms, batchSize: ${config.batchSize}`
  );

  return _handle;
}

/**
 * Stop the scheduler. Safe to call even if not started.
 */
function stop() {
  if (_handle) {
    clearInterval(_handle);
    _handle = null;
    console.info('[cds-error-outbox] Scheduler stopped.');
  }
}

/**
 * Core batch routine:
 *   1. Fetch unsent errors from DB (up to batchSize, oldest first).
 *   2. Format them into an HTML email.
 *   3. Send via the configured email provider.
 *   4. Mark successfully sent records as sent=true.
 *
 * Each step is independently guarded so a failure in one step does not
 * prevent the scheduler from running again on the next interval.
 *
 * @param {object} config
 * @param {object} provider
 */
async function runBatch(config, provider) {
  // ── 1. Obtain DB connection ──────────────────────────────────────────────
  let db;
  try {
    db = await cds.connect.to('db');
  } catch (err) {
    console.error('[cds-error-outbox] Cannot connect to DB — skipping batch:', err.message);
    return;
  }

  // ── 2. Fetch unsent errors ───────────────────────────────────────────────
  let errors;
  try {
    errors = await db.run(
      SELECT.from(ENTITY)
        .where({ sent: false })
        .orderBy('lastSeen asc')
        .limit(config.batchSize)
    );
  } catch (err) {
    console.error('[cds-error-outbox] Failed to query unsent errors:', err.message);
    return;
  }

  if (!errors || errors.length === 0) return;

  // ── 3. Format email ──────────────────────────────────────────────────────
  let subject, html;
  try {
    ({ subject, html } = formatHtmlEmail(errors));
  } catch (err) {
    console.error('[cds-error-outbox] Failed to format email body:', err.message);
    return;
  }

  // ── 4. Send email ────────────────────────────────────────────────────────
  try {
    await provider.send(config.mail, subject, html);
  } catch (err) {
    // Do NOT mark as sent — will be retried on the next interval.
    console.error(
      `[cds-error-outbox] Email delivery failed (will retry on next interval): ${err.message}`
    );
    return;
  }

  // ── 5. Mark as sent (only after confirmed delivery) ──────────────────────
  const ids = errors.map((e) => e.ID);
  try {
    await db.run(
      UPDATE(ENTITY)
        .set({ sent: true })
        .where({ ID: { in: ids } })
    );
    console.info(`[cds-error-outbox] Batch complete — marked ${ids.length} error(s) as sent.`);
  } catch (err) {
    console.error('[cds-error-outbox] Failed to mark errors as sent:', err.message);
  }
}

module.exports = { start, stop, runBatch };
