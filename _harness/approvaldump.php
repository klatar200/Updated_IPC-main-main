<?php
/**
 * Dump PHP's derived approvals for every product, as JSON, keyed by sku.
 *
 * `plan7-approvals.js` diffs this against what the browser derives. The two
 * implementations are compared **behaviourally**, per product, rather than by
 * diffing regex source across two languages — `contrastparity.js` exists
 * because two implementations of the same maths had already drifted once, and
 * comparing patterns character-by-character across PHP and JS would fail on
 * spelling differences that do not change behaviour while passing on ones that
 * do.
 *
 * Reads pristine/, never data/. Prints JSON to stdout and nothing else.
 *
 * Usage: php _harness/approvaldump.php
 */

require_once __DIR__ . '/../admin/config.php';

$raw = file_get_contents(__DIR__ . '/pristine/products-all.json');
$products = json_decode($raw, true);
if (!is_array($products)) {
    fwrite(STDERR, "could not read pristine/products-all.json\n");
    exit(1);
}

$out = [];
foreach ($products as $p) {
    if (!is_array($p)) {
        continue;
    }
    $sku = (string)($p['sku'] ?? $p['id'] ?? '');
    if ($sku === '') {
        continue;
    }
    $out[$sku] = ipc_product_approvals($p);
}

echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
