<?php
require_once 'config.php';
require_auth();

/**
 * Backup restore — every save that CHANGES the file writes a timestamped
 * backup (keep BACKUP_KEEP per file, see config.php); a save whose encoded
 * JSON matches what is already on disk writes neither the file nor a backup
 * (F2/F1 in config.php), so this list holds BACKUP_KEEP distinct versions
 * rather than BACKUP_KEEP copies of the same one.
 * This page lists them and restores one with a single click. Restoring goes
 * through the same save_*() helpers, so the current state is itself backed up
 * first — a restore can always be undone by restoring the newer backup.
 *
 * Note the interaction: restoring a version identical to the live file is now
 * a no-op too. That is correct — there is nothing to roll back to — and it
 * still reports success rather than an error.
 */

// Which live files have backups, and how to load/save them.
$TARGETS = [
    'products-all' => [
        'label'   => 'Product Catalog',
        'live'    => PRODUCTS_JSON,
        'restore' => function (array $data): bool {
            // Accept both plain-array and {products:[...]} backup shapes.
            $products = isset($data['products']) && is_array($data['products']) ? $data['products'] : $data;
            return save_products($products, true);   // AUDIT-12 decision 29: refuse without a safety backup
        },
    ],
    'site-info' => [
        'label'   => 'Business Details',
        'live'    => SITE_INFO_JSON,
        'restore' => function (array $data): bool { return save_site_info($data, true); },
    ],
    'content' => [
        'label'   => 'Page Content',
        'live'    => CONTENT_JSON,
        'restore' => function (array $data): bool { return save_content($data, true); },
    ],
];

$dataDir = dirname(PRODUCTS_JSON);
$errors  = [];
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $file = basename(as_str($_POST['backup'] ?? null)); // basename() blocks path traversal; as_str() blocks backup[]=x (A-5.7)

    // The filename must match exactly one of our known backup patterns.
    // The -NN suffix is the same-second collision guard added in config.php's
    // backup_path(); accept it or the newer backups become un-restorable.
    // \d{2,4}: backup_path() counts past 99 now instead of switching to a random
    // hex suffix (AUDIT_v3_FINDINGS NB13). The hex alternative stays so any file
    // an earlier revision already wrote is still restorable. This pattern and
    // backup_sort_key()'s must accept the same set — a mismatch makes a backup
    // that exists on disk un-restorable through the UI.
    if (!preg_match('/^(products-all|site-info|content)\.backup\.(\d{8}-\d{6})(?:-\d{2,4}|-[0-9a-f]{6})?\.json$/', $file, $m)) {
        $errors[] = 'Unrecognized backup filename.';
    } else {
        $key  = $m[1];
        $path = $dataDir . '/' . $file;
        if (!file_exists($path)) {
            // A12-L9-02-W5-3 — say what to do, in the owner's words.
            $errors[] = 'That saved version is no longer kept (only the most recent ' . (int)BACKUP_KEEP . ' of each item are). '
                      . 'Nothing was changed. Reload this page and pick another version.';
        } else {
            $data = json_decode((string)file_get_contents($path), true);
            if (!is_array($data)) {
                $errors[] = 'That saved version is damaged and cannot be used. Nothing was changed. '
                          . 'Pick the next-older version of the same item.';
            } elseif (($TARGETS[$key]['restore'])($data)) {
                // ADM-3 — a catalog restore also brings back the data sheets
                // and photos a delete moved aside (config.php file_to_trash()).
                $filesBack = $key === 'products-all' ? restore_trashed_files(load_products()) : [];
                audit_log('restore', $key, 'Restored ' . $TARGETS[$key]['label'] . ' from ' . $file
                          . ($filesBack ? ' | Files brought back: ' . implode(', ', $filesBack) : ''));
                // Identify the exact backup, not just the second — two backups
                // written in the same second are otherwise indistinguishable in
                // this message (AUDIT_v3_FINDINGS NB17). UX-9 (admin audit
                // 2026-10-05): in the list's own words — "2026-10-05 09:09:04
                // (#2 that second)" — not the raw "20261005-090904 (…json)";
                // the exact file name stays in the audit log above.
                $when = substr($m[2], 0, 4) . '-' . substr($m[2], 4, 2) . '-' . substr($m[2], 6, 2)
                      . ' ' . substr($m[2], 9, 2) . ':' . substr($m[2], 11, 2) . ':' . substr($m[2], 13, 2);
                if (preg_match('/-(\d{2,4})\.json$/', $file, $seq)) $when .= ' (#' . ltrim($seq[1], '0') . ' that second)';
                $success = $TARGETS[$key]['label'] . ' restored to how it was at ' . $when
                         . '. The website will reflect it within ~60 seconds.'
                         . ($filesBack ? ' Data sheets and photos brought back: ' . implode(', ', $filesBack) . '.' : '')
                         . ' (The state from just before this restore was backed up too, so you can undo.)';
            } else {
                // AUDIT-12 decisions 29/31 — a restore whose safety copy of the
                // current version could not be written is refused (the disk is
                // full); any other failure gets the shared sentence.
                $errors[] = save_failed_message();
            }
        }
    }
}

