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

exit(($fail + $jsFail) === 0 ? 0 : 1);
