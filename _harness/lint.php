<?php
/**
 * php -l over every PHP file that ships, plus `node --check` over the admin's
 * client-side JS. Baseline: 19 PHP files, 0 failing; 8 admin JS files, 0 failing.
 *
 * Scope is the SOURCE tree (admin/, public/), never _harness/site — linting the
 * mirror would report a stale copy as green.
 */

$root = dirname(__DIR__);

$phpFiles = [];
foreach ([$root . '/admin', $root . '/public'] as $dir) {
    if (!is_dir($dir)) continue;
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir)) as $f) {
        if ($f->isFile() && strtolower($f->getExtension()) === 'php') {
            $phpFiles[] = $f->getPathname();
        }
    }
}
sort($phpFiles);

$fail = 0;
foreach ($phpFiles as $f) {
    $out = [];
    $rc  = 0;
    exec('php -l ' . escapeshellarg($f) . ' 2>&1', $out, $rc);
    $rel = substr($f, strlen($root) + 1);
    if ($rc !== 0) {
        $fail++;
        echo "FAIL  $rel\n      " . implode("\n      ", $out) . "\n";
    }
}
echo "php -l                    " . count($phpFiles) . " files, $fail failing\n";

$jsFiles = glob($root . '/admin/*.js') ?: [];
sort($jsFiles);
$jsFail = 0;
foreach ($jsFiles as $f) {
    $out = [];
    $rc  = 0;
    exec('node --check ' . escapeshellarg($f) . ' 2>&1', $out, $rc);
    $rel = substr($f, strlen($root) + 1);
    if ($rc !== 0) {
        $jsFail++;
        echo "FAIL  $rel\n      " . implode("\n      ", $out) . "\n";
    }
}
echo "node --check              " . count($jsFiles) . " admin JS files, $jsFail failing\n";

// The three data files must stay parseable — a save that writes broken JSON
// takes the whole public site down, and the React side's jsonOrThrow() would
// only surface it at runtime.
$counts = [];
foreach ([
    'content'      => $root . '/data/content.json',
    'site-info'    => $root . '/data/site-info.json',
    'products-all' => $root . '/data/products-all.json',
] as $name => $p) {
    $data = json_decode((string)@file_get_contents($p), true);
    if (!is_array($data)) { $fail++; echo "FAIL  data/$name.json does not parse\n"; continue; }
    $counts[] = "$name " . count($data);
}
echo "JSON parse                " . implode(' / ', $counts) . " entries\n";

// ── NB-copy drift ───────────────────────────────────────────────────────────
// admin/content.php's $COPY_GROUPS and src/App.jsx's COPY_DEFAULTS are declared
// independently, and mergeContent() only reads keys that exist in the defaults.
// A field the admin offers with no matching default is a silent data-loss path:
// Rick edits it, gets a green "Content saved", and the site never changes.
//
// This runs here so drift is a FAILING CHECK rather than a future audit finding.
// It is the check that stops the two lists diverging the first time someone adds
// a heading to one side only. (PLAN-2 NB-copy)
$driftOut = [];
$driftRc  = 0;
exec('node ' . escapeshellarg(__DIR__ . '/copydrift.js') . ' 2>&1', $driftOut, $driftRc);
$summary = '';
foreach ($driftOut as $line) {
    if (strpos($line, 'copydrift ') === 0) { $summary = $line; break; }
}
if ($driftRc !== 0) {
    $fail++;
    echo "FAIL  copy-key drift\n      " . implode("\n      ", $driftOut) . "\n";
} else {
    echo "copy-key drift            " . ($summary ?: 'OK') . "\n";
}

/**
 * PLAN-6 item 1 — the product families exist as a PHP default
 * (IPC_DEFAULT_FAMILIES in admin/config.php) and a JS default (FAMILY_ORDER in
 * src/App.jsx). Two copies across two languages, kept honest the same way
 * $COPY_GROUPS and COPY_DEFAULTS are: by failing here when they disagree.
 *
 * Before this item there were THREE copies — those two plus a $partTypes literal
 * in each of add.php and edit.php — with nothing checking any of them. The two
 * PHP literals are gone; what is new is that the remaining pair cannot diverge
 * silently.
 */
