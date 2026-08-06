/**
 * The twelve invariants from CLAUDE.md, asserted against the SOURCE.
 *
 * REBUILT 2026-08-06. The original _harness/ was gitignored and never
 * committed, so it did not survive the clone. This is a reconstruction from
 * CLAUDE.md's invariant list and the code each one guards — it is NOT the
 * original file, and its check count (16) is its own, not the 15 the earlier
 * sessions reported. Treat a green run here as "the twelve invariants hold",
 * not as "the historical suite passed". Current count: 17.
 *
 * Every check is proved capable of failing by _harness/invariants-selftest.js,
 * which mutates COPIES of the five source files in a temp tree and asserts the
 * matching check goes red. Run it after editing this file.
 *
 * GUARDRAILS 4.4: every assertion below tests CODE, never an incident comment.
 * Two checks in session 3 passed falsely because they matched comment prose
 * that quoted the old buggy pattern. Where a comment is the only evidence, the
 * check says so and asserts the code that comment describes instead.
 *
 * Usage: node _harness/invariants.js
 */

const fs = require('fs');
const path = require('path');

// IPC_ROOT lets invariants-selftest.js point the same checks at a mutated copy
// of the tree. Unset (the normal case) it is the repo itself.
const root = process.env.IPC_ROOT ? path.resolve(process.env.IPC_ROOT) : path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const results = [];
function check(id, what, fn) {
  let ok = false, detail = '';
  try {
    const r = fn();
    if (r === true) { ok = true; }
    else if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail || ''; }
  } catch (e) {
    ok = false; detail = e.message;
  }
  results.push({ id, what, ok, detail });
}

/** The body of a named PHP function, brace-matched. */
function phpFunctionBody(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error(`function ${name}() not found`);
  const open = src.indexOf('{', start);
  if (open < 0) throw new Error(`function ${name}() has no body`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  throw new Error(`function ${name}() body is unbalanced`);
}

/** The body of a JS function declaration, brace-matched. */
function jsFunctionBody(src, name) {
  const start = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if (start < 0) throw new Error(`function ${name}() not found`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  throw new Error(`function ${name}() body is unbalanced`);
}

/** Strip // and /* *\/ comments so a check cannot match prose. */
function stripJsComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}
/** Strip PHP comments (# , // , /* *\/) for the same reason. */
function stripPhpComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^[ \t]*\/\/.*$/gm, '')
          .replace(/^[ \t]*#.*$/gm, '');
}

const configPhp   = read('admin/config.php');
const contentPhp  = read('admin/content.php');
const contactPhp  = read('public/contact.php');
const appJsx      = read('src/App.jsx');
const indexCss    = read('src/index.css');

