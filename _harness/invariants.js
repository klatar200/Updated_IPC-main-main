/**
 * The twelve invariants from CLAUDE.md, asserted against the SOURCE.
 *
 * REBUILT 2026-08-06. The original _harness/ was gitignored and never
 * committed, so it did not survive the clone. This is a reconstruction from
 * CLAUDE.md's invariant list and the code each one guards — it is NOT the
 * original file, and its check count (16) is its own, not the 15 the earlier
 * sessions reported. Treat a green run here as "the twelve invariants hold",
 * not as "the historical suite passed". Current count: 19 (INV2c and
 * INV5c, 2026-10-13, run PHP rather than read it).
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
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

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

/**
 * Run PHP against a COPY of the tree's admin/config.php, alone in a temp dir —
 * i.e. a fresh deploy with no config.local.php beside it. For the invariants
 * whose break can be re-worded past any textual check (AUDIT-12
 * A12-L13-W1-R2-1-2 / -4): these assert what the code DOES.
 */
function phpWithConfig(code) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-invphp-'));
  try {
    fs.copyFileSync(path.join(root, 'admin', 'config.php'), path.join(dir, 'config.php'));
    const r = spawnSync('php', ['-d', 'display_errors=stderr', '-r',
      `$_SERVER['REQUEST_METHOD'] = 'GET'; require ${JSON.stringify(path.join(dir, 'config.php'))}; ${code}`,
      dir], { encoding: 'utf8', timeout: 20000 });
    if (r.error) throw r.error;
    const out = (r.stdout || '').trim().split('\n').pop();
    if (r.status !== 0 || !out) throw new Error(`php exited ${r.status}: ${(r.stderr || '').trim().slice(0, 200)}`);
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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

// INV2a/b read the text; this one asks PHP. A default written any other way
// (e.g. define('ADMIN_PASSWORD_HASH', password_hash('changeme', …))) passed
// both while 'changeme' signed in to a fresh install (A12-L13-W1-R2-1-2).
check('INV2c', 'with no config.local.php the admin has no usable password', () => {
  const out = phpWithConfig(`echo json_encode([ADMIN_PASSWORD_HASH === ADMIN_PASSWORD_SENTINEL, ADMIN_PASSWORD_CONFIGURED]);`);
  const [isSentinel, configured] = JSON.parse(out);
  return { ok: isSentinel === true && configured === false, detail: `hash is sentinel: ${isSentinel}, ADMIN_PASSWORD_CONFIGURED: ${configured}` };
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
  if (!drops) return { ok: false, detail: 'no blank-string continue found in mergeSiteInfo' };
  // The shape alone passed with the condition neutralised (`… && false`), so
  // RUN the real function too (AUDIT-12 A12-M-1): the declaration of
  // SITE_CLEARABLE and mergeSiteInfo are read out of App.jsx and executed over
  // stub defaults, with its two prose post-passes stubbed to identity. A blank
  // phone must keep the default; a blank clearable field (fax) must clear.
  const decl = /const SITE_CLEARABLE = new Set\(\[[\s\S]*?\]\);/.exec(stripJsComments(appJsx));
  if (!decl) return { ok: false, detail: 'SITE_CLEARABLE declaration not found' };
  const header = /function\s+mergeSiteInfo\s*\([^)]*\)/.exec(appJsx)[0];
  const SITE_DEFAULTS = {
    contact: { phone: 'DEFAULT-PHONE', phoneDial: 'DEFAULT-DIAL', email: 'default@example.com', fax: 'DEFAULT-FAX' },
    company: { name: 'DEFAULT-NAME', shortName: 'DEFAULT-SHORT', description: '' },
    certifications: { iso: 'ISO 9001', other: [] },
    about: {},
  };
  const merge = new Function('SITE_DEFAULTS', 'withIsoLabel', 'withBusinessFacts',
    `${decl[0]}\n${header} ${jsFunctionBody(appJsx, 'mergeSiteInfo')}\nreturn mergeSiteInfo;`)(SITE_DEFAULTS, (x) => x, (x) => x);
  const out = merge({ contact: { phone: '', phoneDial: ' ', email: '', fax: '' }, company: { name: '', shortName: '' } });
  const kept = out.contact.phone === 'DEFAULT-PHONE' && out.contact.phoneDial === 'DEFAULT-DIAL'
    && out.contact.email === 'default@example.com' && out.company.name === 'DEFAULT-NAME';
  const cleared = out.contact.fax === '' && out.company.shortName === '';
  return { ok: kept && cleared, detail: `run over blank fields: phone "${out.contact.phone}" email "${out.contact.email}" name "${out.company.name}" (must stay default); fax "${out.contact.fax}" shortName "${out.company.shortName}" (must clear)` };
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

// INV5a reads the text; this one runs backup_path() over three backups that
// share one second (sequences 0, 1, 2) and asserts it allocates a NEW name,
// sequence 3. A one-word `break;` in the max loop left INV5a and lowsA2 green
// while a save overwrote an existing backup (A12-L13-W1-R2-1-4).
check('INV5c', 'backup_path() never returns an existing backup name', () => {
  const out = phpWithConfig(`$d = $argv[1] . '/b'; @mkdir($d);
    foreach (['', '-01', '-02'] as $n) file_put_contents("$d/p.backup.20990101-000000$n.json", 'x');
    $p = backup_path($d, 'p'); echo json_encode([basename($p), file_exists($p)]);`);
  const [name, exists] = JSON.parse(out);
  return { ok: name === 'p.backup.20990101-000000-03.json' && exists === false, detail: `allocated ${name}${exists ? ' (ALREADY EXISTS)' : ''}` };
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
// It also takes resetKey={productParam} (NEW-N1-1: Back/Forward/"Browse All"
// inside /products are one route, so only resetKey clears it there). Comments
// are stripped first: a JSX comment quoting the old text used to satisfy the
// check while the live boundary was unkeyed (AUDIT-12 A12-L13-17-1).
check('INV7', 'ErrorBoundary is keyed on page and reset on productParam', () => {
  const live = stripJsComments(appJsx);
  const keyed = /<ErrorBoundary\s+key=\{page\}/.test(live);
  const reset = /<ErrorBoundary\s+key=\{page\}\s+resetKey=\{productParam\b/.test(live);
  return { ok: keyed && reset, detail: `key={page}:${keyed} resetKey={productParam…}:${reset} (comments stripped)` };
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
  // The gate is the whole `{needsCatalog && loading ? … : … : renderPage()}`
  // expression: brace-match it. Comparing against the gate's START let a Footer
  // moved INTO the render branch pass, since that is textually after the start
  // too (AUDIT-12 A12-L13-17-2).
  const gStart = appJsx.lastIndexOf('{', iGate);
  let depth = 0, gEnd = -1;
  for (let i = gStart; i < appJsx.length; i++) {
    if (appJsx[i] === '{') depth++;
    else if (appJsx[i] === '}') { depth--; if (depth === 0) { gEnd = i; break; } }
  }
  if (gEnd < 0) return { ok: false, detail: 'the gate expression is unbalanced' };
  const footerInGate = appJsx.slice(gStart, gEnd).includes('<Footer');
  // All four must be OUTSIDE (before, and for Footer after) the gate expression.
  const ok = iProvider < gStart && iContent < gStart && iNavbar < gStart && iFooter > gEnd && !footerInGate;
  return { ok, detail: `provider ${iProvider} content ${iContent} navbar ${iNavbar} gate ${gStart}-${gEnd} footer ${iFooter}${footerInGate ? ' (a <Footer is inside the gate)' : ''}` };
});

// ── Invariant 9 — skeleton styles live in index.css ─────────────────────────
// GlobalStyles mounts inside the tree that only renders AFTER loading finishes,
// so defining the skeleton only there made it styleless in the exact situation
// it exists for. .ipc-page-header is deliberately in BOTH files.
// CSS comments are stripped first: a rule commented out with /* */ still
// started its line and passed (AUDIT-12 A12-L13-W1-G4-1).
check('INV9', '.ipc-skeleton and .ipc-page-header are defined in src/index.css', () => {
  const css = indexCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const skeleton = /^\.ipc-skeleton\s*\{/m.test(css);
  const header   = /^\.ipc-page-header\s*\{/m.test(css);
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
  if (!gated || !emptyHostOk) return { ok: false, detail: `gated:${gated} emptyHostPasses:${emptyHostOk}` };
  // The text alone stayed green with the non-http scheme filter deleted
  // (Gmail for Android refused) and with the cross-site refusal deleted
  // (AUDIT-12 A12-L13-W1-G5-1). So RUN contact.php's own referer block under
  // PHP CLI with its two side effects stubbed, for four referrers.
  const start = src.search(/if\s*\(\s*is_string\(\$referer\)/);
  let depth = 0, end = -1;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (start < 0 || end < 0) return { ok: false, detail: 'referer block not found' };
  const tmp = path.join(require('os').tmpdir(), `ipc-inv11-${process.pid}.php`);
  fs.writeFileSync(tmp, '<?php\nfunction s($v) { return (string)$v; }\nfunction ipc_partial_entry(...$a) { return $a; }\n'
    + 'function ipc_log_inquiry($e) {}\nfunction respond($code, $body) { echo $code; exit; }\n'
    + "$bizName = 'IPC'; $bizPhone = '0'; $ip = '127.0.0.1'; $host = 'www.example.com'; $referer = $argv[1];\n"
    + src.slice(start, end) + '\necho 200;\n');
  const cases = [['', '200'], ['android-app://com.google.android.gm', '200'], ['https://example.com/contact', '200'], ['https://evil.example/?x=www.example.com', '403']];
  const got = cases.map(([ref]) => (require('child_process').spawnSync('php', [tmp, ref], { encoding: 'utf8' }).stdout || '').trim());
  fs.rmSync(tmp, { force: true });
  const okRun = cases.every(([, want], i) => got[i] === want);
  return { ok: okRun, detail: `absent / android-app / same-site / foreign referrer answered ${got.join(' / ')} (want 200 / 200 / 200 / 403)` };
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
