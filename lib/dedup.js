'use strict';

const crypto = require('crypto');

const ENTITY = 'error.outbox.Errors';

// Truncation limits to prevent oversized DB entries
const MAX_MESSAGE_LEN = 5000;
const MAX_STACK_LEN = 10000;

/**
 * Creates a deterministic SHA-256 hash from the error's message, service, and action.
 * Used as the dedup key.
 *
 * @param {string} message
 * @param {string} service
 * @param {string} action
 * @returns {string} 64-character hex string
 */
function createHash(message, service, action) {
  return crypto
    .createHash('sha256')
    .update(`${message}|${service}|${action}`)
    .digest('hex');
}

/**
 * Find an existing unsent error record matching the given hash within the dedup window.
 *
 * @param {object} db  - connected cds.db instance
 * @param {string} hash
 * @param {number} windowMinutes
 * @returns {Promise<object|null>}
 */
async function findExistingError(db, hash, windowMinutes) {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const results = await db.run(
    SELECT.from(ENTITY)
      .where({ hash })
      .and('lastSeen >', cutoff)
      .and({ sent: false })
      .limit(1)
  );

  return results && results.length > 0 ? results[0] : null;
}

/**
 * Insert a new error row or increment the count on an existing one.
 * Deduplication is based on the hash + dedup window + sent=false.
 *
 * @param {object} db      - connected cds.db instance
 * @param {object} errorData - { message, stack, service, action }
 * @param {object} config  - merged plugin config
 */
async function upsertError(db, errorData, config) {
  const { message, stack, service, action } = errorData;

  const hash = createHash(message, service, action);
  const now = new Date().toISOString();

  const existing = config.dedup.enabled
    ? await findExistingError(db, hash, config.dedup.windowMinutes)
    : null;

  if (existing) {
    await db.run(
      UPDATE(ENTITY)
        .set({ count: existing.count + 1, lastSeen: now })
        .where({ ID: existing.ID })
    );
  } else {
    await db.run(
      INSERT.into(ENTITY).entries({
        ID: crypto.randomUUID(),
        hash,
        service: String(service || 'unknown'),
        action: String(action || 'unknown'),
        message: message ? String(message).substring(0, MAX_MESSAGE_LEN) : '',
        stack: stack ? String(stack).substring(0, MAX_STACK_LEN) : '',
        count: 1,
        firstSeen: now,
        lastSeen: now,
        sent: false
      })
    );
  }
}

module.exports = { createHash, findExistingError, upsertError };