$phpFam = [];
if (preg_match('/const IPC_DEFAULT_FAMILIES = \[(.*?)\];/s', (string)@file_get_contents(__DIR__ . '/../admin/config.php'), $m)) {
    preg_match_all("/'([^']+)'/", $m[1], $mm);
    $phpFam = $mm[1];
}
$jsFam = [];
if (preg_match('/const FAMILY_ORDER = \[(.*?)\];/s', (string)@file_get_contents(__DIR__ . '/../src/App.jsx'), $m)) {
    preg_match_all('/"([^"]+)"/', $m[1], $mm);
    $jsFam = $mm[1];
}
if (!$phpFam || !$jsFam) {
    $fail++;
    echo "FAIL  family drift\n      could not read one of the two lists (php "
       . count($phpFam) . ", js " . count($jsFam) . ") — has one been renamed?\n";
} elseif ($phpFam !== $jsFam) {
    $fail++;
    echo "FAIL  family drift\n      admin/config.php IPC_DEFAULT_FAMILIES and src/App.jsx FAMILY_ORDER disagree\n"
       . "      php: " . json_encode($phpFam) . "\n"
       . "      js : " . json_encode($jsFam) . "\n";
} else {
    echo "family drift              " . count($jsFam) . " families, PHP and JS identical\n";
}

// ── approval drift ──────────────────────────────────────────────────────────
// The same copydrift problem as the families: twelve approval names exist in
// admin/config.php (IPC_APPROVALS) and in src/App.jsx (APPROVALS), and PHP and
// JS cannot share a constant without a build step. This checks the NAMES and
// their order. It deliberately does not compare the regexes — those are
// checked by behaviour, in plan7-approvals.js, which diffs what each side
// derives for all 42 products. Comparing pattern source across two languages
// would fail on spelling differences that change nothing and pass on ones that
// change everything (it already caught PHP's json_encode escaping "U/L" to
// "U\/L", which no source diff would have shown).
$phpAp = [];
if (preg_match('/const IPC_APPROVALS = \[(.*?)\];/s', (string)@file_get_contents(__DIR__ . '/../admin/config.php'), $m)) {
    preg_match_all("/'([^']+)'/", $m[1], $mm);
    $phpAp = $mm[1];
}
$jsAp = [];
if (preg_match('/const APPROVALS = \[(.*?)\n\];/s', (string)@file_get_contents(__DIR__ . '/../src/App.jsx'), $m)) {
    preg_match_all('/\["([^"]+)",/', $m[1], $mm);
    $jsAp = $mm[1];
}
if (!$phpAp || !$jsAp) {
    $fail++;
    echo "FAIL  approval drift\n      could not read one of the two lists (php "
       . count($phpAp) . ", js " . count($jsAp) . ") — has one been renamed?\n";
} elseif ($phpAp !== $jsAp) {
    $fail++;
    echo "FAIL  approval drift\n      admin/config.php IPC_APPROVALS and src/App.jsx APPROVALS disagree\n"
       . "      php: " . json_encode($phpAp) . "\n"
       . "      js : " . json_encode($jsAp) . "\n";
} else {
    echo "approval drift            " . count($jsAp) . " approvals, PHP and JS identical\n";
}

