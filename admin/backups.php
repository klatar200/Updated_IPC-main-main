<?php
require_once 'config.php';
require_auth();

/**
 * Backup restore — every save writes a timestamped backup (keep 5 per file);
 * this page lists them and restores one with a single click. Restoring goes
 * through the same save_*() helpers, so the current state is itself backed up
 * first — a restore can always be undone by restoring the newer backup.
 */

// Which live files have backups, and how to load/save them.
$TARGETS = [
    'products-all' => [
        'label'   => 'Product Catalog',
        'live'    => PRODUCTS_JSON,
        'restore' => function (array $data): bool {
            // Accept both plain-array and {products:[...]} backup shapes.
            $products = isset($data['products']) && is_array($data['products']) ? $data['products'] : $data;
            return save_products($products);
        },
    ],
    'site-info' => [
        'label'   => 'Business Details',
        'live'    => SITE_INFO_JSON,
        'restore' => function (array $data): bool { return save_site_info($data); },
    ],
    'content' => [
        'label'   => 'Page Content',
        'live'    => CONTENT_JSON,
        'restore' => function (array $data): bool { return save_content($data); },
    ],
];

$dataDir = dirname(PRODUCTS_JSON);
$errors  = [];
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $file = basename($_POST['backup'] ?? ''); // basename() blocks path traversal

    // The filename must match exactly one of our known backup patterns.
    if (!preg_match('/^(products-all|site-info|content)\.backup\.(\d{8}-\d{6})\.json$/', $file, $m)) {
        $errors[] = 'Unrecognized backup filename.';
    } else {
        $key  = $m[1];
        $path = $dataDir . '/' . $file;
        if (!file_exists($path)) {
            $errors[] = 'That backup no longer exists (it may have been rotated out).';
        } else {
            $data = json_decode((string)file_get_contents($path), true);
            if (!is_array($data)) {
                $errors[] = 'The backup file is not valid JSON — restore aborted, nothing was changed.';
            } elseif (($TARGETS[$key]['restore'])($data)) {
                audit_log('restore', $key, 'Restored ' . $TARGETS[$key]['label'] . ' from ' . $file);
                $success = $TARGETS[$key]['label'] . ' restored from ' . $m[2]
                         . '. The website will reflect it within ~60 seconds.'
                         . ' (The state from just before this restore was backed up too, so you can undo.)';
            } else {
                $errors[] = 'Restore failed — check file permissions on the data/ folder.';
            }
        }
    }
}

// Gather backups per target, newest first.
function backups_for(string $key, string $dataDir): array {
    $files = glob($dataDir . '/' . $key . '.backup.*.json') ?: [];
    rsort($files); // timestamped names sort chronologically
    $out = [];
    foreach ($files as $f) {
        $base = basename($f);
        if (preg_match('/\.backup\.(\d{8})-(\d{6})\.json$/', $base, $m)) {
            $nice = substr($m[1], 0, 4) . '-' . substr($m[1], 4, 2) . '-' . substr($m[1], 6, 2)
                  . ' ' . substr($m[2], 0, 2) . ':' . substr($m[2], 2, 2) . ':' . substr($m[2], 4, 2);
        } else {
            $nice = $base;
        }
        $out[] = ['file' => $base, 'when' => $nice, 'size' => filesize($f)];
    }
    return $out;
}

function nice_size(int $b): string {
    return $b >= 1048576 ? round($b / 1048576, 1) . ' MB' : round($b / 1024) . ' KB';
}

$navActive = 'backups';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Backups</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    main { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 24px; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #005da3; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 1px solid #e5e9ee; }
    .row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f4f8; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .when { font-weight: 600; }
    .size { color: #9ca3af; font-size: 12px; }
    .row form { margin-left: auto; }
    .btn { display: inline-flex; align-items: center; padding: 7px 16px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: 1px solid #d1d9e0; background: #fff; color: #141414; }
    .btn:hover { border-color: #005da3; background: #eef4fb; }
    .none { color: #9ca3af; font-size: 13px; }
    .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
    .note { font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main>
  <h1>Backups</h1>
  <p class="sub">A backup is saved automatically every time you change products, business details, or page content (the 5 most recent are kept per file). Restore rolls the live file back to that moment — and backs up the current state first, so a restore can always be undone.</p>

  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>
  <?php if ($success): ?>
    <div class="alert-success">✅ <?= h($success) ?></div>
  <?php endif; ?>

  <?php foreach ($TARGETS as $key => $t): $list = backups_for($key, $dataDir); ?>
  <div class="card">
    <div class="card-title"><?= h($t['label']) ?></div>
    <?php if (empty($list)): ?>
      <p class="none">No backups yet — one is created automatically the next time you save.</p>
    <?php else: ?>
      <?php foreach ($list as $b): ?>
      <div class="row">
        <span class="when"><?= h($b['when']) ?></span>
        <span class="size"><?= h(nice_size((int)$b['size'])) ?></span>
        <form method="POST" data-confirm="Restore <?= h($t['label']) ?> to its state from <?= h($b['when']) ?>? The current version is backed up first, so this can be undone.">
          <input type="hidden" name="backup" value="<?= h($b['file']) ?>">
          <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
          <button type="submit" class="btn">Restore this version</button>
        </form>
      </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>
  <?php endforeach; ?>

  <p class="note">Backups live in the <code>data/</code> folder on the server and are not publicly accessible.</p>
</main>
<script src="confirm.js"></script>
</body>
</html>
