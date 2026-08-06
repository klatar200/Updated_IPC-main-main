<?php
/**
 * Run admin/config.php's product_reference_resolves() over a set of needles and
 * print one verdict per line, for _harness/skuparity.js to diff against the
 * JS side.
 *
 * Usage: php _harness/skuparity.php <needle> [<needle> ...]
 */

// config.php starts a session and defines paths relative to itself; including
// it from the CLI is fine and is what the admin pages do.
require_once dirname(__DIR__) . '/admin/config.php';

$products = json_decode((string)file_get_contents(__DIR__ . '/pristine/products-all.json'), true);
if (isset($products['products'])) $products = $products['products'];
if (!is_array($products)) { fwrite(STDERR, "cannot load pristine catalog\n"); exit(1); }

$needles = array_slice($argv, 1);
foreach ($needles as $needle) {
    echo (product_reference_resolves($products, $needle) ? '1' : '0'), "\n";
}