// ── photo-default drift ─────────────────────────────────────────────────────
// PLAN-9 item 1 — the five siteImages default paths exist in PHP
// (content.php's $COPY_GROUPS 'default' entries, which prefill an absent key)
// and in JS (App.jsx's COPY_DEFAULTS.siteImages, which renders an absent key).
// If they disagree, the admin's first save silently REPOINTS a photo: the
// prefill writes the PHP value into content.json and the site stops painting
// the JS one. Same two-languages problem as the families and approvals above,
// held honest the same way.
$phpPh = [];
$src = (string)@file_get_contents(__DIR__ . '/../admin/content.php');
if (preg_match("/'siteImages'\s*=>\s*\['title'[^\]]*'fields'\s*=>\s*\[(.*?)\]\],/s", $src, $m)) {
    preg_match_all("/'key'\s*=>\s*'([^']+)'.*?'default'\s*=>\s*'([^']+)'/", $m[1], $mm, PREG_SET_ORDER);
    foreach ($mm as $pair) $phpPh[$pair[1]] = $pair[2];
}
$jsPh = [];
if (preg_match('/siteImages:\s*\{(.*?)\},/s', (string)@file_get_contents(__DIR__ . '/../src/App.jsx'), $m)) {
    preg_match_all('/(\w+):\s*"([^"]+)"/', $m[1], $mm, PREG_SET_ORDER);
    foreach ($mm as $pair) $jsPh[$pair[1]] = $pair[2];
}
if (count($phpPh) !== 5 || count($jsPh) !== 5) {
    $fail++;
    echo "FAIL  photo-default drift\n      could not read the two five-entry lists (php "
       . count($phpPh) . ", js " . count($jsPh) . ") — has one moved?\n";
} elseif ($phpPh !== $jsPh) {
    $fail++;
    echo "FAIL  photo-default drift\n      content.php siteImages defaults and App.jsx COPY_DEFAULTS.siteImages disagree\n"
       . "      php: " . json_encode($phpPh) . "\n"
       . "      js : " . json_encode($jsPh) . "\n";
} else {
    echo "photo-default drift       5 slot defaults, PHP and JS identical\n";
}

// The two $partTypes literals this item removed must not come back.
$reintroduced = [];
foreach (['add.php', 'edit.php'] as $f) {
    if (preg_match('/\$partTypes\s*=\s*\[/', (string)@file_get_contents(__DIR__ . '/../admin/' . $f))) {
        $reintroduced[] = $f;
    }
}
if ($reintroduced) {
    $fail++;
    echo "FAIL  family literals\n      a hardcoded \$partTypes list is back in: "
       . implode(', ', $reintroduced) . " — read ipc_product_families() instead\n";
} else {
    echo "family literals           none in add.php or edit.php\n";
}

// ── doc drift: every _harness/ path a binding document names must exist ─────
//
// Added 2026-08-11. This is the fifth drift check and it exists because the
// same defect kept recurring in the documents rather than the code. In two
// days, four separate claims in GUARDRAILS.md were found stale — the 30-suite
// regression baseline against a 65-suite harness, `_harness/negctl.php` (never
// tracked, in a rule telling people to run it), the `:8123` server row naming
// an ini that breaks contact.php, and "_harness/ is gitignored". Each was
// found by a human or an audit noticing in passing; none by a check.
//
// A document that names a file which does not exist sends an executor to run
// something that cannot run, and the failure looks like their mistake. The
// three files scanned are the ones an executor is told to treat as binding or
// authoritative, so a stale path in them is the expensive kind.
//
// Scope is deliberately narrow, and each exclusion below was forced by a false
// positive this check produced on its own first run:
//
//   - Paths under the three GENERATED directories (`_harness/site/`,
//     `pristine/`, `out/`) are skipped. They legitimately do not exist at rest
//     — `site/admin/config.local.php` is deleted at the end of every session by
//     design — so requiring them would fail on a clean checkout.
//   - A reference inside a PARAGRAPH that flags the file as gone is a
//     correction, not a claim. Matching on the containing paragraph rather than
//     the containing line, because these corrections wrap: the sentence that
//     retires `negctl.php` puts "never been tracked" and "superseded" on two
//     different lines.
//   - Only backticked paths with a real extension. Prose like "_harness/ is
//     gitignored" is not a path.
//   - WHATS_LEFT.md is NOT scanned. It is append-only and deliberately holds
//     references to files that no longer exist; that is its job.
//
// BARE filenames are matched too, and that is not a refinement — without it the
// check missed the defect it was written for. The `:8123` server row names its
// ini as `php-extra.ini`, not `_harness/php-extra.ini`, so a prefix-only pattern
// scanned straight past it. The v1 mutation test "passed" only because the
// mutation was written path-qualified; restoring the original row verbatim was
// still green. A bare name is resolved by BASENAME anywhere in the repo, which
// is what keeps `config.php`, `contact.php` and `vite.config.js` from tripping
// it — they live outside `_harness/` but they do exist.
$docs = [
    __DIR__ . '/../plans/GUARDRAILS.md',
    __DIR__ . '/../plans/README.md',
    __DIR__ . '/../CLAUDE.md',
];
$generated = ['_harness/site/', '_harness/pristine/', '_harness/out/'];
// "**Corrected <date>.**" is this document's own marker for a paragraph that
// exists to describe what a claim USED to say. Those paragraphs quote the dead
// name on purpose. Keying on the convention rather than growing the vocabulary
// list: the keyword list below already missed "this row said X" and "are not
// tracked in the repo", and every miss is a false positive that pressures the
// next person to delete the check.
$retired = '/^\*\*Corrected\b|\b(deleted|never (been )?tracked|no longer|used to|superseded|does not exist|not in the repo)\b/i';

