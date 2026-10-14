/**
 * admin/inquiries.jsonl as the Inquiries page reads it.
 *
 * AUDIT-12 decision 42 (A12-L4-W2-G4-1): contact.php writes a lead's row
 * BEFORE mail(), with `sent: null` and `status: "pending"`, and appends the
 * send result afterwards as a second line, `{"type":"send-result","id":…,
 * "sent":true|false}`. admin/inquiries.php merges the two by id. A suite that
 * counted lines or took the last line as "the lead" now reads the lead through
 * these helpers. Rows written before the change carry `sent` directly and no
 * id; they pass through unchanged.
 *
 *   rawRows(file)  every parseable line, in file order
 *   leads(file)    the lead rows only, each with its send result applied
 *                  (`sent` true/false, `status` "sent"/"failed"; a row with
 *                  no result yet keeps `sent: null`, `status: "pending"`)
 */
const fs = require('fs');

function parse(text) {
  return String(text || '').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function rawRows(file) {
  try { return parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function merge(rows) {
  const result = new Map();
  for (const r of rows) if (r && r.type === 'send-result' && typeof r.id === 'string') result.set(r.id, r.sent === true);
  return rows.filter((r) => r && r.type !== 'send-result').map((r) => {
    if (typeof r.id !== 'string' || r.status !== 'pending' || !result.has(r.id)) return r;
    const sent = result.get(r.id);
    return { ...r, sent, status: sent ? 'sent' : 'failed' };
  });
}

const leads = (file) => merge(rawRows(file));

module.exports = { parse, rawRows, merge, leads };