// Gather backups per target, newest first.
function backups_for(string $key, string $dataDir): array {
    // Newest first, by mtime — see backup_list() in config.php for why a name
    // sort is wrong once the same-second collision suffix exists.
    $files = array_reverse(backup_list($dataDir, $key));
    $out = [];
    // A hand-placed file that does not match the pattern is NOT restorable — the
    // POST handler rejects it with "Unrecognized backup filename". Listing it
    // with a working-looking Restore button meant the one control on the page
    // could only ever fail. Mark it and drop the button instead.
    // The -NN sequence is also surfaced: two backups written in the same second
    // rendered as the same "2026-08-04 14:03:11" string, so choosing between
    // them was a coin flip — and each wrong guess is itself a save.
    // (AUDIT_v3_FINDINGS NB17)
    foreach ($files as $f) {
        $base = basename($f);
        $restorable = true;
        if (preg_match('/\.backup\.(\d{8})-(\d{6})(?:-(\d{2,4}|[0-9a-f]{6}))?\.json$/', $base, $m)) {
            $nice = substr($m[1], 0, 4) . '-' . substr($m[1], 4, 2) . '-' . substr($m[1], 6, 2)
                  . ' ' . substr($m[2], 0, 2) . ':' . substr($m[2], 2, 2) . ':' . substr($m[2], 4, 2);
            if (!empty($m[3])) $nice .= ' (#' . ltrim($m[3], '0') . ' that second)';
        } else {
            $nice = $base;
            $restorable = false;
        }
        // Show WHAT is in the backup, not just a byte count. Five near-identical
        // timestamps from one afternoon are indistinguishable by size, so a
        // restore was a guess — and each guess is itself a save.
        $items = null;
        $decoded = json_decode((string)@file_get_contents($f), true);
        if (is_array($decoded)) {
            if ($key === 'products-all') {
                $arr = isset($decoded['products']) && is_array($decoded['products']) ? $decoded['products'] : $decoded;
                $items = count($arr) . ' product' . (count($arr) === 1 ? '' : 's');
            } elseif ($key === 'content') {
                $n = 0;
                foreach ($decoded as $k2 => $v2) { if (is_array($v2) && $k2 !== 'copy') $n += count($v2); }
                $items = $n . ' content row' . ($n === 1 ? '' : 's');
            } else {
                $name = $decoded['company']['name'] ?? '';
                $phone = $decoded['contact']['phone'] ?? '';
                $items = trim($name . ($phone !== '' ? ' · ' . $phone : ''));
                if ($items === '') $items = null;
            }
        } else {
            $items = 'unreadable — not valid JSON';
        }
        $out[] = ['file' => $base, 'when' => $nice, 'size' => filesize($f), 'items' => $items, 'restorable' => $restorable];
    }
    return $out;
}

/**
 * PLAN-13 Phase 6 (§2 F3) — what each version is from. A column of identical
 * "Restore This Version" buttons with only a time said nothing about what a
 * restore would undo, although the audit log knows: save_*() writes the
 * backup of the CURRENT file a moment before it writes the change, and the
 * page that saved logs the change straight after. So the first unclaimed
 * audit line of a matching action within 15 seconds after a backup's stamp is
 * the change that version was saved ahead of. No match (an old backup whose
 * log line has rotated out of reach, or a save that logged nothing) shows
 * nothing rather than a guess.
 *
 * $lists: key => backups_for() output. Returns key => [file => sentence].
 */