// Every basename in the repo, for resolving bare references. Skips the
// directories that are generated or vendored — a name that only resolves inside
// node_modules/ or dist/ has not been shown to exist as a source file.
$repoBasenames = [];
$skipDirs = ['.git', 'node_modules', 'dist', 'site', 'pristine', 'out'];
$it = new RecursiveIteratorIterator(
    new RecursiveCallbackFilterIterator(
        new RecursiveDirectoryIterator(__DIR__ . '/..', FilesystemIterator::SKIP_DOTS),
        function ($f) use ($skipDirs) {
            return !($f->isDir() && in_array($f->getFilename(), $skipDirs, true));
        }
    )
);
foreach ($it as $f) {
    if ($f->isFile()) $repoBasenames[$f->getFilename()] = true;
}
$missingRefs = [];
$refCount = 0;
foreach ($docs as $doc) {
    $text = (string)@file_get_contents($doc);
    if ($text === '') continue;
    $rel = basename(dirname($doc)) === 'plans' ? 'plans/' . basename($doc) : basename($doc);
    // Per OCCURRENCE, not per file. Excusing a path file-wide because one
    // paragraph retires it would mean a single "X has been deleted" note
    // permanently licenses every other mention of X in that document —
    // including the stale row that made the note necessary. Caught by the
    // check's own mutation test: re-adding the retired ini to the :8123 row
    // did not fail until this loop was inverted.
    $seen = [];
    foreach (preg_split('/\n\s*\n/', $text) as $p) {
        preg_match_all('/`(_harness\/[A-Za-z0-9._\/-]+\.[A-Za-z0-9]+)`/', $p, $mPath);
        // Bare names are limited to the three extensions the harness actually
        // uses. Widening past these buys nothing and starts matching prose.
        preg_match_all('/`([A-Za-z0-9._-]+\.(?:ini|js|php))`/', $p, $mBare);
        $refs = array_merge($mPath[1], $mBare[1]);
        if (!$refs) continue;
        $isRetirement = (bool)preg_match($retired, ltrim($p));
        foreach (array_unique($refs) as $ref) {
            foreach ($generated as $g) {
                if (strncmp($ref, $g, strlen($g)) === 0) continue 2;
            }
            if (!isset($seen[$ref])) { $seen[$ref] = true; $refCount++; }
            $exists = strpos($ref, '/') !== false
                ? file_exists(__DIR__ . '/../' . $ref)
                : isset($repoBasenames[$ref]);
            if ($exists) continue;
            if ($isRetirement) continue;
            $key = "$rel -> $ref";
            if (!in_array($key, $missingRefs, true)) $missingRefs[] = $key;
        }
    }
}
if ($missingRefs) {
    $fail++;
    echo "FAIL  doc drift\n      a binding document names a harness file that does not exist:\n";
    foreach ($missingRefs as $r) echo "        $r\n";
    echo "      fix the document, or restore the file — an executor told to run a\n"
       . "      missing script gets a failure that looks like their own mistake\n";
} else {
    echo "doc drift                 $refCount harness file refs in 3 binding docs, all resolve\n";
}

