<?php
require_once 'config.php';
require_auth();

// Read the audit log written by audit_log() in config.php. Lines are JSONL
// (one JSON object per line), newest at the bottom of the file.
$logPath = __DIR__ . '/admin-log.jsonl';
$entries = [];
$truncated = false;
$MAX_LINES = 500; // most recent N — bigger than this and we paginate later

// NEW-N2-11 (audit 2026-09-27) — read BACKWARDS, newest first, across the
// live log and then its rotated archives, until $MAX_LINES entries match or a
// hard byte budget runs out. The previous reader loaded only the last 4 MB
// (A-5.4's memory bound), so a filter could not reach anything older, the
// archives were never read, and the header said "Showing the most recent 500"
// while showing none. Memory stays bounded: one 1 MB chunk at a time.
define('AUDIT_SCAN_BUDGET', 64 * 1024 * 1024);
$logFiles = [$logPath];
$archives = glob(__DIR__ . '/admin-log-*.jsonl') ?: [];
rsort($archives, SORT_STRING);                        // names carry the date: newest first
$logFiles = array_merge($logFiles, $archives);
$scanned = 0;
$budgetHit = false;
/** Yields lines of $path, last line first. */
$linesBackward = static function (string $path) use (&$scanned, &$budgetHit) {
    $fh = @fopen($path, 'rb');
    if (!$fh) return;
    $pos = (int)@filesize($path);
    $carry = '';
    while ($pos > 0) {
        if ($scanned >= AUDIT_SCAN_BUDGET) { $budgetHit = true; break; }
        $len = (int)min(1024 * 1024, $pos);
        $pos -= $len;
        fseek($fh, $pos);
        $chunk = (string)fread($fh, $len);
        $scanned += $len;
        $parts = preg_split('/\r\n|\n|\r/', $chunk . $carry);
        $carry = $pos > 0 ? array_shift($parts) : '';   // may be a partial line
        for ($i = count($parts) - 1; $i >= 0; $i--) {
            if ($parts[$i] !== '') yield $parts[$i];
        }
    }
    if ($carry !== '' && !$budgetHit) yield $carry;
    fclose($fh);
};

// Optional filter by SKU or action via querystring.
$filterSku    = as_str($_GET['sku'] ?? null);   // A-5.7 — trim(array) fatals on PHP 8
$filterAction = as_str($_GET['action'] ?? null);

// Parse and FILTER first, and only then keep the newest $MAX_LINES.
//
// This used to slice to the last 500 lines and filter what survived, so the
// filter could only ever search the tail of the file. That is fine until the
// tail stops being the owner's own history: every cool-off expiry lets one
// failed sign-in through to be logged, so a single credential scanner writes
// ~288 lines a day and fills the whole 500-line window in under two days. The
// owner then opens Activity Log, sees nothing but "Sign-in failed", picks
// "edit" from the filter, and is told "No entries match" — while his edits sit
// in the file, just outside the slice. (audit-runs/audit5.md A-5.4)
$filtering = ($filterSku !== '' || $filterAction !== '');
foreach ($logFiles as $file) {
    foreach ($linesBackward($file) as $line) {          // newest first
        $row = json_decode($line, true);
        if (!is_array($row)) continue;
        if ($filtering) {
            if ($filterSku !== '' && stripos((string)($row['sku'] ?? ''), $filterSku) === false) continue;
            if ($filterAction !== '' && ($row['action'] ?? '') !== $filterAction) continue;
        }
        $entries[] = $row;
        if (count($entries) >= $MAX_LINES) { $truncated = true; break 2; }
    }
    if ($budgetHit) break;
}

// Action badge colors
function action_color(string $a): array {
    switch ($a) {
        case 'add':         return ['#dcfce7', '#166534'];
        case 'edit':        return ['#dbeafe', '#1e40af'];
        case 'delete':      return ['#fee2e2', '#991b1b'];
        case 'upload-pdf':  return ['#cffafe', '#155e75'];
        case 'remove-pdf':  return ['#fde68a', '#92400e'];
        case 'upload-image': return ['#ede9fe', '#5b21b6'];
        case 'remove-image': return ['#fee2e2', '#991b1b'];
        case 'site-image':  return ['#ede9fe', '#5b21b6'];
        case 'marketing-pdf': return ['#cffafe', '#155e75'];
        case 'settings':    return ['#e0f2fe', '#075985'];
        case 'content':     return ['#e0f2fe', '#075985'];
        case 'restore':     return ['#fef3c7', '#92400e'];
        case 'password':    return ['#f3e8ff', '#6b21a8'];
        // A9 — authentication events. Green/grey read as routine; the failed
        // attempt is red because a run of them is the one thing on this page
        // that wants the owner's eye. (audit-runs/audit1.md A-09)
        case 'sign-in':        return ['#dcfce7', '#166534'];
        case 'sign-out':       return ['#f3f4f6', '#374151'];
        case 'sign-in-failed': return ['#fee2e2', '#991b1b'];
        default:            return ['#f3f4f6', '#374151'];
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Audit Log</title>
  <?= admin_head() ?>
  <style>
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
    /* UX-6 (admin audit 2026-10-05) — at 390 px the 700 px table pushed the
       whole page sideways and hid the Detail column; it scrolls in its own
       box instead, as on the dashboard. */
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 10px; }
  </style>
</head>
<body>
<?php $navActive = 'auditlog'; include 'nav.php'; ?>
<main class="admin-wide">
  <div class="page-header">
    <div>
      <h1>Audit Log</h1>
      <p class="sub">Every change made through the admin — newest first.<?= $truncated ? ' Showing the most recent ' . $MAX_LINES . ($filtering ? ' matching' : '') . ' entries.' : '' ?><?= $budgetHit ? ' Older history was not searched (over ' . (int)(AUDIT_SCAN_BUDGET / 1048576) . ' MB); the archived admin-log-*.jsonl files in the admin folder hold it.' : '' ?></p>
    </div>
  </div>

  <?php if (!file_exists($logPath)): ?>
    <div class="alert">No activity recorded yet. The log file <code>admin/admin-log.jsonl</code> is created on the first save.</div>
  <?php endif; ?>

  <form method="GET" class="filters">
    <?php /* A12 — aria-label rather than a visible <label>. This is a one-line
             inline filter bar and a placeholder is not an accessible name:
             assistive tech announced both controls unnamed. Visible labels
             would push the bar onto two rows, which the sprint's guardrail
             rules out, and the names here say exactly what the placeholder and
             the first option already say on screen.
             (audit-runs/audit1.md A-12) */ ?>
    <input type="text" name="sku" placeholder="Filter by SKU…" aria-label="Filter by SKU" value="<?= h($filterSku) ?>" />
    <select name="action" aria-label="Filter by action">
      <option value="">All actions</option>
      <?php /* 'import' was listed for a feature that does not exist anywhere in
               the codebase — the filter always returned "No entries match".
               Replaced with the actions that are actually written.
               (DEPLOY_READINESS_v2 4.34) */ ?>
      <?php /* A15 — read from config.php's IPC_AUDIT_ACTIONS rather than a
               literal here. The literal was the third copy of this list and
               nothing compared it to the call sites; lint.php now does, in
               both directions. (audit-runs/audit1.md A-15) */ ?>
      <?php foreach (IPC_AUDIT_ACTIONS as $a): ?>
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
    <div class="table-scroll">
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
    </div>
  <?php endif; ?>
</main>
</body>
</html>
