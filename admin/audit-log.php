<?php
require_once 'config.php';
require_auth();

// Read the audit log written by audit_log() in config.php. Lines are JSONL
// (one JSON object per line), newest at the bottom of the file.
$logPath = __DIR__ . '/admin-log.jsonl';
$entries = [];
$truncated = false;
$MAX_LINES = 500; // most recent N — bigger than this and we paginate later

if (file_exists($logPath)) {
    $lines = @file($logPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (is_array($lines)) {
        if (count($lines) > $MAX_LINES) {
            $truncated = true;
            $lines = array_slice($lines, -$MAX_LINES);
        }
        // Newest first.
        $lines = array_reverse($lines);
        foreach ($lines as $line) {
            $row = json_decode($line, true);
            if (is_array($row)) $entries[] = $row;
        }
    }
}

// Optional filter by SKU or action via querystring.
$filterSku    = trim($_GET['sku'] ?? '');
$filterAction = trim($_GET['action'] ?? '');
if ($filterSku !== '' || $filterAction !== '') {
    $entries = array_values(array_filter($entries, function ($e) use ($filterSku, $filterAction) {
        if ($filterSku !== '' && stripos($e['sku'] ?? '', $filterSku) === false) return false;
        if ($filterAction !== '' && ($e['action'] ?? '') !== $filterAction) return false;
        return true;
    }));
}

// Action badge colors
function action_color(string $a): array {
    switch ($a) {
        case 'add':         return ['#dcfce7', '#166534'];
        case 'edit':        return ['#dbeafe', '#1e40af'];
        case 'delete':      return ['#fee2e2', '#991b1b'];
        case 'upload-pdf':  return ['#cffafe', '#155e75'];
        case 'remove-pdf':  return ['#fde68a', '#92400e'];
        case 'import':      return ['#ede9fe', '#5b21b6'];
        default:            return ['#f3f4f6', '#374151'];
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Audit Log</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    header { background: #0d2d52; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
    .logo { color: #fff; font-size: 14px; font-weight: 700; text-decoration: none; }
    nav a { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 13px; margin-left: 16px; }
    nav a:hover { color: #fff; }
    main { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0; }
    .filters { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .filters input, .filters select { padding: 8px 12px; border: 1px solid #d1d9e0; border-radius: 7px; font-size: 13px; outline: none; background: #fff; }
    .filters input:focus, .filters select:focus { border-color: #005da3; }
    .filters button, .filters .reset { padding: 8px 14px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: #005da3; color: #fff; text-decoration: none; }
    .filters .reset { background: #f0f4f8; color: #141414; border: 1px solid #d1d9e0; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,45,82,0.06); }
    th { background: #0d2d52; color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 12px 16px; text-align: left; }
    td { padding: 11px 16px; border-bottom: 1px solid #f0f4f8; font-size: 13px; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .ts   { color: #6b7280; font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .sku  { font-weight: 700; color: #005da3; font-size: 12px; }
    .action-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
    .detail { color: #374151; }
    .ip { color: #9ca3af; font-size: 11px; font-family: monospace; white-space: nowrap; }
    .empty { padding: 40px; text-align: center; color: #9ca3af; font-size: 14px; }
  </style>
</head>
<body>
<header>
  <a class="logo" href="index.php">← IPC Admin</a>
  <nav>
    <a href="index.php">Products</a>
    <a href="auth.php?logout=1">Sign Out</a>
  </nav>
</header>
<main>
  <div class="page-header">
    <div>
      <h1>Audit Log</h1>
      <p class="sub">Every change made through the admin — newest first.<?= $truncated ? ' Showing the most recent ' . $MAX_LINES . ' entries.' : '' ?></p>
    </div>
  </div>

  <?php if (!file_exists($logPath)): ?>
    <div class="alert">No activity recorded yet. The log file <code>admin/admin-log.jsonl</code> is created on the first save.</div>
  <?php endif; ?>

  <form method="GET" class="filters">
    <input type="text" name="sku" placeholder="Filter by SKU…" value="<?= h($filterSku) ?>" />
    <select name="action">
      <option value="">All actions</option>
      <?php foreach (['add','edit','delete','upload-pdf','remove-pdf','import'] as $a): ?>
        <option value="<?= h($a) ?>" <?= $filterAction === $a ? 'selected' : '' ?>><?= h($a) ?></option>
      <?php endforeach; ?>
    </select>
    <button type="submit">Filter</button>
    <?php if ($filterSku !== '' || $filterAction !== ''): ?>
      <a href="audit-log.php" class="reset">Clear</a>
    <?php endif; ?>
  </form>

  <?php if (empty($entries)): ?>
    <div class="empty">No entries match the current filter.</div>
  <?php else: ?>
    <table>
      <thead>
        <tr>
          <th style="width:170px">When</th>
          <th style="width:110px">Action</th>
          <th style="width:130px">SKU</th>
          <th>Detail</th>
          <th style="width:120px">IP</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($entries as $e):
          [$bg, $fg] = action_color($e['action'] ?? '');
        ?>
        <tr>
          <td class="ts"><?= h($e['ts'] ?? '') ?></td>
          <td><span class="action-badge" style="background:<?= $bg ?>;color:<?= $fg ?>"><?= h($e['action'] ?? '') ?></span></td>
          <td><span class="sku"><?= h($e['sku'] ?? '') ?></span></td>
          <td class="detail"><?= h($e['detail'] ?? '') ?></td>
          <td class="ip"><?= h($e['ip'] ?? '') ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</main>
</body>
</html>
