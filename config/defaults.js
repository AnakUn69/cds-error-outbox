'use strict';

module.exports = {
  enabled: true,

  /** How often (ms) the batch job runs to send unsent errors. */
  interval: 300000,

  /** Maximum number of unsent errors to include per email batch. */
  batchSize: 50,

  dedup: {
    /** Whether to deduplicate errors by hash within the rolling window. */
    enabled: true,

    /** Only deduplicate within this time window (minutes). */
    windowMinutes: 10
  },

  retention: {
    /**
     * Automatically delete sent error records older than this many days.
     * Set to 0 to disable automatic cleanup.
     */
    days: 30
  },

  /**
   * Whether to serve the built-in Fiori admin UI at /error-outbox-admin/.
   * Set to false to disable the static route entirely.
   */
  adminUi: true,

  mail: {
    /** Email provider: 'o365' | 'smtp' | 'mock' */
    provider: 'mock',

    /** Sender address (required for o365 and smtp). */
    from: '',

    /** Recipient address(es) — comma-separated for multiple (required for o365 and smtp). */
    to: '',

    /**
     * Email subject template. Supported placeholders:
     *   {count}     — total number of error occurrences in the batch
     *   {errors}    — number of distinct error records in the batch
     *   {timestamp} — ISO 8601 timestamp of the batch run
     */
    subject: '[CAP Error Outbox] {count} occurrence(s) in {errors} error(s) — {timestamp}',

    /**
     * Email importance / priority.
     * Accepted values: 'low' | 'normal' | 'high'
     * Maps to:  Graph API → message.importance
     *           SMTP      → nodemailer priority field
     */
    importance: 'normal',

    /** === O365 / Microsoft Graph API options === */
    tenantId: '',
    clientId: '',
    clientSecret: '',

    /** === SMTP options (used only when provider = 'smtp') === */
    smtp: {
      host: '',
      port: 587,
      secure: false,
      auth: {
        user: '',
        pass: ''
      }
    }
  }
};
