'use strict';

/**
 * Escape special HTML characters to prevent injection in the email body.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Build an HTML email body from an array of error records, grouped by service.
 *
 * @param {object[]} errors - array of error.outbox.Errors records
 * @returns {{ subject: string, html: string }}
 */
function formatHtmlEmail(errors) {
  const timestamp = new Date().toISOString();
  const total = errors.reduce((sum, e) => sum + (e.count || 1), 0);

  // Group records by service name
  const groups = {};
  for (const err of errors) {
    const key = err.service || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(err);
  }

  const subject = `[CAP Error Outbox] ${total} occurrence(s) in ${errors.length} error(s) — ${timestamp}`;

  const fmt = (ts) => ts ? String(ts).replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') : '-';

  // ── Outlook-safe HTML email ──────────────────────────────────────────────
  // Rules applied:
  //  1. Every colored cell has BOTH bgcolor="" attribute AND style="background:"
  //  2. Text colors use style="color:" on the immediate element (not parent)
  //  3. No border-radius, no box-shadow, no gradients, no flexbox
  //  4. display:block only via <p> tags, never on <span>
  //  5. Table widths via width="" attribute, not just CSS
  //  6. valign/align attributes used alongside CSS vertical-align/text-align

  let html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body, table, td, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; }
    /* Prevent Outlook dark mode */
    [data-ogsc] body, [data-ogsb] body { background:#f4f4f4 !important; color:#222222 !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;" bgcolor="#f4f4f4">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f4" style="background-color:#f4f4f4;">
  <tr>
    <td align="center" style="padding:20px 10px;">

      <!-- WRAPPER -->
      <table width="700" cellpadding="0" cellspacing="0" border="0" style="width:700px;background-color:#ffffff;" bgcolor="#ffffff">

        <!-- HEADER -->
        <tr>
          <td bgcolor="#b03a2e" style="background-color:#b03a2e;padding:24px 28px 20px;" align="left">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;line-height:1.2;">CAP Error Outbox Report</p>
            <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#f4c7c3;line-height:1;">Generated: ${escapeHtml(timestamp)}</p>
          </td>
        </tr>

        <!-- STATS -->
        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:0;border-bottom:2px solid #e8e8e8;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="33%" align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:16px 10px;border-right:1px solid #e8e8e8;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:#b03a2e;line-height:1;">${errors.length}</p>
                  <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;line-height:1;">Distinct Errors</p>
                </td>
                <td width="34%" align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:16px 10px;border-right:1px solid #e8e8e8;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:#b03a2e;line-height:1;">${total}</p>
                  <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;line-height:1;">Total Occurrences</p>
                </td>
                <td width="33%" align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:16px 10px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:#b03a2e;line-height:1;">${Object.keys(groups).length}</p>
                  <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;line-height:1;">Services Affected</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>\n`;

  for (const [service, serviceErrors] of Object.entries(groups)) {
    html += `
        <!-- SERVICE: ${escapeHtml(service)} -->
        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:20px 28px 4px;">

            <!-- Service label -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
              <tr>
                <td bgcolor="#f8f8f8" style="background-color:#f8f8f8;border-left:3px solid #b03a2e;padding:7px 12px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#333333;text-transform:uppercase;letter-spacing:0.7px;">${escapeHtml(service)}</p>
                </td>
              </tr>
            </table>

            <!-- Error table -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8e8;margin-bottom:16px;">
              <!-- Table header -->
              <tr>
                <td width="24" align="center" bgcolor="#2c3e50" style="background-color:#2c3e50;padding:8px 6px;border-right:1px solid #3d5166;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#ffffff;text-transform:uppercase;">#</p>
                </td>
                <td width="110" bgcolor="#2c3e50" style="background-color:#2c3e50;padding:8px 10px;border-right:1px solid #3d5166;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.4px;">Action</p>
                </td>
                <td bgcolor="#2c3e50" style="background-color:#2c3e50;padding:8px 10px;border-right:1px solid #3d5166;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.4px;">Message</p>
                </td>
                <td width="44" align="center" bgcolor="#2c3e50" style="background-color:#2c3e50;padding:8px 6px;border-right:1px solid #3d5166;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#ffffff;text-transform:uppercase;">Cnt</p>
                </td>
                <td width="118" bgcolor="#2c3e50" style="background-color:#2c3e50;padding:8px 10px;border-right:1px solid #3d5166;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.4px;">First Seen</p>
                </td>
                <td width="118" bgcolor="#2c3e50" style="background-color:#2c3e50;padding:8px 10px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.4px;">Last Seen</p>
                </td>
              </tr>\n`;

    serviceErrors.forEach((err, idx) => {
      const count  = err.count || 1;
      const rowBg  = idx % 2 === 1 ? '#f9f9f9' : '#ffffff';
      const bdrClr = '#e8e8e8';

      html += `              <!-- Row ${idx + 1} -->
              <tr>
                <td align="center" valign="top" bgcolor="${rowBg}" style="background-color:${rowBg};padding:9px 6px;border-top:1px solid ${bdrClr};border-right:1px solid ${bdrClr};">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;">${idx + 1}</p>
                </td>
                <td valign="top" bgcolor="${rowBg}" style="background-color:${rowBg};padding:9px 10px;border-top:1px solid ${bdrClr};border-right:1px solid ${bdrClr};">
                  <p style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:11px;color:#2c6fad;background-color:#eef4fb;padding:1px 5px;display:inline-block;">${escapeHtml(err.action || 'unknown')}</p>
                </td>
                <td valign="top" bgcolor="${rowBg}" style="background-color:${rowBg};padding:9px 10px;border-top:1px solid ${bdrClr};border-right:1px solid ${bdrClr};">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#b03a2e;">${escapeHtml(err.message || '-')}</p>
                </td>
                <td align="center" valign="top" bgcolor="${rowBg}" style="background-color:${rowBg};padding:9px 6px;border-top:1px solid ${bdrClr};border-right:1px solid ${bdrClr};">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#ffffff;background-color:${count >= 10 ? '#922b21' : '#c0392b'};padding:1px 7px;text-align:center;">${count}</p>
                </td>
                <td valign="top" bgcolor="${rowBg}" style="background-color:${rowBg};padding:9px 10px;border-top:1px solid ${bdrClr};border-right:1px solid ${bdrClr};">
                  <p style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:10px;color:#888888;white-space:nowrap;">${escapeHtml(fmt(err.firstSeen))}</p>
                </td>
                <td valign="top" bgcolor="${rowBg}" style="background-color:${rowBg};padding:9px 10px;border-top:1px solid ${bdrClr};">
                  <p style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:10px;color:#888888;white-space:nowrap;">${escapeHtml(fmt(err.lastSeen))}</p>
                </td>
              </tr>\n`;

      // Stack trace as a separate full-width row
      if (err.stack) {
        const stackExcerpt = err.stack.split('\n').slice(0, 5).join('\n');
        html += `              <tr>
                <td valign="top" bgcolor="#fafafa" style="background-color:#fafafa;padding:0 0 0 24px;border-top:none;" colspan="6">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#f2f2f2" style="background-color:#f2f2f2;padding:7px 10px;border-top:1px dashed #dddddd;border-left:3px solid #dddddd;">
                        <p style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:10px;color:#666666;white-space:pre-wrap;line-height:1.5;">${escapeHtml(stackExcerpt)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>\n`;
      }
    });

    html += `            </table>

          </td>
        </tr>\n`;
  }

  html += `
        <!-- FOOTER -->
        <tr>
          <td bgcolor="#f4f4f4" style="background-color:#f4f4f4;padding:14px 28px;border-top:1px solid #e8e8e8;" align="center">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#aaaaaa;">Sent by <strong>cds-error-outbox</strong> &mdash; these errors are marked as sent and will not be repeated until new occurrences are captured.</p>
          </td>
        </tr>

      </table>
      <!-- /WRAPPER -->

    </td>
  </tr>
</table>

</body>
</html>`;

  return { subject, html };
}

module.exports = { formatHtmlEmail, escapeHtml };
