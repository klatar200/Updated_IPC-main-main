<?php
/**
 * Dump admin/config.php's contrast verdicts for a list of colors, for
 * _harness/contrastparity.js to diff against the JS implementations.
 *
 * Usage: php _harness/contrastparity.php <hex> [<hex> ...]
 * Output, one line per color:  <ratio-to-6dp>|<ink>
 */
require_once dirname(__DIR__) . '/admin/config.php';

foreach (array_slice($argv, 1) as $hex) {
    $ink = ipc_ink_for([$hex]);
    printf("%.6f|%s\n", ipc_contrast_ratio($ink, $hex), $ink);
}
