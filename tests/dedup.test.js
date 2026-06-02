'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createHash, upsertError } = require('../lib/dedup');

// ── createHash ───────────────────────────────────────────────────────────────

describe('createHash', () => {
  it('returns a 64-character hex string', () => {
    const hash = createHash('err', 'svc', 'READ');
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('is deterministic — same inputs produce same hash', () => {
    const a = createHash('boom', 'TestService', 'READ');
    const b = createHash('boom', 'TestService', 'READ');
    assert.equal(a, b);
  });

  it('produces different hashes for different inputs', () => {
    const a = createHash('boom', 'TestService', 'READ');
    const b = createHash('boom', 'TestService', 'WRITE');
    assert.notEqual(a, b);
  });
});

// ── upsertError — DB mock helpers ────────────────────────────────────────────

function makeDb({ existing = null } = {}) {
  const ops = [];

  return {
    ops,
    run: async (query) => {
      ops.push(query);
      // SELECT returns existing record or empty
      if (query && query._SELECT) return existing ? [existing] : [];
      return {};
    }
  };
}

// CDS query builders produce objects with internal symbols — we use a thin shim
// so the tests don't depend on @sap/cds internals.
// We patch SELECT/INSERT/UPDATE on global before each group.

function installCdsGlobals() {
  const crypto = require('crypto');

  // Minimal SELECT shim
  global.SELECT = {
    from: (entity) => ({
      _SELECT: true,
      _entity: entity,
      where: function (c) { this._where = c; return this; },
      and: function (c, v) { this._and = [c, v]; return this; },
      limit: function (n) { this._limit = n; return this; }
    })
  };

  global.INSERT = {
    into: (entity) => ({
      entries: (data) => ({ _INSERT: true, _entity: entity, _data: data })
    })
  };

  global.UPDATE = (entity) => ({
    _UPDATE: true,
    _entity: entity,
    set: function (d) { this._set = d; return this; },
    where: function (c) { this._where = c; return this; }
  });
}

// ── upsertError — inserts ────────────────────────────────────────────────────

describe('upsertError — new error', () => {
  installCdsGlobals();

  const config = {
    dedup: { enabled: true, windowMinutes: 10 }
  };

  it('inserts a new record when no existing error is found', async () => {
    const db = makeDb({ existing: null });
    await upsertError(db, { message: 'boom', stack: 'at x', service: 'Svc', action: 'READ' }, config);

    const insert = db.ops.find(o => o._INSERT);
    assert.ok(insert, 'expected an INSERT operation');
    assert.equal(insert._data.message, 'boom');
    assert.equal(insert._data.service, 'Svc');
    assert.equal(insert._data.action, 'READ');
    assert.equal(insert._data.count, 1);
    assert.equal(insert._data.sent, false);
  });

  it('sets service/action to "unknown" when missing', async () => {
    const db = makeDb({ existing: null });
    await upsertError(db, { message: 'boom', stack: '' }, config);

    const insert = db.ops.find(o => o._INSERT);
    assert.equal(insert._data.service, 'unknown');
    assert.equal(insert._data.action, 'unknown');
  });

  it('truncates message to 5000 characters', async () => {
    const long = 'x'.repeat(6000);
    const db = makeDb({ existing: null });
    await upsertError(db, { message: long, stack: '', service: 'S', action: 'A' }, config);

    const insert = db.ops.find(o => o._INSERT);
    assert.equal(insert._data.message.length, 5000);
  });

  it('truncates stack to 10000 characters', async () => {
    const long = 'x'.repeat(12000);
    const db = makeDb({ existing: null });
    await upsertError(db, { message: 'err', stack: long, service: 'S', action: 'A' }, config);

    const insert = db.ops.find(o => o._INSERT);
    assert.equal(insert._data.stack.length, 10000);
  });

  it('inserts a new record when dedup is disabled (ignores existing)', async () => {
    const existing = { ID: 'abc', count: 3, hash: 'x' };
    const db = makeDb({ existing });
    const cfg = { dedup: { enabled: false, windowMinutes: 10 } };
    await upsertError(db, { message: 'boom', stack: '', service: 'S', action: 'A' }, cfg);

    const insert = db.ops.find(o => o._INSERT);
    assert.ok(insert, 'expected INSERT even when existing record present');
  });
});

// ── upsertError — updates (dedup) ────────────────────────────────────────────

describe('upsertError — dedup update', () => {
  installCdsGlobals();

  const config = {
    dedup: { enabled: true, windowMinutes: 10 }
  };

  it('updates count and lastSeen when a matching error exists', async () => {
    const existing = { ID: 'existing-id', count: 2, hash: 'somehash' };
    const db = makeDb({ existing });
    await upsertError(db, { message: 'boom', stack: '', service: 'S', action: 'A' }, config);

    const update = db.ops.find(o => o._UPDATE);
    assert.ok(update, 'expected an UPDATE operation');
    assert.equal(update._set.count, 3);
    assert.ok(update._set.lastSeen, 'lastSeen should be updated');
    assert.equal(update._where.ID, 'existing-id');
  });
});
