'use strict';

const cds = require('@sap/cds');
const defaults = require('../config/defaults');

let _config = null;

/**
 * Recursively deep-merge source into target.
 * Arrays in source replace arrays in target (no merge).
 *
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;

  const result = Object.assign({}, target);

  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = result[key];

    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else if (srcVal !== undefined) {
      result[key] = srcVal;
    }
  }

  return result;
}

/**
 * Load and cache the merged config (defaults + cds.env.requires.errorOutbox).
 * @returns {Object}
 */
function loadConfig() {
  if (_config) return _config;

  const userConfig =
    (cds.env &&
      cds.env.requires &&
      cds.env.requires.errorOutbox) ||
    {};

  _config = deepMerge(defaults, userConfig);
  return _config;
}

/**
 * Reset the cached config singleton.
 * Useful in tests to reload config between test cases.
 */
function resetConfig() {
  _config = null;
}

module.exports = { loadConfig, resetConfig, deepMerge };