// ── Invariant 1 — admin_password_write() uses preg_replace_callback ──────────
// Every bcrypt hash contains "$2y$12$"; as a replacement string those are
// backreferences. The shipped code wrote "y$…" and the password page was 0%
// functional.
check('INV1a', 'admin_password_write() uses preg_replace_callback', () => {
  const body = stripPhpComments(phpFunctionBody(configPhp, 'admin_password_write'));
  return { ok: /preg_replace_callback\s*\(/.test(body), detail: 'no preg_replace_callback in body' };
});

check('INV1b', 'admin_password_write() makes no bare preg_replace() call', () => {
  const body = stripPhpComments(phpFunctionBody(configPhp, 'admin_password_write'));
  // preg_replace_callback is fine; a bare preg_replace( is the incident.
  const bare = body.match(/(?<!_)\bpreg_replace\s*\(/g) || [];
  return { ok: bare.length === 0, detail: `${bare.length} bare preg_replace() call(s) in body` };
});

// ── Invariant 2 — no shipped default admin password ─────────────────────────
check('INV2a', 'config.php contains no bcrypt hash literal', () => {
  const hits = configPhp.match(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g) || [];
  return { ok: hits.length === 0, detail: `${hits.length} bcrypt-shaped literal(s) in admin/config.php` };
});

check('INV2b', 'the sentinel is unsatisfiable (fails password_verify for every input)', () => {
  const m = configPhp.match(/define\('ADMIN_PASSWORD_SENTINEL',\s*'([^']*)'\)/);
  if (!m) return { ok: false, detail: 'ADMIN_PASSWORD_SENTINEL not defined' };
  const isBcrypt = /^\$2[aby]\$\d{2}\$.{53}$/.test(m[1]);
  return { ok: !isBcrypt, detail: `sentinel "${m[1]}" parses as a valid bcrypt digest` };
});

// ── Invariant 3 — mergeContent treats an empty array as a DELETION ───────────
// `Array.isArray(v) && v.length ? v : dv` re-seeded hardcoded defaults whenever
// the owner deleted every row of a section — stale legal text republishing
// itself after he removed it.
check('INV3', 'mergeContent keeps an empty array (no && v.length re-seed)', () => {
  const body = stripJsComments(jsFunctionBody(appJsx, 'mergeContent'));
  const good = /out\[k\]\s*=\s*Array\.isArray\(v\)\s*\?\s*v\s*:\s*dv/.test(body);
  const bad  = /Array\.isArray\(\s*v\s*\)\s*&&\s*v\.length/.test(body);
  return { ok: good && !bad, detail: bad ? 'found the "&& v.length" re-seed' : 'ternary not in expected form' };
});

// ── Invariant 4 — mergeSiteInfo drops blank strings, except SITE_CLEARABLE ───
// settings.php rebuilds site-info.json wholesale, so a missing field arrives as
// "". Spreading those over the defaults produced "© –2026" and href="tel:".
check('INV4a', 'mergeSiteInfo skips blank-string overrides', () => {
  const body = stripJsComments(jsFunctionBody(appJsx, 'mergeSiteInfo'));
  const drops = /typeof\s+val\s*===\s*"string"[\s\S]{0,120}?val\.trim\(\)\s*===\s*""[\s\S]{0,200}?continue;/.test(body);
  return { ok: drops, detail: 'no blank-string continue found in mergeSiteInfo' };
});

check('INV4b', 'mergeSiteInfo consults the SITE_CLEARABLE allow-list', () => {
  const body = stripJsComments(jsFunctionBody(appJsx, 'mergeSiteInfo'));
  const usesList = /SITE_CLEARABLE\.has\(/.test(body);
  const declared = /const SITE_CLEARABLE = new Set\(\[/.test(appJsx);
  return { ok: usesList && declared, detail: 'SITE_CLEARABLE not declared or not consulted' };
});

// ── Invariant 5 — backup ordering ───────────────────────────────────────────
// Neither a name sort nor filemtime() orders these correctly: "-01" sorts
// before ".json", and mtime is second-granular.
check('INV5a', 'backup_path() allocates max-used + 1, not first-free', () => {
  const body = stripPhpComments(phpFunctionBody(configPhp, 'backup_path'));
  const tracksMax = /if\s*\(\s*\$k\[1\]\s*>\s*\$used\s*\)\s*\$used\s*=\s*\$k\[1\];/.test(body);
  const increments = /\$next\s*=\s*\$used\s*\+\s*1;/.test(body);
  return { ok: tracksMax && increments, detail: 'backup_path() does not compute max-used + 1' };
});

check('INV5b', 'backup_list() sorts on the parsed (timestamp, sequence)', () => {
  const body = stripPhpComments(phpFunctionBody(configPhp, 'backup_list'));
  const usesKey = /backup_sort_key\s*\(/.test(body);
  const noMtime = !/filemtime\s*\(/.test(body);
  // A bare sort($files) would be the name-sort bug.
  const noNameSort = !/\bsort\s*\(\s*\$files\s*\)/.test(body);
  return { ok: usesKey && noMtime && noNameSort, detail: 'backup_list() does not sort on backup_sort_key()' };
});

// ── Invariant 6 — form_complete stays LAST in content.php's form ────────────
// It is the max_input_vars truncation sentinel, enforced positionally.
check('INV6', 'form_complete is the last named control in content.php', () => {
  const src = contentPhp;
  const sentinel = src.indexOf('name="form_complete"');
  if (sentinel < 0) return { ok: false, detail: 'form_complete field not found' };
  const formEnd = src.indexOf('</form>', sentinel);
  if (formEnd < 0) return { ok: false, detail: 'no </form> after the sentinel' };
  const after = stripPhpComments(src.slice(sentinel + 'name="form_complete"'.length, formEnd));
  const trailing = after.match(/name\s*=\s*["'][^"']+["']/g) || [];
  return {
    ok: trailing.length === 0,
    detail: `${trailing.length} named control(s) after the sentinel: ${trailing.join(', ')}`,
  };
});

// ── Invariant 7 — ErrorBoundary is keyed on page ────────────────────────────
// Without the key nothing resets `caught`, so one bad product bricked every
// page until a manual reload.
check('INV7', 'ErrorBoundary is keyed on page', () => {
  return { ok: /<ErrorBoundary\s+key=\{page\}/.test(appJsx), detail: '<ErrorBoundary key={page}> not found' };
});

// ── Invariant 8 — providers/chrome render ABOVE the catalog gate ────────────
// They used to sit behind it, so a JSON blip took the phone number off the
// Contact page.
check('INV8', 'SiteInfoProvider/ContentProvider/Navbar/Footer sit above the loading gate', () => {
  const iProvider = appJsx.indexOf('<SiteInfoProvider>');
  const iContent  = appJsx.indexOf('<ContentProvider>');
  const iNavbar   = appJsx.indexOf('<Navbar products={products}');
  const iFooter   = appJsx.indexOf('<Footer />');
  const iGate     = appJsx.indexOf('needsCatalog && loading');
  if ([iProvider, iContent, iNavbar, iFooter, iGate].some((x) => x < 0)) {
    return { ok: false, detail: 'one of the four chrome elements or the gate was not found' };
  }
  // All four must be OUTSIDE (before, and for Footer after) the gate expression.
  const ok = iProvider < iGate && iContent < iGate && iNavbar < iGate && iFooter > iGate;
  return { ok, detail: `provider ${iProvider} content ${iContent} navbar ${iNavbar} gate ${iGate} footer ${iFooter}` };
});

// ── Invariant 9 — skeleton styles live in index.css ─────────────────────────
// GlobalStyles mounts inside the tree that only renders AFTER loading finishes,
// so defining the skeleton only there made it styleless in the exact situation
// it exists for. .ipc-page-header is deliberately in BOTH files.
check('INV9', '.ipc-skeleton and .ipc-page-header are defined in src/index.css', () => {
  const skeleton = /^\.ipc-skeleton\s*\{/m.test(indexCss);
  const header   = /^\.ipc-page-header\s*\{/m.test(indexCss);
  return { ok: skeleton && header, detail: `skeleton:${skeleton} page-header:${header}` };
});

// ── Invariant 10 — contact.php's s() does NOT HTML-escape ───────────────────
// Its destinations are a text/plain email and a JSONL line. strip_tags() ate
// "<1/4 inch and >" out of a real quote request; the double-escape showed the
// owner "&amp;amp;". Escaping belongs at the render boundary (h() in
// inquiries.php). Anything reaching a mail header goes through hdr().
check('INV10a', 'contact.php s() neither escapes nor strips tags', () => {
  const body = stripPhpComments(phpFunctionBody(contactPhp, 's'));
  const escapes = /htmlspecialchars\s*\(|htmlentities\s*\(|strip_tags\s*\(/.test(body);
  return { ok: !escapes, detail: 's() calls an escaping/stripping function' };
});

check('INV10b', 'contact.php hdr() strips CRLF for mail headers', () => {
  const body = stripPhpComments(phpFunctionBody(contactPhp, 'hdr'));
  return { ok: /preg_replace\('\/\[\\r\\n\]\+\/'/.test(body), detail: 'hdr() does not strip CR/LF' };
});

// ── Invariant 11 — an absent Referer is not a rejection ─────────────────────
// Privacy extensions and corporate proxies strip it; rejecting cost real leads.
check('INV11', 'contact.php treats an absent/non-http Referer as same-site', () => {
  const src = stripPhpComments(contactPhp);
  // The whole comparison must be gated on the header being a non-empty string.
  const gated = /\$referer\s*!==\s*''/.test(src) && /is_string\(\$referer\)/.test(src);
  // And an empty parsed host must satisfy the same-site test.
  const emptyHostOk = /\$sameSite\s*=\s*\$refHost\s*===\s*''\s*\|\|/.test(src);
  return { ok: gated && emptyHostOk, detail: `gated:${gated} emptyHostPasses:${emptyHostOk}` };
});

// ── Invariant 12 — require_auth() renders on POST, never redirects ──────────
// A 302 turns the POST into a GET and silently discards everything typed.
check('INV12', 'require_auth() renders a page on POST instead of redirecting', () => {
  const body = stripPhpComments(phpFunctionBody(configPhp, 'require_auth'));
  const postBranch = /REQUEST_METHOD'\]\s*\?\?\s*'GET'\)\s*===\s*'POST'/.test(body);
  const rendersPage = /csrf_fail_page\(/.test(body);
  if (!postBranch || !rendersPage) return { ok: false, detail: 'no POST branch rendering a page' };
  // The Location header must come AFTER the POST branch returns/exits.
  const iPost = body.search(/=== 'POST'/);
  const iLoc  = body.indexOf("header('Location:");
  return { ok: iLoc < 0 || iLoc > iPost, detail: 'Location header is not gated behind the POST branch' };
});

// ── report ──────────────────────────────────────────────────────────────────
let failing = 0;
for (const r of results) {
  if (!r.ok) failing++;
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(7)} ${r.what}${r.ok ? '' : '\n              → ' + r.detail}`);
}
console.log(`\ninvariants ${results.length - failing}/${results.length}`);
process.exit(failing === 0 ? 0 : 1);
