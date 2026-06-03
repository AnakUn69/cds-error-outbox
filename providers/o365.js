'use strict';

const https    = require('https');
const qs       = require('querystring');

/**
 * Obtain an OAuth 2.0 access token using the client credentials grant.
 * Endpoint: POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
 *
 * @param {object} mailConfig - { tenantId, clientId, clientSecret }
 * @returns {Promise<string>} Bearer access token
 */
function getAccessToken(mailConfig) {
  // Values from config take precedence; env variables are the fallback.
  // Supported env variables:
  //   CDS_REQUIRES_ERROROUTBOX_MAIL_TENANTID
  //   CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTID
  //   CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTSECRET
  const tenantId     = mailConfig.tenantId     || process.env.CDS_REQUIRES_ERROROUTBOX_MAIL_TENANTID     || process.env.ERROR_OUTBOX_TENANT_ID;
  const clientId     = mailConfig.clientId     || process.env.CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTID     || process.env.ERROR_OUTBOX_CLIENT_ID;
  const clientSecret = mailConfig.clientSecret || process.env.CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTSECRET || process.env.ERROR_OUTBOX_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return Promise.reject(
      new Error(
        '[cds-error-outbox][o365] tenantId, clientId, and clientSecret are required. ' +
        'Set them in cds.requires.errorOutbox.mail or via env variables: ' +
        'CDS_REQUIRES_ERROROUTBOX_MAIL_TENANTID, CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTID, CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTSECRET'
      )
    );
  }

  const body = qs.stringify({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         'https://graph.microsoft.com/.default'
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'login.microsoftonline.com',
      path:     `/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            resolve(parsed.access_token);
          } else {
            reject(
              new Error(
                `[cds-error-outbox][o365] Token request failed: ` +
                (parsed.error_description || parsed.error || `HTTP ${res.statusCode}`)
              )
            );
          }
        } catch (e) {
          reject(new Error(`[cds-error-outbox][o365] Failed to parse token response: ${e.message}`));
        }
      });
    });

    req.on('error', (err) =>
      reject(new Error(`[cds-error-outbox][o365] Token HTTPS request error: ${err.message}`))
    );

    req.write(body);
    req.end();
  });
}

/**
 * Send an email via Microsoft Graph API (POST /users/{from}/sendMail).
 *
 * Required Azure AD app permission: Mail.Send (application, not delegated).
 * The `from` address must be a licensed Exchange Online mailbox.
 *
 * @param {object} mailConfig - { tenantId, clientId, clientSecret, from, to }
 * @param {string} subject
 * @param {string} html
 */
async function send(mailConfig, subject, html) {
  const from = mailConfig.from || process.env.CDS_REQUIRES_ERROROUTBOX_MAIL_FROM || process.env.ERROR_OUTBOX_FROM;
  const to   = mailConfig.to   || process.env.CDS_REQUIRES_ERROROUTBOX_MAIL_TO   || process.env.ERROR_OUTBOX_TO;

  if (!from || !to) {
    throw new Error(
      '[cds-error-outbox][o365] mail.from and mail.to are required. ' +
      'Set them in cds.requires.errorOutbox.mail or via env variables: ' +
      'CDS_REQUIRES_ERROROUTBOX_MAIL_FROM, CDS_REQUIRES_ERROROUTBOX_MAIL_TO'
    );
  }

  const accessToken = await getAccessToken(mailConfig);

  // Support comma-separated recipient list
  const toRecipients = String(to)
    .split(',')
    .map((addr) => ({ emailAddress: { address: addr.trim() } }));

  const VALID_IMPORTANCE = ['low', 'normal', 'high'];
  const rawImportance = mailConfig.importance ? String(mailConfig.importance).toLowerCase() : 'normal';
  const importance = VALID_IMPORTANCE.includes(rawImportance) ? rawImportance : 'normal';
  if (!VALID_IMPORTANCE.includes(rawImportance)) {
    console.warn(
      `[cds-error-outbox][o365] Unknown importance value "${mailConfig.importance}" — falling back to "normal". ` +
      'Accepted values: low | normal | high'
    );
  }

  const payload = JSON.stringify({
    message: {
      subject,
      importance,
      body: {
        contentType: 'HTML',
        content: html
      },
      from: {
        emailAddress: { address: from }
      },
      toRecipients
    },
    saveToSentItems: false
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.microsoft.com',
      path:     `/v1.0/users/${encodeURIComponent(from)}/sendMail`,
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Graph API returns 202 Accepted on success (no body)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(
            new Error(
              `[cds-error-outbox][o365] sendMail failed — HTTP ${res.statusCode}: ${data}`
            )
          );
        }
      });
    });

    req.on('error', (err) =>
      reject(new Error(`[cds-error-outbox][o365] sendMail HTTPS request error: ${err.message}`))
    );

    req.write(payload);
    req.end();
  });
}

module.exports = { send, getAccessToken };
