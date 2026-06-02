'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Load @sap/cds first — this installs SELECT/INSERT/UPDATE globals (read-only)
const cds = require('@sap/cds');

const { start, stop, runBatch } = require('../lib/scheduler');

// ── DB mock factory ───────────────────────────────────────────────────────────
// runBatch calls cds.connect.to('db') — we replace that with a fake that
// returns a controlled db object. The global SELECT/UPDATE are used by the
// production code, so we let them be; we only track what db.run receives.

function makeDb({ errors = [] } = {}) {
  const ops = [];
  const db = {
    ops,
    run: async (query) => {
      // Detect SELECT vs UPDATE by inspecting the query object CAP builds.
      // A SELECT query has a .SELECT property; an UPDATE has .UPDATE.
      if (query && query.SELECT) return errors;
      ops.push(query);
      return {};
    }
  };
  return db;
}

function mockConnect(db) {
  // cds.connect is a read-only getter, but cds.connect.to is a regular property
  // we can replace on the existing object.
  const orig = cds.connect.to;
  cds.connect.to = async () => db;
  return () => { cds.connect.to = orig; }; // returns restore function
}

function mockConnectFail() {
  const orig = cds.connect.to;
  cds.connect.to = async () => { throw new Error('DB connection failed'); };
  return () => { cds.connect.to = orig; };
}

afterEach(() => {
  stop();
});

// ── start / stop ─────────────────────────────────────────────────────────────

describe('start / stop', () => {
  it('start returns a truthy handle', () => {
    const config = { interval: 60000, batchSize: 10 };
    const provider = { send: async () => {} };
    const handle = start(config, provider);
    assert.ok(handle, 'expected a truthy handle');
    stop();
  });

  it('stop does not throw when scheduler is not running', () => {
    stop();
    assert.doesNotThrow(() => stop());
  });

  it('calling start twice replaces the existing interval', () => {
    const config = { interval: 60000, batchSize: 10 };
    const provider = { send: async () => {} };
    const h1 = start(config, provider);
    const h2 = start(config, provider);
    assert.notEqual(h1, h2);
    stop();
  });
});

// ── runBatch — empty queue ────────────────────────────────────────────────────

describe('runBatch — empty queue', () => {
  it('does nothing when there are no unsent errors', async () => {
    const db = makeDb({ errors: [] });
    const restore = mockConnect(db);
    const provider = { send: async () => { throw new Error('should not be called'); } };
    const config = { batchSize: 10, mail: {} };
    try {
      await assert.doesNotReject(() => runBatch(config, provider));
      assert.equal(db.ops.length, 0, 'no UPDATE should occur');
    } finally { restore(); }
  });
});

// ── runBatch — successful send ────────────────────────────────────────────────

describe('runBatch — successful send', () => {
  it('calls provider.send and marks errors as sent', async () => {
    const now = new Date().toISOString();
    const errors = [
      { ID: 'id-1', service: 'S', action: 'A', message: 'boom', count: 1, sent: false, firstSeen: now, lastSeen: now },
      { ID: 'id-2', service: 'S', action: 'A', message: 'crash', count: 1, sent: false, firstSeen: now, lastSeen: now }
    ];
    const db = makeDb({ errors });
    const restore = mockConnect(db);

    let sendCalled = false;
    const provider = { send: async () => { sendCalled = true; } };
    const config = { batchSize: 10, mail: {} };
    try {
      await runBatch(config, provider);

      assert.ok(sendCalled, 'provider.send should have been called');
      assert.ok(db.ops.length > 0, 'expected UPDATE to mark errors as sent');
      const update = db.ops[0];
      assert.ok(update && update.UPDATE, 'expected an UPDATE query');
    } finally { restore(); }
  });
});

// ── runBatch — send failure ───────────────────────────────────────────────────

describe('runBatch — send failure', () => {
  it('does NOT mark errors as sent when provider.send throws', async () => {
    const now = new Date().toISOString();
    const errors = [
      { ID: 'id-1', service: 'S', action: 'A', message: 'boom', count: 1, sent: false, firstSeen: now, lastSeen: now }
    ];
    const db = makeDb({ errors });
    const restore = mockConnect(db);

    const provider = { send: async () => { throw new Error('SMTP timeout'); } };
    const config = { batchSize: 10, mail: {} };
    try {
      await runBatch(config, provider);
      assert.equal(db.ops.length, 0, 'errors must NOT be marked sent when send fails');
    } finally { restore(); }
  });
});

// ── runBatch — DB failure ─────────────────────────────────────────────────────

describe('runBatch — DB failure', () => {
  it('does not throw when DB connection fails', async () => {
    const restore = mockConnectFail();
    const provider = { send: async () => {} };
    const config = { batchSize: 10, mail: {} };
    try {
      await assert.doesNotReject(() => runBatch(config, provider));
    } finally { restore(); }
  });
});
