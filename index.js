'use strict';

/**
 * cds-error-outbox — CAP plugin entry point.
 *
 * CAP automatically requires this file when the package is installed,
 * because package.json declares `"cds": { "plugin": true }`.
 *
 * The bootstrap.initialize() call registers CAP lifecycle listeners
 * (cds.on('serving') and cds.on('served')) so no blocking work happens here.
 *
 * Static admin UI is registered here at module level — outside initialize() —
 * so it is always available regardless of email provider config.
 */
const path = require('path');
const cds  = require('@sap/cds');
const { initialize } = require('./lib/bootstrap');

// Register the static admin UI — only if config.adminUi is not explicitly false.
// Use 'served' event because plugins load after 'bootstrap' has already fired;
// cds.app is guaranteed to exist by the time 'served' emits.
cds.on('served', () => {
  const { loadConfig } = require('./lib/config');
  let cfg;
  try { cfg = loadConfig(); } catch (_) { cfg = {}; }
  if (cfg.adminUi === false) return;

  const express   = require('express');
  const webappDir = path.join(__dirname, 'app', 'error-outbox-admin', 'webapp');
  cds.app.use('/error-outbox-admin', express.static(webappDir));
  console.info('[cds-error-outbox] Admin UI → /error-outbox-admin/index.html');
});

initialize();
