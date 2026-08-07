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

exit(($fail + $jsFail) === 0 ? 0 : 1);