// ── section drift: WHATS_LEFT.md must not reuse a section number ─────────────
//
// Added 2026-08-12, immediately after doing this. WHATS_LEFT.md is append-only
// and 4,100+ lines; the numbering had reached `## 1j.` and three sections landed
// on the same day reusing `1c`, `1d` and `1e`. Nothing noticed, because nothing
// reads the whole file at once — which is exactly the property that makes a
// duplicate expensive: `§1d` in a cross-reference silently points at whichever
// one the reader scrolls to first.
//
// This is the only structural rule the file has, so it is the only one checked.
// The file's CONTENT is deliberately unconstrained — it holds stale references
// on purpose, which is why the doc-drift check above skips it entirely.
// No exemptions, and the list is deliberately empty. The one it briefly held --
// `## 4j.` used for BOTH Plan 3 and Plan 4 evidence -- was resolved on
// 2026-08-12: Plan 4's block became `## 4k.` and its eight cross-references
// moved with it (WHATS_LEFT section 1n). The stale-allowance branch below is
// what forced it to be dropped here rather than left sitting as decoration.
//
// If one is ever needed again, pin it to the COUNT, not the number:
// ['4j' => 2], never ['4j']. An allowance that excuses the number goes on
// excusing a third and a fourth -- caught by this check's own mutation test,
// which appended one and stayed green.
$knownDupes = [];
$wl = (string)@file_get_contents(__DIR__ . '/../WHATS_LEFT.md');
$counts = [];
$headings = [];
if (preg_match_all('/^(##+)\s+(\d+[a-z]?)\.\s/m', $wl, $hm, PREG_SET_ORDER)) {
    foreach ($hm as $h) {
        $counts[$h[2]] = ($counts[$h[2]] ?? 0) + 1;
        $headings[$h[1] . ' ' . $h[2]] = true;
    }
}
$dupes = [];
foreach ($counts as $n => $c) {
    if ($c > ($knownDupes[$n] ?? 1)) $dupes[$n] = $c;
}
if ($dupes) {
    $fail++;
    echo "FAIL  section drift\n      WHATS_LEFT.md reuses a section number:\n";
    foreach ($dupes as $n => $c) echo "        §$n appears $c times\n";
    echo "      renumber the newer one — a cross-reference to a reused number\n"
       . "      points at whichever section the reader reaches first\n";
} else {
    // A stale exemption is the same drift class the check exists to stop: once
    // §4j is renumbered, the allowance must go with it or it silently licenses
    // the next collision on that number.
    $stale = [];
    foreach ($knownDupes as $n => $allowed) {
        if (($counts[$n] ?? 0) < $allowed) $stale[] = $n;
    }
    if ($stale) {
        $fail++;
        echo "FAIL  section drift\n      a known-duplicate allowance is no longer needed: §"
           . implode(' §', $stale) . "\n"
           . "      the collision was fixed — drop it from \$knownDupes, or it will\n"
           . "      license the next reuse of that number\n";
    } else {
        echo "section drift             " . count($headings) . " WHATS_LEFT sections, no number reused"
           . ($knownDupes ? " (unresolved, allowed: §" . implode(' §', array_keys($knownDupes)) . ")" : "")
           . "\n";
    }
}

exit(($fail + $jsFail) === 0 ? 0 : 1);
