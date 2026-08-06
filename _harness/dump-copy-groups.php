<?php
/**
 * Dump admin/content.php's $COPY_GROUPS as JSON, by isolating the literal and
 * eval'ing it — NOT by regex. content.php cannot simply be included: it calls
 * require_auth() and renders a page.
 *
 * Used by _harness/copydrift.js, which compares these group.key pairs against
 * src/App.jsx's COPY_DEFAULTS. An unmatched key is a silent data-loss path:
 * mergeContent iterates Object.keys(defaults), so a posted key with no default
 * is written to content.json, reported saved, and never rendered.
 */

// IPC_ROOT lets copydrift-selftest.js point this at a mutated copy of the tree.
$ipcRoot = getenv('IPC_ROOT') ?: dirname(__DIR__);
$src = file_get_contents($ipcRoot . '/admin/content.php');
if ($src === false) { fwrite(STDERR, "cannot read admin/content.php\n"); exit(1); }

$start = strpos($src, '$COPY_GROUPS = [');
if ($start === false) { fwrite(STDERR, "\$COPY_GROUPS not found\n"); exit(1); }

// Bracket-match to the closing "];" so nothing is assumed about formatting.
$open = strpos($src, '[', $start);
$depth = 0; $end = null;
for ($i = $open, $n = strlen($src); $i < $n; $i++) {
    $c = $src[$i];
    if ($c === '[') $depth++;
    elseif ($c === ']') { $depth--; if ($depth === 0) { $end = $i; break; } }
    // Skip over string literals so a bracket inside a label cannot unbalance us.
    elseif ($c === "'" || $c === '"') {
        $q = $c;
        for ($i++; $i < $n; $i++) {
            if ($src[$i] === '\\') { $i++; continue; }
            if ($src[$i] === $q) break;
        }
    }
}
if ($end === null) { fwrite(STDERR, "\$COPY_GROUPS is unbalanced\n"); exit(1); }

$literal = substr($src, $open, $end - $open + 1);

// The 'page' fields reference $PAGE_OPTIONS; only group/key pairs matter here.
$PAGE_OPTIONS = [];
$COPY_GROUPS = null;
eval('$COPY_GROUPS = ' . $literal . ';');

if (!is_array($COPY_GROUPS)) { fwrite(STDERR, "eval produced no array\n"); exit(1); }

$out = [];
foreach ($COPY_GROUPS as $group => $cfg) {
    foreach (($cfg['fields'] ?? []) as $f) {
        if (!isset($f['key'])) continue;
        $out[] = [
            'group' => $group,
            'key'   => $f['key'],
            'type'  => $f['type'] ?? '',
            'label' => $f['label'] ?? '',
        ];
    }
}
echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
