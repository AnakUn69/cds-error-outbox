'use strict';

/**
 * Mock email provider — logs to console only.
 * No external calls are made.
 *
 * Use this in development and test environments to verify the plugin
 * is capturing and formatting errors without needing real mail credentials.
 *
 * By default (markSent = false) the mock throws after logging so the
 * scheduler does NOT mark records as sent=true.  This keeps errors visible
 * as "Pending" in the admin UI until they are manually acknowledged.
 * Set mailConfig.mockMarkSent = true to simulate a successful delivery.
 *
 * @param {object} mailConfig
 * @param {string} subject
 * @param {string} html
 */
async function send(mailConfig, subject, html) {
  console.log('[cds-error-outbox][mock] ──────────── Email (mock) ────────────');
  console.log(`[cds-error-outbox][mock]  From      : ${mailConfig.from       || '(not configured)'}`);
  console.log(`[cds-error-outbox][mock]  To        : ${mailConfig.to         || '(not configured)'}`);
  console.log(`[cds-error-outbox][mock]  Subject   : ${subject}`);
  console.log(`[cds-error-outbox][mock]  Importance: ${mailConfig.importance || 'normal'}`);
  console.log(`[cds-error-outbox][mock]  HTML      : ${html ? html.length : 0} chars`);
  console.log('[cds-error-outbox][mock] ─────────────────────────────────────');

  if (!mailConfig.mockMarkSent) {
    throw new Error('[mock] Delivery simulated — records kept as Pending (set mockMarkSent: true to mark as sent)');
  }
}

module.exports = { send };
