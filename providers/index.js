'use strict';

/**
 * Email provider factory.
 *
 * Returns a provider object with a `send(mailConfig, subject, html)` function
 * based on config.mail.provider. Falls back to 'mock' for unknown values.
 *
 * Supported providers:
 *   'o365'  — Microsoft Graph API (client credentials, no extra deps)
 *   'smtp'  — nodemailer (optional peer dep: npm install nodemailer)
 *   'mock'  — console.log only, safe for development/testing
 *
 * @param {object} config - merged plugin config
 * @returns {{ send: Function }}
 */
function getProvider(config) {
  const providerName = (config.mail && config.mail.provider)
    ? String(config.mail.provider).toLowerCase()
    : 'mock';

  switch (providerName) {
    case 'o365':
      return require('./o365');

    case 'smtp':
      return require('./smtp');

    case 'mock':
      return require('./mock');

    default:
      console.warn(
        `[cds-error-outbox] Unknown email provider "${providerName}". Falling back to mock.`
      );
      return require('./mock');
  }
}

module.exports = { getProvider };
