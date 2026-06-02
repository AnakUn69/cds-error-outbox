'use strict';

/**
 * cds-error-outbox — CAP plugin entry point.
 *
 * CAP automatically requires this file when the package is installed,
 * because package.json declares `"cds": { "plugin": true }`.
 *
 * The bootstrap.initialize() call registers CAP lifecycle listeners
 * (cds.on('serving') and cds.on('served')) so no blocking work happens here.
 */
const { initialize } = require('./lib/bootstrap');

initialize();
