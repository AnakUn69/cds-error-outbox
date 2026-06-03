'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { escapeHtml, formatHtmlEmail, resolveSubject } = require('../lib/formatter');

// ── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes &', () => assert.equal(escapeHtml('a&b'), 'a&amp;b'));
  it('escapes <', () => assert.equal(escapeHtml('a<b'), 'a&lt;b'));
  it('escapes >', () => assert.equal(escapeHtml('a>b'), 'a&gt;b'));
  it('escapes "', () => assert.equal(escapeHtml('a"b'), 'a&quot;b'));
  it("escapes '", () => assert.equal(escapeHtml("a'b"), 'a&#039;b'));
  it('leaves plain strings unchanged', () => assert.equal(escapeHtml('hello world'), 'hello world'));
  it('escapes multiple characters in one string', () => {
    assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});

// ── formatHtmlEmail ──────────────────────────────────────────────────────────

function makeError(overrides = {}) {
  return {
    ID: 'id-1',
    service: 'TestService',
    action: 'READ',
    message: 'Something went wrong',
    stack: 'Error: Something went wrong\n  at handler (srv.js:10)\n  at next (cds.js:5)',
    count: 1,
    firstSeen: '2026-06-02T10:00:00.000Z',
    lastSeen: '2026-06-02T10:05:00.000Z',
    sent: false,
    ...overrides
  };
}

describe('formatHtmlEmail', () => {
  it('returns subject and html keys', () => {
    const { subject, html } = formatHtmlEmail([makeError()]);
    assert.equal(typeof subject, 'string');
    assert.equal(typeof html, 'string');
  });

  it('subject contains error count and occurrence count', () => {
    const errors = [makeError({ count: 3 }), makeError({ ID: 'id-2', count: 2 })];
    const { subject } = formatHtmlEmail(errors);
    assert.match(subject, /5 occurrence\(s\)/);
    assert.match(subject, /2 error\(s\)/);
  });

  it('html contains service name', () => {
    const { html } = formatHtmlEmail([makeError({ service: 'BookshopService' })]);
    assert.ok(html.includes('BookshopService'), 'expected service name in HTML');
  });

  it('html contains escaped message', () => {
    const { html } = formatHtmlEmail([makeError({ message: '<script>xss</script>' })]);
    assert.ok(html.includes('&lt;script&gt;'), 'message should be HTML-escaped');
    assert.ok(!html.includes('<script>xss</script>'), 'raw script tag must not appear');
  });

  it('groups errors by service', () => {
    const errors = [
      makeError({ ID: '1', service: 'ServiceA', message: 'err A' }),
      makeError({ ID: '2', service: 'ServiceB', message: 'err B' })
    ];
    const { html } = formatHtmlEmail(errors);
    assert.ok(html.includes('ServiceA'));
    assert.ok(html.includes('ServiceB'));
  });

  it('stack trace is included in the email', () => {
    const err = makeError({ stack: 'line1\nline2\nline3\nline4\nline5\nline6\nline7' });
    const { html } = formatHtmlEmail([err]);
    assert.ok(html.includes('line1'));
    // Only first 5 lines should appear
    assert.ok(!html.includes('line6'), 'stack should be truncated to 5 lines');
  });

  it('handles empty errors array without throwing', () => {
    assert.doesNotThrow(() => formatHtmlEmail([]));
  });

  it('handles missing optional fields gracefully', () => {
    const minimal = { ID: 'x', service: 'S', action: 'A', message: 'oops', count: 1 };
    assert.doesNotThrow(() => formatHtmlEmail([minimal]));
  });

  it('uses provided subjectTemplate with {count} placeholder', () => {
    const errors = [makeError({ count: 7 })];
    const { subject } = formatHtmlEmail(errors, { subjectTemplate: 'Errors: {count}' });
    assert.equal(subject, 'Errors: 7');
  });

  it('uses provided subjectTemplate with {errors} placeholder', () => {
    const errors = [makeError({ ID: '1' }), makeError({ ID: '2' })];
    const { subject } = formatHtmlEmail(errors, { subjectTemplate: '{errors} distinct' });
    assert.equal(subject, '2 distinct');
  });

  it('uses provided subjectTemplate with {timestamp} placeholder', () => {
    const { subject } = formatHtmlEmail([makeError()], { subjectTemplate: 'Report {timestamp}' });
    assert.match(subject, /^Report \d{4}-\d{2}-\d{2}T/);
  });

  it('unknown placeholders are left unchanged', () => {
    const { subject } = formatHtmlEmail([makeError()], { subjectTemplate: 'Hello {service}' });
    assert.equal(subject, 'Hello {service}');
  });

  it('falls back to built-in default when no subjectTemplate is provided', () => {
    const errors = [makeError({ count: 3 })];
    const { subject } = formatHtmlEmail(errors);
    assert.match(subject, /\[CAP Error Outbox\]/);
  });
});

// ── resolveSubject ─────────────────────────────────────────────────────────────────────────────

describe('resolveSubject', () => {
  it('replaces {count}', () => {
    assert.equal(resolveSubject('{count} errors', { count: 5, errors: 2, timestamp: 'T' }), '5 errors');
  });

  it('replaces {errors}', () => {
    assert.equal(resolveSubject('{errors} distinct', { count: 5, errors: 2, timestamp: 'T' }), '2 distinct');
  });

  it('replaces {timestamp}', () => {
    assert.equal(resolveSubject('at {timestamp}', { count: 5, errors: 2, timestamp: '2026-01-01T00:00:00.000Z' }), 'at 2026-01-01T00:00:00.000Z');
  });

  it('replaces all placeholders at once', () => {
    const result = resolveSubject('[{count}] {errors} errs @ {timestamp}', { count: 3, errors: 2, timestamp: 'NOW' });
    assert.equal(result, '[3] 2 errs @ NOW');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    assert.equal(resolveSubject('{count} / {count}', { count: 4, errors: 1, timestamp: 'T' }), '4 / 4');
  });

  it('leaves unknown placeholders unchanged', () => {
    assert.equal(resolveSubject('Hello {service}', { count: 1, errors: 1, timestamp: 'T' }), 'Hello {service}');
  });
});
