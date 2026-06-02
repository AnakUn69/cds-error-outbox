# cds-error-outbox

A production-ready, reusable **SAP CAP** (Node.js) plugin that automatically captures service errors, deduplicates them, and sends batched HTML email notifications — with **zero production dependencies**.

---

## Features

- Hooks into **all CAP services** via `srv.on('error')` — zero manual wiring required
- Stores errors in a CDS-managed `error.outbox.Errors` DB entity (auto-deployed)
- **Deduplicates** by `SHA-256(message + service + action)` — increments count instead of creating duplicate rows
- Sends **batched HTML email reports** on a configurable interval
- Pluggable email providers: **O365 (Microsoft Graph API)**, **SMTP (nodemailer)**, **Mock (dev/test)**
- Fully configurable via `cds.env.requires.errorOutbox`
- **Non-blocking** — error capture is fire-and-forget; the request pipeline is never delayed
- Never crashes the application — all internal failures are logged and swallowed

---

## Installation

```bash
npm install cds-error-outbox
```

Because `package.json` declares `"cds": { "plugin": true }`, CAP automatically loads `index.js` at startup.

> **Important:** Due to how CAP resolves symlinked local packages, you must explicitly require the plugin in your project's `srv/server.js` (or root `server.js`):
>
> ```js
> require('cds-error-outbox');  // ← add as the very first line
> // ... rest of your server.js
> ```

---

## Configuration

Add the following to your project's `package.json` under `cds.requires`, or to `.cdsrc.json`:

```json
{
  "cds": {
    "requires": {
      "errorOutbox": {
        "enabled": true,
        "interval": 300000,
        "batchSize": 50,
        "dedup": {
          "enabled": true,
          "windowMinutes": 10
        },
        "mail": {
          "provider": "o365",
          "tenantId": "<YOUR_TENANT_ID>",
          "clientId": "<YOUR_CLIENT_ID>",
          "clientSecret": "<YOUR_CLIENT_SECRET>",
          "from": "errors@yourcompany.com",
          "to": "devops@yourcompany.com"
        }
      }
    }
  }
}
```

### Configuration reference

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Enable/disable the entire plugin |
| `interval` | number (ms) | `300000` | Batch email job frequency |
| `batchSize` | number | `50` | Max errors per email batch |
| `dedup.enabled` | boolean | `true` | Enable hash-based deduplication |
| `dedup.windowMinutes` | number | `10` | Rolling dedup window in minutes |
| `mail.provider` | string | `'mock'` | `'o365'` \| `'smtp'` \| `'mock'` |
| `mail.from` | string | `''` | Sender address |
| `mail.to` | string | `''` | Recipient(s), comma-separated |
| `mail.tenantId` | string | `''` | Azure AD tenant ID (O365 only) |
| `mail.clientId` | string | `''` | Azure AD app client ID (O365 only) |
| `mail.clientSecret` | string | `''` | Azure AD app client secret (O365 only) |
| `mail.smtp.host` | string | `''` | SMTP host (SMTP only) |
| `mail.smtp.port` | number | `587` | SMTP port (SMTP only) |
| `mail.smtp.secure` | boolean | `false` | Use TLS (SMTP only) |
| `mail.smtp.auth.user` | string | `''` | SMTP username (SMTP only) |
| `mail.smtp.auth.pass` | string | `''` | SMTP password (SMTP only) |

---

## Email Providers

### `mock` _(default — development/testing)_

Logs the email subject and metadata to the console. No external calls. Use this during local development.

### `o365` — Microsoft Graph API

