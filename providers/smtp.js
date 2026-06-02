'use strict';

/**
 * SMTP email provider using nodemailer.
 *
 * nodemailer is an optional peer dependency — install it separately:
 *   npm install nodemailer
 *
 * Required config under mail.smtp:
 *   host, port, secure, auth.user, auth.pass
 *
 * @param {object} mailConfig
 * @param {string} subject
 * @param {string} html
 */
async function send(mailConfig, subject, html) {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (_) {
    throw new Error(
      '[cds-error-outbox][smtp] nodemailer is not installed. ' +
      'Run: npm install nodemailer'
    );
  }

  const { from, to, smtp } = mailConfig;

  if (!from || !to) {
    throw new Error(
      '[cds-error-outbox][smtp] mail.from and mail.to must be configured.'
    );
  }

  if (!smtp || !smtp.host) {
    throw new Error(
      '[cds-error-outbox][smtp] mail.smtp.host must be configured for the SMTP provider.'
    );
  }

  const transportOptions = {
    host:   smtp.host,
    port:   smtp.port   !== undefined ? smtp.port   : 587,
    secure: smtp.secure !== undefined ? smtp.secure : false
  };

  // Only set auth if credentials are provided (some internal SMTP relays don't require auth)
  if (smtp.auth && smtp.auth.user) {
    transportOptions.auth = {
      user: smtp.auth.user,
      pass: smtp.auth.pass
    };
  }

  const transporter = nodemailer.createTransport(transportOptions);

  // Normalise comma-separated recipients
  const toAddresses = String(to)
    .split(',')
    .map((a) => a.trim())
    .join(', ');

  await transporter.sendMail({
    from,
    to: toAddresses,
    subject,
    html
  });
}

module.exports = { send };
