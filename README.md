<div align="center">

# CDS Error Outbox

**Automatic error capture, deduplication & email alerting for SAP CAP applications.**

<br>

[![npm](https://img.shields.io/npm/v/cds-error-outbox?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/cds-error-outbox)
[![SAP CAP](https://img.shields.io/badge/SAP%20CAP-plugin-009FDB?style=for-the-badge&logo=sap&logoColor=white)](https://cap.cloud.sap)
[![MIT](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](./LICENSE)
[![zero deps](https://img.shields.io/badge/deps-zero-6366f1?style=for-the-badge&logo=nodedotjs&logoColor=white)](#)

[![Microsoft O365](https://img.shields.io/badge/Microsoft%20365-mail%20ready-0078D4?style=flat-square&logo=microsoft&logoColor=white)](#o365--microsoft-graph-api)
[![SMTP](https://img.shields.io/badge/SMTP-nodemailer-EA4335?style=flat-square&logo=gmail&logoColor=white)](#smtp)
[![SQLite](https://img.shields.io/badge/SQLite-supported-003B57?style=flat-square&logo=sqlite&logoColor=white)](#db-entity)
[![SAP HANA](https://img.shields.io/badge/SAP%20HANA-supported-1B6B3A?style=flat-square&logo=sap&logoColor=white)](#db-entity)
[![SAP BTP](https://img.shields.io/badge/SAP%20BTP-Cloud%20Foundry-0FAAFF?style=flat-square&logo=sap&logoColor=white)](#environment-variables)

</div>

---

**[Installation](#installation) · [Configuration](#configuration) · [Email Providers](#email-providers) · [How it works](#how-it-works) · [DB Entity](#db-entity) · [Environment variables](#environment-variables) · [Project structure](#project-structure)**

---

## Features

- Hooks into **all CAP services** automatically — zero manual wiring required
- Persists errors to a CDS-managed `error.outbox.Errors` entity
- **Deduplicates** via `SHA-256(message + service + action)` — increments a counter instead of flooding the DB
- Sends **batched HTML email reports** on a configurable interval
- Pluggable providers: **O365 (Microsoft Graph)**, **SMTP (nodemailer)**, **Mock (dev/test)**
- **Non-blocking** — fire-and-forget capture, the request pipeline is never delayed
- **Resilient** — all internal failures are caught, logged, and swallowed; the app never crashes

---

## Installation

```bash
npm install cds-error-outbox
```

Because `package.json` declares `"cds": { "plugin": true }`, CAP automatically loads `index.js` at startup.

> **Note:** Due to how CAP resolves symlinked local packages, you may need to explicitly require the plugin so it is loaded at startup.
>
> **Option A — with a custom `server.js`:**
> ```js
> require("cds-error-outbox"); // ← add as the very first line
> // ... rest of your server.js
> ```
>
> **Option B — without a custom `server.js`** (most common):
> Add the require at the top of any service file, e.g. `srv/admin-service.js`:
> ```js
> require("cds-error-outbox"); // ← add at the top
> // ... rest of your service
> ```

Then register the DB model in your project (e.g. in `db/schema.cds`):

```cds
using from 'cds-error-outbox/db/model';
```

And deploy:

```bash
cds deploy --to sqlite   # local development
cds build                # production (BTP, HANA)
```

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

| Key                   | Type        | Default  | Description                            |
| --------------------- | ----------- | -------- | -------------------------------------- |
| `enabled`             | boolean     | `true`   | Enable/disable the entire plugin       |
| `interval`            | number (ms) | `300000` | Batch email job frequency              |
| `batchSize`           | number      | `50`     | Max errors per email batch             |
| `dedup.enabled`       | boolean     | `true`   | Enable hash-based deduplication        |
| `dedup.windowMinutes` | number      | `10`     | Rolling dedup window in minutes        |
| `mail.provider`       | string      | `'mock'`    | `'o365'` \| `'smtp'` \| `'mock'`                              |
| `mail.from`           | string      | `''`        | Sender address                                                 |
| `mail.to`             | string      | `''`        | Recipient(s), comma-separated                                  |
| `mail.subject`        | string      | `'[CAP Error Outbox] {count} occurrence(s) in {errors} error(s) — {timestamp}'` | Email subject template. Placeholders: `{count}`, `{errors}`, `{timestamp}` |
| `mail.importance`     | string      | `'normal'`  | Email priority: `'low'` \| `'normal'` \| `'high'`             |
| `mail.tenantId`       | string      | `''`     | Azure AD tenant ID (O365 only)         |
| `mail.clientId`       | string      | `''`     | Azure AD app client ID (O365 only)     |
| `mail.clientSecret`   | string      | `''`     | Azure AD app client secret (O365 only) |
| `mail.smtp.host`      | string      | `''`     | SMTP host (SMTP only)                  |
| `mail.smtp.port`      | number      | `587`    | SMTP port (SMTP only)                  |
| `mail.smtp.secure`    | boolean     | `false`  | Use TLS (SMTP only)                    |
| `mail.smtp.auth.user` | string      | `''`     | SMTP username (SMTP only)              |
| `mail.smtp.auth.pass` | string      | `''`     | SMTP password (SMTP only)              |

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
  srv.handle() wrapper — fire-and-forget via setImmediate (non-blocking)
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
│   ├── interceptor.js    ← srv.handle() wrapper (fire-and-forget)
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