Uses the [Microsoft Graph `sendMail` API](https://learn.microsoft.com/en-us/graph/api/user-sendmail) with an OAuth 2.0 **client credentials** flow. No user login is required. Zero additional npm dependencies.

#### O365 Setup

1. Go to [Azure Portal → App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps) and click **New registration**
2. Note the **Application (client) ID** and **Directory (tenant) ID**
3. Go to **Certificates & Secrets** → **New client secret** — note the secret **Value** (shown once)
4. Go to **API Permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**
   - Add: `Mail.Send`
5. Click **Grant admin consent** for your organisation
6. The `mail.from` address must be a **licensed Exchange Online mailbox** that the app registration has permission to send from
7. Configure `cds.requires.errorOutbox.mail`:

```json
{
  "provider": "o365",
  "tenantId": "<Directory (tenant) ID>",
  "clientId": "<Application (client) ID>",
  "clientSecret": "<Client Secret value>",
  "from": "errors@yourcompany.com",
  "to": "devops@yourcompany.com"
}
```

> **Security:** Never commit `clientSecret` to source control.
>
> The O365 provider reads credentials from **env variables as a fallback** — values in `package.json` take priority, but any missing field is automatically picked up from the environment:
>
> ```bash
> export CDS_REQUIRES_ERROROUTBOX_MAIL_TENANTID="xxxx"
> export CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTID="xxxx"
> export CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTSECRET="xxxx"
> export CDS_REQUIRES_ERROROUTBOX_MAIL_FROM="errors@company.com"
> export CDS_REQUIRES_ERROROUTBOX_MAIL_TO="devops@company.com"
> ```
>
> On BTP / Cloud Foundry use `cf set-env <app> CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTSECRET "<value>"` instead of putting the secret in `manifest.yml`.

### `smtp`

Requires `nodemailer` (optional peer dependency):

```bash
npm install nodemailer
```

```json
{
  "provider": "smtp",
  "from": "errors@yourcompany.com",
  "to": "devops@yourcompany.com",
  "smtp": {
    "host": "smtp.yourcompany.com",
    "port": 587,
    "secure": false,
    "auth": { "user": "smtp-user", "pass": "smtp-password" }
  }
}
```

---

## How it works

```
CAP service throws an error
         │
         ▼
  srv.on('error') — fire-and-forget via setImmediate (non-blocking)
         │
         ▼
  SHA-256( message | service | action )
         │
    ┌────┴────┐
    │         │
duplicate?   new?
    │         │
    ▼         ▼
 UPDATE     INSERT
 count+1    count=1
 lastSeen   firstSeen/lastSeen
         │
         ▼
  setInterval every `interval` ms
         │
         ▼
  SELECT sent=false LIMIT batchSize   (oldest first)
         │
         ▼
  Format HTML (grouped by service)
         │
         ▼
  provider.send(...)
         │
         ▼ (only on success)
  UPDATE sent=true WHERE ID IN [...]
```

---

## DB Entity

The plugin automatically adds the following entity to your project's database schema:

```cds
namespace error.outbox;

entity Errors {
  key ID        : UUID;
      hash      : String(64);
      service   : String;
      action    : String;
      message   : LargeString;
      stack     : LargeString;
      count     : Integer;
      firstSeen : Timestamp;
      lastSeen  : Timestamp;
      sent      : Boolean default false;
}
```

After installing the plugin, register the model in your project's `db/` folder. Create a file `db/error-outbox.cds`:

```cds
using from '../plugins/cds-error-outbox/db/model';
```

Then run deploy:

```bash
cds deploy --to sqlite   # local development
cds build                # production (BTP, HANA)
```

---

## Environment variables

CAP maps nested config paths to environment variables. You can override any value at runtime without changing `package.json`:

```bash
CDS_REQUIRES_ERROROUTBOX_ENABLED=true
CDS_REQUIRES_ERROROUTBOX_INTERVAL=60000
CDS_REQUIRES_ERROROUTBOX_MAIL_PROVIDER=o365
CDS_REQUIRES_ERROROUTBOX_MAIL_TENANTID=...
CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTID=...
CDS_REQUIRES_ERROROUTBOX_MAIL_CLIENTSECRET=...
CDS_REQUIRES_ERROROUTBOX_MAIL_FROM=errors@yourcompany.com
CDS_REQUIRES_ERROROUTBOX_MAIL_TO=devops@yourcompany.com
```

---

## Project structure

```
cds-error-outbox/
├── package.json          ← CAP plugin declaration (cds.plugin: true)
├── index.js              ← Entry point — calls bootstrap.initialize()
│
├── config/
│   └── defaults.js       ← Default config values
│
├── lib/
│   ├── bootstrap.js      ← Init orchestration (cds lifecycle hooks)
│   ├── config.js         ← Deep merge + config loader (singleton)
│   ├── interceptor.js    ← srv.on('error') hook (fire-and-forget)
│   ├── dedup.js          ← SHA-256 hash + DB upsert logic
│   ├── scheduler.js      ← Interval batch job
│   └── formatter.js      ← HTML email builder
│
├── providers/
│   ├── index.js          ← Provider factory
│   ├── o365.js           ← Microsoft Graph API (zero extra deps)
│   ├── smtp.js           ← nodemailer wrapper (optional peer dep)
│   └── mock.js           ← Console logger (dev/test)
│
└── db/
    └── model.cds         ← error.outbox.Errors entity
```

---

## License

MIT
