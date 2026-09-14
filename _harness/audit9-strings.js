#!/usr/bin/env node
/**
 * audit9-strings.js — AUDIT-9 shared instrument I-strings (PLAN-11 §3.3, §6 P5).
 *
 * Builds the string inventory `{surface, locator, text, editable_on}` consumed
 * by P5a/P5b/P5c (verbiage) and P4 (claims-register seed). File-based, no
 * server, no browser, plain CommonJS, Node built-ins only.
 *
 * Usage: node _harness/audit9-strings.js [OUT]
 *   OUT defaults to _harness/out/audit9/I-strings. Writes OUT/audit9-strings.json
 *   (array of records) and OUT/summary.md (counts per surface). Exits 0.
 *
 * ── Heuristics for src/App.jsx (never read whole into this process's own
 *    prose — only parsed line-by-line by the scanner below) ──────────────
 * 1. The four default objects (COPY_DEFAULTS, SITE_DEFAULTS, PRIVACY_SECTIONS,
 *    SEO_DEFAULT) are located by their `const NAME = {`/`[` declaration line,
 *    then their extent is found by counting `{}[]` on a string-and-comment-
 *    masked copy of each line until depth returns to 0. Every quoted leaf
 *    inside that range, keyed by the nearest enclosing `key:`/array-index path
 *    seen while re-walking the range depth-first, is `public-defaults`.
 * 2. Outside those ranges (and outside NotFoundPage/CatalogError, carved out
 *    to `meta` — see below), two independent regexes run on comment-and-
 *    JSX-comment-stripped lines: (a) `(placeholder|aria-label|title|alt|label)=
 *    "…" ` / `={"…"}` for props (the `=` distinguishes a JSX attribute from an
 *    object-literal `key: "…"`, which this deliberately does not match); (b) a
 *    text-node scanner that treats a run of consecutive non-code-shaped lines
 *    bounded above by a line ending in a bare `>` and below by a line starting
 *    with `<` as one JSX text node (this file's Prettier formatting puts each
 *    JSX child on its own line, so this catches the common case and MISSES a
 *    text node that shares a line with its tags, e.g. `<h1>Short</h1>`).
 * 3. `{expr}` inside a text run is stripped to a literal `…` placeholder and
 *    the surrounding text kept, exactly as instructed; it is not evaluated.
 *
 * Known gaps (see also the handback): the text-node scanner is line-shaped
 * heuristic, not a JSX parser — it can miss same-line text and can mis-split
 * a text node that itself contains a literal `<` or `>` (e.g. "< 2 inch").
 * Hardcoded string arrays elsewhere in App.jsx that use an object key (not a
 * JSX attribute) such as `label: "…"` are not walked — only the five named
 * surfaces' rules are implemented, per the launch brief.
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
    if (i === startIdx) { /* first line already counted above */ }
  }
  return { start: startIdx, end: i }; // 0-based, inclusive
}
if (process.env.DEBUG_BLOCKS) {
  console.error('COPY_DEFAULTS', findBlock('COPY_DEFAULTS'));
  console.error('SITE_DEFAULTS', findBlock('SITE_DEFAULTS'));
  console.error('PRIVACY_SECTIONS', findBlock('PRIVACY_SECTIONS'));
  console.error('SEO_DEFAULT', findBlock('SEO_DEFAULT'));
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
function whichDefaultBlock(i) {
  for (const [name, r] of Object.entries(DEFAULT_BLOCKS)) if (inRange(i, r)) return { name, r };
  return null;
}
function inAnyMetaFunc(i) { return META_FUNCS.some((r) => inRange(i, r)); }

/* ---------- 1. public-defaults: walk each block, tracking key path ----------
 * Per line: every `key: "value"` pair (any number of them — several of these
 * objects, e.g. SITE_DEFAULTS.contact/address/hours, are one-liners) is
 * attributed to its own local key via KEYVAL_RE; a bare string with no local
 * key (an array element, e.g. days: [...] or about.paragraphs[...]) falls
 * back to the last local key seen on the line + "[]", else the running
 * object-key stack, else the block name. This loses the exact index inside a
 * same-line array of bare strings (they all get the same "<key>[]" locator,
 * disambiguated only by :App.jsx:<line> — all one line anyway here). */
const KEYVAL_RE = /(?:^\s*|[,{[]\s*)(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*"((?:[^"\\]|\\.)*)"/g;
for (const [blockName, block] of Object.entries(DEFAULT_BLOCKS)) {
  if (!block.start && block.start !== 0) continue;
  const stack = []; // running object-key path, popped on net negative bracket delta
  for (let i = block.start; i <= block.end; i++) {
    const line = appMasked[i];
    const pathPrefix = stack.filter(Boolean).join('.');
    const keyedSpans = []; // [start, end] of each matched "value" to exclude from the bare pass
    let lastLocalKey = null;
    let km;
    KEYVAL_RE.lastIndex = 0;
    while ((km = KEYVAL_RE.exec(line))) {
      const key = km[1] || km[2] || km[3];
      const val = km[4].replace(/\\"/g, '"').replace(/\\n/g, ' ');
      lastLocalKey = key;
      keyedSpans.push([km.index, km.index + km[0].length]);
      const leafPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      rec('public-defaults', `${blockName}.${leafPath}:App.jsx:${i + 1}`, val, block.editable_on);
    }
    // bare string literals not already consumed as a `key: "value"` pair —
    // array elements (days: [...], about.paragraphs: [...]).
    const bareRe = /"((?:[^"\\]|\\.)*)"/g;
    let bm;
    while ((bm = bareRe.exec(line))) {
      const overlaps = keyedSpans.some(([s, e]) => bm.index >= s && bm.index < e);
      if (overlaps) continue;
      const val = bm[1].replace(/\\"/g, '"').replace(/\\n/g, ' ');
      const leafKey = lastLocalKey ? `${lastLocalKey}[]` : (stack[stack.length - 1] || blockName);
      const leafPath = pathPrefix ? `${pathPrefix}.${leafKey}` : leafKey;
      rec('public-defaults', `${blockName}.${leafPath}:App.jsx:${i + 1}`, val, block.editable_on);
    }
    // running key-path stack: a trailing `key: {` / `key: [` opens a level;
    // net negative bracket delta on the line closes that many levels.
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
  if (/^[<>{}]/.test(t)) return true;
  if (/[;{(]$/.test(t)) return true;
  if (/=>\s*$/.test(t)) return true;
  if (/^(const|let|var|function|return|import|export|if|else|for|while|switch|case)\b/.test(t)) return true;
  if (/^[)\]}].*[,;]?$/.test(t) && t.length < 6) return true;
  return false;
}
let textRunStart = -1, textRunParts = [];
function flushTextRun(surfaceFor) {
  if (textRunStart === -1) return;
  const text = textRunParts.join(' ').replace(/\{[^{}]*\}/g, '{…}').trim();
  const cleaned = text.replace(/\{…\}/g, ' ').trim();
  if (cleaned.length >= 2) {
    const surface = inAnyMetaFunc(textRunStart) ? 'meta' : 'public-jsx';
    const editable = surface === 'meta' ? 'hardcoded' : 'hardcoded';
    rec(surface, `App.jsx:${textRunStart + 1}`, text, editable);
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

function phpStringLiterals(line) {
  return stringLiterals(line);
}
function scanPhpFile(full) {
  const rel = relPath(full);
  const rawLines = read(full).split('\n');
  let inPhp = false;
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
      else {
        // PHP segment: look for $errors[]/$warnings[]/$success literals and data-confirm
        if (!metaAdminSkip.has(locator)) {
          if (/\$(errors|warnings)\[\]\s*=/.test(seg) || /^\s*\$success\s*=\s*'/.test(seg)) {
            for (const s of phpStringLiterals(maskLineComments(seg))) rec('admin', locator, s, 'code');
          }
        }
      }
    }
    inPhp = seg_inPhp;

    const html = htmlParts.join(' ');
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
  const md = l.match(/name="description"\s*\n?\s*content="([^"]*)"/) || l.match(/content="([^"]*)"\s*\/>\s*$/);
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
    for (const s of phpStringLiterals(maskLineComments(l))) rec('meta', `${file}:${idx + 1}`, s, 'code');
  });
}
// The two paragraph strings ($lead) sit one/two lines below their $title line
// in admin/config.php's csrf_fail_page(); pulled by fixed offset, read ±3.
{
  const cfg = read(path.join(ROOT, 'admin/config.php')).split('\n');
  cfg.forEach((l, idx) => {
    if (/^\s*\$lead\s*=/.test(l) || /^\s*\.\s*'/.test(l) && cfg[idx - 1] && /\$lead/.test(cfg[idx - 1])) {
      for (const s of phpStringLiterals(maskLineComments(l))) rec('meta', `admin/config.php:${idx + 1}`, s, 'code');
    }
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
