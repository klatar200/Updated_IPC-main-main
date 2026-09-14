#!/usr/bin/env node
/**
 * audit9-strings.js — AUDIT-9 shared instrument I-strings (PLAN-11 §3.3, §6 P5).
 * Builds `{surface, locator, text, editable_on}` for P5a/b/c and P4's claims
 * register. File-based, no server/browser, plain CommonJS, Node built-ins only.
 *
 * Usage: node _harness/audit9-strings.js [OUT]  (default OUT: see below)
 * Writes OUT/audit9-strings.json + OUT/summary.md. Exits 0.
 *
 * App.jsx heuristics (never read whole into this process's own prose — only
 * scanned line-by-line below): (1) the four default objects are located by
 * their `const NAME = {`/`[` line, extent found by counting `{}[]` on a
 * string/comment-masked copy of each line until depth returns to 0; every
 * quoted leaf inside is `public-defaults`, path-keyed by the nearest `key:`
 * seen while re-walking. (2) Outside those ranges (and outside NotFoundPage/
 * CatalogError, carved to `meta`), a text-node scanner treats a run of
 * non-code-shaped lines bounded above by a line ending `>` and below by one
 * starting `<` as one JSX text node (Prettier puts each child on its own
 * line, so this misses same-line text, e.g. `<h1>Short</h1>`); a separate
 * regex catches `placeholder|aria-label|title|alt|label="…"` props (the `=`
 * excludes an object-literal `key: "…"`). (3) `{expr}` is stripped to `{…}`.
 *
 * Known gaps: the JSX scanner can mis-split a text node containing a literal
 * `<`/`>`; a hardcoded array using an object key (not a JSX prop) such as
 * `label: "…"` elsewhere in App.jsx is not walked — only the named surfaces.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || '_harness/out/audit9/I-strings');
fs.mkdirSync(OUT, { recursive: true });

const records = [];
const rec = (surface, locator, text, editable_on) => {
  text = String(text).replace(/\s+/g, ' ').trim();
  if (text.length < 2) return;
  if (/^-?\d+(\.\d+)?$/.test(text)) return; // pure number
  if (/^https?:\/\//i.test(text)) return; // URL
  if (/^(tel|mailto):/i.test(text)) return;
  if (/^[\w.-]+\/[\w./-]*$/.test(text) && !/[A-Za-z].*\s/.test(text)) return; // bare path, no spaces
  records.push({ surface, locator, text, editable_on });
};

const read = (p) => fs.readFileSync(p, 'utf8');
const relPath = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/* ---------- shared: mask block comments (JS /* *\/ and JSX {/* *\/}) ------- */
function maskBlockComments(lines) {
  const out = lines.slice();
  let inBlock = false;
  for (let i = 0; i < out.length; i++) {
    let line = out[i];
    let res = '';
    for (let j = 0; j < line.length; j++) {
      if (!inBlock && line[j] === '/' && line[j + 1] === '*') { inBlock = true; res += '  '; j++; continue; }
      if (inBlock) {
        if (line[j] === '*' && line[j + 1] === '/') { inBlock = false; res += '  '; j++; continue; }
        res += ' ';
        continue;
      }
      res += line[j];
    }
    out[i] = res;
  }
  return out;
}

/* Mask `//` line comments, but only outside quoted strings on that line. */
function maskLineComments(line) {
  let inStr = null;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (inStr) {
      if (c === '\\') { j++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '/' && line[j + 1] === '/') return line.slice(0, j);
  }
  return line;
}

/* Mask JSX comments `{/* … *\/}` (already-block-comment-masked to spaces
   between the delimiters) down to nothing so the text scanner skips them. */
function stripJsxComment(line) {
  return line.replace(/\{\s*\}/g, '').trim();
}

/* Depth of {,},[,] on a line with quoted-string contents blanked (so a brace
   inside a string never perturbs the count). */
