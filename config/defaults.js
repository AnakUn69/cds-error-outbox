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

  mail: {
    /** Email provider: 'o365' | 'smtp' | 'mock' */
    provider: 'mock',

    /** Sender address (required for o365 and smtp). */
    from: '',

    /** Recipient address(es) — comma-separated for multiple (required for o365 and smtp). */
    to: '',

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