function backup_change_notes(array $lists): array {
    $ACTIONS = [
        'products-all' => ['add', 'edit', 'delete', 'upload-pdf', 'remove-pdf', 'upload-image', 'remove-image', 'restore'],
        'site-info'    => ['settings', 'site-image', 'marketing-pdf', 'restore'],
        'content'      => ['content', 'site-image', 'marketing-pdf', 'restore'],
    ];
    $LABEL = [
        'add' => 'Product added', 'edit' => 'Product edited', 'delete' => 'Product deleted',
        'upload-pdf' => 'Data sheet uploaded', 'remove-pdf' => 'Data sheet removed',
        'upload-image' => 'Photo uploaded', 'remove-image' => 'Photo removed',
        'settings' => 'Business Details saved', 'content' => 'Page Content saved',
        'site-image' => 'Site image or logo changed', 'marketing-pdf' => 'Catalog or brochure PDF changed',
        'restore' => 'An older version restored',
    ];
    $stampOf = static function (string $file): ?int {
        if (!preg_match('/\.backup\.(\d{8})-(\d{6})/', $file, $m)) return null;
        $t = strtotime(substr($m[1], 0, 4) . '-' . substr($m[1], 4, 2) . '-' . substr($m[1], 6, 2) . ' '
                     . substr($m[2], 0, 2) . ':' . substr($m[2], 2, 2) . ':' . substr($m[2], 4, 2));
        return $t === false ? null : $t;
    };
    $oldest = PHP_INT_MAX;
    foreach ($lists as $list) foreach ($list as $b) { $t = $stampOf($b['file']); if ($t !== null && $t < $oldest) $oldest = $t; }
    if ($oldest === PHP_INT_MAX) return [];

    // Read the log newest first, live file then archives, until it is older
    // than the oldest backup (or 32 MB have been read).
    $wanted = array_flip(array_merge(...array_values($ACTIONS)));
    $lines = [];
    $files = glob(__DIR__ . '/admin-log-*.jsonl') ?: [];
    rsort($files, SORT_STRING);
    array_unshift($files, __DIR__ . '/admin-log.jsonl');
    $read = 0;
    foreach ($files as $path) {
        $fh = @fopen($path, 'rb');
        if (!$fh) continue;
        $pos = (int)@filesize($path);
        $carry = '';
        $done = false;
        while ($pos > 0 && !$done && $read < 32 * 1024 * 1024) {
            $len = (int)min(1024 * 1024, $pos);
            $pos -= $len;
            fseek($fh, $pos);
            $chunk = (string)fread($fh, $len);
            $read += $len;
            $parts = explode("\n", $chunk . $carry);
            $carry = $pos > 0 ? array_shift($parts) : '';
            for ($i = count($parts) - 1; $i >= 0; $i--) {
                $e = json_decode($parts[$i], true);
                if (!is_array($e)) continue;
                $t = strtotime((string)($e['ts'] ?? ''));
                if ($t === false) continue;
                if ($t < $oldest - 60) { $done = true; break; }
                if (isset($wanted[$e['action'] ?? ''])) $lines[] = ['t' => $t] + $e;
            }
        }
        fclose($fh);
        if ($done || $read >= 32 * 1024 * 1024) break;
    }
    $lines = array_reverse($lines);   // oldest first

    $out = [];
    foreach ($lists as $key => $list) {
        $acts = array_flip($ACTIONS[$key] ?? []);
        $asc = array_reverse($list);   // backups_for() is newest first
        $used = [];
        foreach ($asc as $b) {
            $t = $stampOf($b['file']);
            if ($t === null) continue;
            foreach ($lines as $i => $e) {
                if (isset($used[$i]) || !isset($acts[$e['action']])) continue;
                if ($e['action'] === 'restore' && ($e['sku'] ?? '') !== $key) continue;
                if ($e['t'] < $t) continue;
                if ($e['t'] > $t + 15) break;
                $used[$i] = true;
                $sku = (string)($e['sku'] ?? '');
                $what = $LABEL[$e['action']] . (($sku !== '' && $sku !== '-' && $sku !== $key && $e['action'] !== 'restore') ? ' — ' . $sku : '');
                $detail = trim((string)($e['detail'] ?? ''));
                if (strlen($detail) > 140) $detail = rtrim(substr($detail, 0, 137)) . '…';
                $out[$key][$b['file']] = ['what' => $what, 'detail' => $detail];
                break;
            }
        }
    }
    return $out;
}

