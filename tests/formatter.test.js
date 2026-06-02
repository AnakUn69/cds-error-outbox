'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { escapeHtml, formatHtmlEmail } = require('../lib/formatter');

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
});