function structDelta(line) {
  let inStr = null, delta = 0;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (inStr) {
      if (c === '\\') { j++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{' || c === '[') delta++;
    else if (c === '}' || c === ']') delta--;
  }
  return delta;
}

/* All double/single-quoted string literals on a line (comments already
   masked), as {value, raw}. Backtick template literals are skipped — none of
   the four default objects or the JSX surfaces uses one for visible copy. */
function stringLiterals(line) {
  const out = [];
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out.map((s) => s.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, ' '));
}

/* ================= App.jsx: locate the four default blocks ================ */
const appJsxPath = path.join(ROOT, 'src/App.jsx');
const appLinesRaw = read(appJsxPath).split('\n');
const appLines = appLinesRaw.map(maskLineComments);
const appMasked = maskBlockComments(appLines);

function findBlock(name) {
  const startIdx = appMasked.findIndex((l) => new RegExp('^const ' + name + '\\s*=\\s*[\\{\\[]').test(l));
  if (startIdx === -1) return null;
  let depth = 0, i = startIdx;
  for (; i < appMasked.length; i++) {
    depth += structDelta(appMasked[i]);
    if (depth === 0 && i > startIdx) break;
  }
  return { start: startIdx, end: i }; // 0-based, inclusive
}
const DEFAULT_BLOCKS = {
  COPY_DEFAULTS: { ...findBlock('COPY_DEFAULTS'), editable_on: 'Page Content' },
  SITE_DEFAULTS: { ...findBlock('SITE_DEFAULTS'), editable_on: 'Business Details' },
  PRIVACY_SECTIONS: { ...findBlock('PRIVACY_SECTIONS'), editable_on: 'Page Content' },
  SEO_DEFAULT: { ...findBlock('SEO_DEFAULT'), editable_on: 'Page Content' },
};
// Meta carve-outs: strings inside these functions are `meta`, not `public-jsx`.
const META_FUNCS = [findFunctionRange('NotFoundPage'), findFunctionRange('CatalogError')].filter(Boolean);
function findFunctionRange(name) {
  const startIdx = appMasked.findIndex((l) => new RegExp('^function ' + name + '\\(').test(l));
  if (startIdx === -1) return null;
  let depth = 0, i = startIdx;
  for (; i < appMasked.length; i++) {
    depth += structDelta(appMasked[i]);
    if (depth === 0 && i > startIdx) break;
  }
  return { start: startIdx, end: i };
}
function inRange(i, r) { return r && i >= r.start && i <= r.end; }
function inAnyDefaultBlock(i) { return Object.values(DEFAULT_BLOCKS).some((r) => inRange(i, r)); }
function inAnyMetaFunc(i) { return META_FUNCS.some((r) => inRange(i, r)); }

/* ---------- 1. public-defaults: walk each block, tracking key path ----------
 * A running object-key `stack` covers MULTI-line nesting (COPY_DEFAULTS.hero
 * spans many lines). Several leaves nest a level SINGLE-line instead (e.g.
 * SITE_DEFAULTS `contact: { phone: "…", fax: "…" }` all on one line) — for
 * those, `lineExtra` (the line's own leading `key: {`/`[`) supplies the extra
 * path segment the stack won't have pushed (it only pushes when the brace
 * trails the line, i.e. actually spans lines). KEY_RE locates every `key:`
 * on the line (whatever its value shape) so a bare array element (`days:
 * ["Monday", …]`) can look up the nearest key before its own position. */
const KEY_RE = /(?:^\s*|[,{[]\s*)(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:/g;
const KEYVAL_RE = /(?:^\s*|[,{[]\s*)(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*"((?:[^"\\]|\\.)*)"/g;
for (const [blockName, block] of Object.entries(DEFAULT_BLOCKS)) {
  if (!block.start && block.start !== 0) continue;
  const stack = []; // running object-key path, popped on net negative bracket delta
  let pendingKey = null; // set by a line ending in a bare `key:` — its value is the next literal
  for (let i = block.start; i <= block.end; i++) {
    const line = appMasked[i];
    const pathPrefix = stack.filter(Boolean).join('.');
    const leadingOpen = line.match(/^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*[\{\[]/);
    const lineExtra = leadingOpen ? (leadingOpen[1] || leadingOpen[2] || leadingOpen[3]) : null;
    const effPrefix = [pathPrefix, lineExtra].filter(Boolean).join('.');

    const keyPositions = [];
    let km;
    KEY_RE.lastIndex = 0;
    while ((km = KEY_RE.exec(line))) keyPositions.push({ pos: km.index, key: km[1] || km[2] || km[3] });
    const localKeyBefore = (pos) => {
      let found = null;
      for (const kp of keyPositions) { if (kp.pos < pos) found = kp.key; else break; }
      return found;
    };

    const keyedSpans = []; // [start, end] of each `key: "value"` match, to exclude from the bare pass
    KEYVAL_RE.lastIndex = 0;
    while ((km = KEYVAL_RE.exec(line))) {
      const key = km[1] || km[2] || km[3];
      const val = km[4].replace(/\\"/g, '"').replace(/\\n/g, ' ');
      keyedSpans.push([km.index, km.index + km[0].length]);
      const leafPath = effPrefix ? `${effPrefix}.${key}` : key;
      rec('public-defaults', `${blockName}.${leafPath}:App.jsx:${i + 1}`, val, block.editable_on);
    }
    // A handful of values are single-quoted instead (their text contains a
    // double quote, e.g. privacyHeader.intro's `("IPC", "we", …)`) — matched
    // only when the ENTIRE trimmed line is one such literal, so a stray
    // apostrophe in ordinary prose is never mistaken for a delimiter.
    const wholeLineSingle = line.match(/^\s*'((?:[^'\\]|\\.)*)'\s*,?\s*$/);
    if (wholeLineSingle) {
      const val = wholeLineSingle[1].replace(/\\'/g, "'").replace(/\\n/g, ' ');
      const leafPath = pendingKey ? (effPrefix ? `${effPrefix}.${pendingKey}` : pendingKey) : (effPrefix || blockName);
      rec('public-defaults', `${blockName}.${leafPath}:App.jsx:${i + 1}`, val, block.editable_on);
      pendingKey = null;
    } else {
      // bare string literals not already consumed as a `key: "value"` pair —
      // array elements (days: [...], about.paragraphs: [...]).
      const bareRe = /"((?:[^"\\]|\\.)*)"/g;
      let bm, first = true;
      while ((bm = bareRe.exec(line))) {
        if (keyedSpans.some(([s, e]) => bm.index >= s && bm.index < e)) continue;
        const val = bm[1].replace(/\\"/g, '"').replace(/\\n/g, ' ');
        // A `key:` dangling at the end of the PREVIOUS line (no value there) —
        // this line's first literal is that key's value, not an array element.
        if (first && pendingKey) {
          const leafPath = effPrefix ? `${effPrefix}.${pendingKey}` : pendingKey;
          rec('public-defaults', `${blockName}.${leafPath}:App.jsx:${i + 1}`, val, block.editable_on);
          pendingKey = null;
        } else {
          const localKey = localKeyBefore(bm.index);
          const leafPath = localKey ? `${effPrefix ? effPrefix + '.' : ''}${localKey}[]` : `${effPrefix || blockName}[]`;
          rec('public-defaults', `${blockName}.${leafPath}:App.jsx:${i + 1}`, val, block.editable_on);
        }
        first = false;
      }
    }
    // a bare `key:` with nothing else on the line — its value is the next
    // literal, wherever that lands (e.g. company.description, PRIVACY_
    // SECTIONS' `content:`).
    const danglingKey = line.match(/^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*$/);
    if (danglingKey) pendingKey = danglingKey[1] || danglingKey[2] || danglingKey[3];
    // running key-path stack: a trailing `key: {` / `key: [` opens a level
    // that actually spans lines; net negative bracket delta closes it back.
    const openMatch = line.match(/(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*[\{\[]\s*$/);
    if (openMatch) stack.push(openMatch[1] || openMatch[2] || openMatch[3]);
    const delta = structDelta(line);
    if (delta < 0) for (let d = 0; d < -delta && stack.length; d++) stack.pop();
  }
}

/* ---------- 2. public-jsx (and its meta carve-out): text nodes + props ------ */
const PROP_RE = /\b(placeholder|aria-label|title|alt|label)\s*=\s*(?:"([^"]*)"|\{"([^"]*)"\})/g;
function isCodeShaped(t) {
  if (t === '') return true;
  if (/^[<>{})\]]/.test(t)) return true;
  if (/[;{(]$/.test(t)) return true;
  if (/=>\s*$/.test(t)) return true;
  if (/^(const|let|var|function|return|import|export|if|else|for|while|switch|case)\b/.test(t)) return true;
  return false;
}
let textRunStart = -1, textRunParts = [];
function flushTextRun() {
  if (textRunStart === -1) return;
  const text = textRunParts.join(' ').replace(/\{[^{}]*\}/g, '{…}').trim();
  if (text.replace(/\{…\}/g, ' ').trim().length >= 2) {
    rec(inAnyMetaFunc(textRunStart) ? 'meta' : 'public-jsx', `App.jsx:${textRunStart + 1}`, text, 'hardcoded');
  }
  textRunStart = -1; textRunParts = [];
}
for (let i = 0; i < appMasked.length; i++) {
  if (inAnyDefaultBlock(i)) { flushTextRun(); continue; }
  const raw = stripJsxComment(appMasked[i]);
  const trimmed = raw.trim();

  // props (independent of the text-run state machine)
  let pm;
  PROP_RE.lastIndex = 0;
  while ((pm = PROP_RE.exec(raw))) {
    const val = pm[2] !== undefined ? pm[2] : pm[3];
    if (val) {
      const surface = inAnyMetaFunc(i) ? 'meta' : 'public-jsx';
      rec(surface, `App.jsx:${i + 1}`, val, 'hardcoded');
    }
  }

  // same-line >text< (rare, but catches short single-line children)
  const sameLine = raw.match(/>([^<>{}]{2,})</);
  if (sameLine && !isCodeShaped(trimmed)) {
    const surface = inAnyMetaFunc(i) ? 'meta' : 'public-jsx';
    rec(surface, `App.jsx:${i + 1}`, sameLine[1], 'hardcoded');
  }

  const prevTrimmed = i > 0 ? appMasked[i - 1].trim() : '';
  const opensTextRun = /(^|[^=])>\s*$/.test(prevTrimmed) && !/\/>\s*$/.test(prevTrimmed);
  if (textRunStart === -1) {
    if (opensTextRun && trimmed && !isCodeShaped(trimmed) && !trimmed.startsWith('<')) {
      textRunStart = i;
      textRunParts = [trimmed];
    }
  } else {
    if (trimmed.startsWith('<') || trimmed === '' || isCodeShaped(trimmed)) {
      flushTextRun();
    } else {
      textRunParts.push(trimmed);
    }
  }
}
flushTextRun();

/* ================= public-data: three JSON files ========================== */
const DATA_FILES = {
  'data/content.json': 'Page Content',
  'data/site-info.json': 'Business Details',
  'data/products-all.json': null, // per-record, see below
};
function walkJson(val, filePath, jsonPath, editableOn, surface) {
  if (val === null || val === undefined) return;
  if (Array.isArray(val)) {
    val.forEach((v, idx) => walkJson(v, filePath, `${jsonPath}[${idx}]`, editableOn, surface));
  } else if (typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) {
      walkJson(v, filePath, jsonPath ? `${jsonPath}.${k}` : k, editableOn, surface);
    }
  } else if (typeof val === 'string') {
    rec(surface, `${filePath}:${jsonPath}`, val, editableOn);
  }
}
for (const [rel] of Object.entries(DATA_FILES)) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const data = JSON.parse(read(full));
  if (rel.endsWith('products-all.json')) {
    data.forEach((prod) => {
      const sku = prod.sku || prod.id || '?';
      walkJson(prod, rel, `[sku=${sku}]`, `Products → Edit ${sku}`, 'public-data');
    });
  } else if (rel.endsWith('content.json')) {
    // seo[] is carved out to `meta` per the launch brief; everything else public-data.
    for (const [topKey, topVal] of Object.entries(data)) {
      if (topKey === 'seo') walkJson(topVal, rel, 'seo', 'Page Content', 'meta');
      else walkJson(topVal, rel, topKey, 'Page Content', 'public-data');
    }
  } else {
    walkJson(data, rel, '', 'Business Details', 'public-data');
  }
}

/* ================= admin: admin/*.php ===================================== */
const adminDir = path.join(ROOT, 'admin');
const adminFiles = fs.readdirSync(adminDir).filter((f) => f.endsWith('.php')).map((f) => path.join(adminDir, f));
// Lines carved out to `meta` (session-expired/too-large/no-password) so they
// are not double-counted under `admin`; located by grep, read ±3 for context.
const META_ADMIN_HITS = [
  { file: 'admin/config.php', pattern: /\$title\s*=\s*'That upload was too large for this server'/ },
  { file: 'admin/config.php', pattern: /\$title\s*=\s*\$expired \? 'Your sign-in session expired' : 'This form could not be verified'/ },
  { file: 'admin/auth.php', pattern: /No admin password is set on this server/ },
];
function metaAdminLineNumbers() {
  const hits = [];
  for (const { file, pattern } of META_ADMIN_HITS) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const ls = read(full).split('\n');
    ls.forEach((l, idx) => { if (pattern.test(l)) hits.push(`${file}:${idx + 1}`); });
  }
  return new Set(hits);
}
const metaAdminSkip = metaAdminLineNumbers();

function scanPhpFile(full) {
  const rel = relPath(full);
  const rawLines = read(full).split('\n');
  let inPhp = false;
  let inStyle = false; // <style>…</style> is CSS, not user-facing text — skipped whole
  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    const locator = `${rel}:${i + 1}`;

    // toggle PHP mode by tag occurrences on this line, segment by segment
    const segments = line.split(/(<\?php|<\?=|\?>)/);
    let htmlParts = [];
    let seg_inPhp = inPhp;
    for (const seg of segments) {
      if (seg === '<?php' || seg === '<?=') { seg_inPhp = true; continue; }
      if (seg === '?>') { seg_inPhp = false; continue; }
      if (!seg_inPhp) htmlParts.push(seg);
      else if (!metaAdminSkip.has(locator)) {
        // PHP segment: $errors[]/$warnings[]/$success literals — only the
        // assignment's RHS, so an unrelated string earlier on the same
        // statement (a post_str('name') argument, say) is not swept in too.
        const masked = maskLineComments(seg);
        const am = masked.match(/\$(?:errors|warnings)\[\]\s*=\s*(.+?)(?:;|$)/)
          || masked.match(/^\s*\$success\s*=\s*(.+?)(?:;|$)/);
        if (am) for (const s of stringLiterals(am[1])) rec('admin', locator, s, 'code');
      }
    }
    inPhp = seg_inPhp;

    let html = htmlParts.join(' ');
    if (/<style[\s>]/.test(html)) inStyle = true;
    if (inStyle) html = '';
    if (/<\/style>/.test(htmlParts.join(' '))) inStyle = false;
    if (!html.trim()) continue;
    if (metaAdminSkip.has(locator)) continue;

    // data-confirm="..."
    const dc = html.match(/data-confirm="([^"]*)"/);
    if (dc) rec('admin', locator, dc[1].replace(/&#10;/g, ' '), 'code');

    // text nodes: strip tags, keep text; strip <?= …?> holes already removed by split.
    const stripped = html.replace(/<[^>]*>/g, ' | ').split('|').map((s) => s.trim()).filter(Boolean);
    for (const t of stripped) {
      if (t.length < 2) continue;
      if (/^[{}<>]/.test(t)) continue;
      rec('admin', locator, t, 'code');
    }
  }
}
for (const f of adminFiles) scanPhpFile(f);

/* ================= meta: index.html, manifest.json, robots.txt ============ */
const idxLines = read(path.join(ROOT, 'index.html')).split('\n');
idxLines.forEach((l, i) => {
  const loc = `index.html:${i + 1}`;
  const t = l.match(/<title>([^<]*)<\/title>/);
  if (t) rec('meta', loc, t[1], 'hardcoded');
  if (/name="description"/.test(idxLines.slice(Math.max(0, i - 1), i + 2).join(' '))) {
    const c = l.match(/content="([^"]*)"/);
    if (c) rec('meta', loc, c[1], 'hardcoded');
  }
  const og = l.match(/property="og:(title|description|image:alt)"\s+content="([^"]*)"/);
  if (og) rec('meta', loc, og[2], 'hardcoded');
});
const manifest = JSON.parse(read(path.join(ROOT, 'public/manifest.json')));
for (const k of ['name', 'short_name', 'description']) {
  if (typeof manifest[k] === 'string') rec('meta', `public/manifest.json:${k}`, manifest[k], 'hardcoded');
}
read(path.join(ROOT, 'public/robots.txt')).split('\n').forEach((l, i) => {
  if (/^\s*#/.test(l)) rec('meta', `public/robots.txt:${i + 1}`, l.replace(/^\s*#\s?/, ''), 'hardcoded');
});
// NotFoundPage / CatalogError text already tagged `meta` by the JSX walker above.
// session-expired / too-large-upload / auth.php no-password strings:
for (const { file, pattern } of META_ADMIN_HITS) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  const ls = read(full).split('\n');
  ls.forEach((l, idx) => {
    if (!pattern.test(l)) return;
    for (const s of stringLiterals(maskLineComments(l))) rec('meta', `${file}:${idx + 1}`, s, 'code');
  });
}
// The two $lead paragraphs (session-expired / this-form-could-not-be-verified
// / too-large) in admin/config.php's csrf_fail_page() are each a `$lead = …`
// statement that may run several lines (string concatenation or a ternary);
// collect every line from the `$lead =`/`$lead  =` start through the line
// whose net structDelta-style paren/statement finally closes with `;`.
{
  const cfg = read(path.join(ROOT, 'admin/config.php')).split('\n').map(maskLineComments);
  let inLead = false;
  cfg.forEach((l, idx) => {
    if (!inLead && /^\s*\$lead\s*=/.test(l)) inLead = true;
    if (!inLead) return;
    for (const s of stringLiterals(l)) {
      const clean = s.replace(/<\/?(strong|code|em)>/g, '').trim();
      if (clean) rec('meta', `admin/config.php:${idx + 1}`, clean, 'code');
    }
    if (/;\s*$/.test(l)) inLead = false;
  });
}

/* ================= email: contact.php templates, rendered ================= */
const phpBin = (() => { try { execFileSync('php', ['-v']); return 'php'; } catch { return null; } })();
if (phpBin) {
  const throwaway = `<?php
// Throwaway reproduction for AUDIT-9 I-strings — includes nothing from the
// repo, only re-types the concatenation shape read from public/contact.php
// (RFQ + message sales-notification bodies; RFQ + message auto-reply bodies)
// with sample data, so the assembled strings can be inventoried offline.
// Never POSTs to any server.
$name='Jane Doe'; $company='Acme Corp'; $email='jane@example.com'; $phone='555-123-4567';
$partNumber='IP33PO'; $material='PVC'; $quantity='500 ft'; $reqDate='2026-10-01';
$specialReqs='Cut to 6in lengths'; $notes='Please confirm lead time'; $ip='203.0.113.5';
$subj='Bulk pricing question'; $message='Do you offer volume discounts?';
$bizName='Insulation Products Corporation'; $bizPhone='630.771.0700';
$bizFax='630.771.0701'; $bizHours='Mon-Fri, 8am-5pm CT';
$bizAddr='250 Gibraltar Dr, Bolingbrook, IL 60440'; $to='sales@insulationproducts.com';
$rfqPromise='Our sales team will review your request and respond within one business day — often the same day for in-stock items.';
$msgPromise='Our team will respond within one business day.';
$noticePara='';
$rfqSubject = 'IPC Quote Request — ' . ($partNumber !== '' ? $partNumber : 'General RFQ') . ' — ' . $name;
$rfqBody = "IPC QUOTE REQUEST\\n=================\\n\\nName:            {\$name}\\nCompany:         {\$company}\\nEmail:           {\$email}\\nPhone:           {\$phone}\\n\\nPart Number:     {\$partNumber}\\nMaterial Type:   {\$material}\\nQuantity:        {\$quantity}\\nRequired By:     {\$reqDate}\\n\\nSpecial Requirements:\\n{\$specialReqs}\\n\\nAdditional Notes:\\n{\$notes}\\n\\n---\\nSubmitted: 2026-09-14 10:00:00 CDT\\nIP:        {\$ip}\\n";
$msgSubject = 'IPC Contact Form — ' . ($subj !== '' ? $subj : 'General Inquiry') . ' — ' . $name;
$msgBody = "IPC CONTACT FORM\\n================\\n\\nName:    {\$name}\\nCompany: {\$company}\\nEmail:   {\$email}\\nPhone:   {\$phone}\\nSubject: {\$subj}\\n\\nMessage:\\n{\$message}\\n\\n---\\nSubmitted: 2026-09-14 10:00:00 CDT\\nIP:        {\$ip}\\n";
$rName = $name !== '' ? substr($name,0,60) : 'there';
$rfqReplySubject = "We received your quote request — {\$bizName}";
$rfqReplyBody = "Hello {\$rName},\\n\\nThank you for submitting a quote request to {\$bizName}.\\n\\n{\$rfqPromise}\\n\\n{\$noticePara}YOUR REQUEST SUMMARY\\n--------------------\\nPart Number:   {\$partNumber}\\nMaterial Type: {\$material}\\nQuantity:      {\$quantity}\\nRequired By:   {\$reqDate}\\n\\nFor urgent needs, reach us directly:\\n  Phone: {\$bizPhone} ({\$bizHours})\\n  Fax:   {\$bizFax}\\n  Email: {\$to}\\n\\n{\$bizName}\\n{\$bizAddr}\\n";
$msgReplySubject = "We received your message — {\$bizName}";
$msgReplyBody = "Hello {\$rName},\\n\\nThank you for contacting {\$bizName}.\\n\\n{\$msgPromise}\\n\\n{\$noticePara}For urgent needs, reach us directly:\\n  Phone: {\$bizPhone} ({\$bizHours})\\n  Fax:   {\$bizFax}\\n  Email: {\$to}\\n\\n{\$bizName}\\n{\$bizAddr}\\n";
echo json_encode([
  'rfq-notification' => ['subject' => $rfqSubject, 'body' => $rfqBody],
  'message-notification' => ['subject' => $msgSubject, 'body' => $msgBody],
  'rfq-autoreply' => ['subject' => $rfqReplySubject, 'body' => $rfqReplyBody],
  'message-autoreply' => ['subject' => $msgReplySubject, 'body' => $msgReplyBody],
]);
`;
  const throwawayPath = path.join(OUT, '_email-render.php');
  fs.writeFileSync(throwawayPath, throwaway);
  const outJson = execFileSync(phpBin, [throwawayPath], { encoding: 'utf8' });
  const templates = JSON.parse(outJson);
  // Lines carried from the editable auto-reply prose (COPY_GROUPS.contactForm)
  // stay editable_on = "Page Content"; the rest of the assembly is hardcoded.
  const editableLines = new Set([
    'Our sales team will review your request and respond within one business day — often the same day for in-stock items.',
    'Our team will respond within one business day.',
  ]);
  for (const [name, { subject, body } ] of Object.entries(templates)) {
    rec('email', `public/contact.php:${name}#subject`, subject, 'hardcoded');
    body.split('\n').forEach((line, idx) => {
      const t = line.trim();
      if (!t) return;
      rec('email', `public/contact.php:${name}#body:${idx + 1}`, t, editableLines.has(t) ? 'Page Content' : 'hardcoded');
    });
  }
  console.log('email surface: rendered with `php` — throwaway script at ' + relPath(throwawayPath));
} else {
  console.log('email surface: SKIPPED — no `php` binary on PATH');
}

/* ================= docs: split into sentences ============================= */
const DOC_FILES = [
  'admin/README.md',
  'Editing-Your-Site-Content.md',
  'Email to Rick - Admin Dashboard Handoff.md',
  'GO-LIVE.md',
  'PATCH_NOTES.md',
];
function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'`])/).map((s) => s.trim()).filter(Boolean);
}
for (const relDoc of DOC_FILES) {
  const full = path.join(ROOT, relDoc);
  if (!fs.existsSync(full)) continue;
  const lines = read(full).split('\n');
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return; }
    if (inFence) return;
    if (/^\s*\|/.test(line)) return; // markdown table row
    const stripped = line.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim();
    if (!stripped) return;
    for (const s of splitSentences(stripped)) rec('docs', `${relDoc}:${i + 1}`, s, 'code');
  });
}

/* ================= write outputs =========================================== */
fs.writeFileSync(path.join(OUT, 'audit9-strings.json'), JSON.stringify(records, null, 1));
const counts = {};
for (const r of records) counts[r.surface] = (counts[r.surface] || 0) + 1;
const surfaces = ['public-jsx', 'public-defaults', 'public-data', 'admin', 'email', 'meta', 'docs'];
let md = `# audit9-strings summary\n\nTotal records: ${records.length}\n\n| surface | count |\n|---|---|\n`;
for (const s of surfaces) md += `| ${s} | ${counts[s] || 0} |\n`;
fs.writeFileSync(path.join(OUT, 'summary.md'), md);

console.log(`audit9-strings: ${records.length} records -> ${relPath(path.join(OUT, 'audit9-strings.json'))}`);
for (const s of surfaces) console.log(`  ${s}: ${counts[s] || 0}`);
process.exit(0);
