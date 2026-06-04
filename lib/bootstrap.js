'use strict';

const cds = require('@sap/cds');
const { loadConfig } = require('./config');
const { attach }     = require('./interceptor');
const { start }      = require('./scheduler');
const { getProvider } = require('../providers');

// Name of the built-in admin service — excluded from error interception to
// prevent capturing its own OData errors in an infinite-loop fashion.
const ADMIN_SERVICE_NAME = 'ErrorOutboxAdminService';

/**
 * Initialize the cds-error-outbox plugin.
 *
 * Called once at plugin load time (from index.js).
 * Uses CAP lifecycle events to ensure initialization order:
 *
 *   cds.on('serving') → attach error interceptor to each served service
 *   cds.on('served')  → start scheduler (DB is fully connected at this point)
 */
function initialize() {
  // ── Load and validate config ─────────────────────────────────────────────
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error('[cds-error-outbox] Failed to load config — plugin disabled:', err.message);
    return;
  }

  if (!config.enabled) {
    console.info('[cds-error-outbox] Plugin is disabled (config.enabled = false).');
    return;
  }

  // ── Resolve email provider ───────────────────────────────────────────────
  let provider;
  try {
    provider = getProvider(config);
  } catch (err) {
    console.error('[cds-error-outbox] Failed to load email provider — plugin disabled:', err.message);
    return;
  }

  // ── Attach interceptor to every served service ───────────────────────────
  // Skip the plugin's own admin service to avoid capturing its OData errors.
  cds.on('serving', (srv) => {
    if (srv.name === ADMIN_SERVICE_NAME) return;
    try {
      attach(srv, config);
    } catch (err) {
      console.error(
        `[cds-error-outbox] Failed to attach interceptor to service "${srv.name}":`,
        err.message
      );
    }
  });

  // ── Start scheduler after all services + DB are ready ───────────────────
  // cds.on('served') fires once after ALL services have been bootstrapped
  // and cds.db is guaranteed to be available.
  cds.on('served', () => {
    try {
      start(config, provider);
    } catch (err) {
      console.error('[cds-error-outbox] Failed to start scheduler:', err.message);
    }
  });

  console.info(
    `[cds-error-outbox] Plugin initialized — ` +
    `provider: ${config.mail.provider}, interval: ${config.interval}ms`
  );
}

module.exports = { initialize };