function nice_size(int $b): string {
    return $b >= 1048576 ? round($b / 1048576, 1) . ' MB' : round($b / 1024) . ' KB';
}

?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Backups</title>
  <?= admin_head() ?>
  <style>
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .card-title { font-size: var(--fs-4); font-weight: 700; color: var(--brand-dark); margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid #e5e9ee; line-height: 1.3; }
    /* UX-5 (admin audit 2026-10-05) — wraps: at 390 px the Restore button,
       the page's one action, ran 39 px off the right edge. */
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 0; border-bottom: 1px solid #f0f4f8; font-size: var(--fs-2); }
    .row:last-child { border-bottom: none; }
    .when { font-weight: 600; }
    .size { color: #6b7280; font-size: var(--fs-1); }
    .items { color: #374151; font-size: var(--fs-1); background: #f0f4f8; border-radius: 5px; padding: 2px 8px; }
    .row form { margin-left: auto; }
    .btn { display: inline-flex; align-items: center; padding: 7px 16px; border-radius: 7px; font-size: var(--fs-2); font-weight: 600; cursor: pointer; text-decoration: none; border: 1px solid #d1d9e0; background: #fff; color: #141414; }
    .btn:hover { border-color: #005da3; background: #eef4fb; }
    .none { color: #6b7280; font-size: var(--fs-2); }
    .note { font-size: var(--fs-1); color: #4b5563; }
    /* PLAN-13 Phase 6 — what the version was saved ahead of. */
    .why { flex-basis: 100%; order: 10; font-size: var(--fs-2); color: var(--ink-2); line-height: 1.45; }
    .why strong { color: var(--ink); }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main class="admin-wide">
  <h1>Backups</h1>
  <p class="sub">A backup is saved automatically every time you <em>change</em> products, business details, or page content (the <?= (int)BACKUP_KEEP ?> most recent are kept per file). Restore rolls the live file back to that moment — and backs up the current state first, so a restore can always be undone. Pressing Save without having changed anything writes nothing and uses no slot, so every entry below is a genuinely different version. Note that photo uploads, PDF uploads, adds and deletes all count as changes, so these still fill up faster than you would expect.</p>

  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>
  <?php if ($success): ?>
    <div class="alert-success">✅ <?= h($success) ?></div>
  <?php endif; ?>

  <?php $lists = [];
        foreach ($TARGETS as $key => $t) $lists[$key] = backups_for($key, $dataDir);
        $notes = backup_change_notes($lists); ?>
  <?php foreach ($TARGETS as $key => $t): $list = $lists[$key]; ?>
  <div class="card">
    <div class="card-title"><?= h($t['label']) ?></div>
    <?php if (empty($list)): ?>
      <p class="none">No backups yet — one is created automatically the next time you save.</p>
    <?php else: ?>
      <?php foreach ($list as $b): ?>
      <div class="row">
        <span class="when"><?= h($b['when']) ?></span>
        <?php if (!empty($b['items'])): ?><span class="items"><?= h($b['items']) ?></span><?php endif; ?>
        <span class="size"><?= h(nice_size((int)$b['size'])) ?></span>
        <?php $why = $notes[$key][$b['file']] ?? null; if ($why): ?>
        <div class="why">This is how it was just before: <strong><?= h($why['what']) ?></strong><?= $why['detail'] !== '' ? ' — ' . h($why['detail']) : '' ?></div>
        <?php endif; ?>
        <?php if ($b['restorable']): ?>
        <form method="POST" data-confirm="Restore <?= h($t['label']) ?> to its state from <?= h($b['when']) ?><?= !empty($b['items']) ? ' (' . h($b['items']) . ')' : '' ?><?= $why ? ', just before: ' . h($why['what']) : '' ?>? The current version is backed up first, so this can be undone.">
          <input type="hidden" name="backup" value="<?= h($b['file']) ?>">
          <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
          <button type="submit" class="btn">Restore This Version</button>
        </form>
        <?php else: ?>
        <span class="size" style="margin-left:auto;color:#dc2626">Not a backup this page wrote — cannot restore it from here.</span>
        <?php endif; ?>
      </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>
  <?php endforeach; ?>

  <p class="note">Backups live in the <code>site-data/</code> folder on the server and are not publicly accessible.</p>
</main>
<script src="confirm.js"></script>
</body>
</html>
