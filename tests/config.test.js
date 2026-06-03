'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Mock cds before requiring config
const cds = require('@sap/cds');

const { deepMerge, loadConfig, resetConfig } = require('../lib/config');

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 99, c: 3 });
    assert.deepEqual(result, { a: 1, b: 99, c: 3 });
  });

  it('merges nested objects recursively', () => {
    const result = deepMerge(
      { mail: { provider: 'mock', port: 587 } },
      { mail: { provider: 'smtp' } }
    );
    assert.deepEqual(result, { mail: { provider: 'smtp', port: 587 } });
  });

  it('replaces arrays (no element-wise merge)', () => {
    const result = deepMerge({ arr: [1, 2, 3] }, { arr: [4, 5] });
    assert.deepEqual(result, { arr: [4, 5] });
  });

  it('returns target unchanged when source is null', () => {
    const target = { a: 1 };
    const result = deepMerge(target, null);
    assert.deepEqual(result, { a: 1 });
  });

  it('returns target unchanged when source is undefined', () => {
    const target = { a: 1 };
    const result = deepMerge(target, undefined);
    assert.deepEqual(result, { a: 1 });
  });

  it('does not mutate the original target', () => {
    const target = { a: 1 };
    deepMerge(target, { a: 2 });
    assert.equal(target.a, 1);
  });
});

describe('loadConfig / resetConfig', () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
    // Clean up any cds.env overrides
    if (cds.env.requires) delete cds.env.requires.errorOutbox;
  });

  it('returns defaults when no user config is set', () => {
    const config = loadConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.interval, 300000);
    assert.equal(config.batchSize, 50);
    assert.equal(config.dedup.enabled, true);
    assert.equal(config.dedup.windowMinutes, 10);
    assert.equal(config.mail.provider, 'mock');
    assert.equal(config.mail.importance, 'normal');
    assert.ok(config.mail.subject.includes('{count}'), 'default subject template should contain {count}');
    assert.ok(config.mail.subject.includes('{errors}'), 'default subject template should contain {errors}');
    assert.ok(config.mail.subject.includes('{timestamp}'), 'default subject template should contain {timestamp}');
  });

  it('overrides defaults with user config', () => {
    cds.env.requires = cds.env.requires || {};
    cds.env.requires.errorOutbox = { interval: 60000, mail: { provider: 'smtp' } };
    const config = loadConfig();
    assert.equal(config.interval, 60000);
    assert.equal(config.mail.provider, 'smtp');
    // Defaults for untouched keys remain
    assert.equal(config.batchSize, 50);
  });

  it('caches the result — second call returns same object', () => {
    const a = loadConfig();
    const b = loadConfig();
    assert.equal(a, b);
  });

  it('resetConfig causes loadConfig to return a new instance', () => {
    const a = loadConfig();
    resetConfig();
    const b = loadConfig();
    assert.notEqual(a, b);
  });
});
