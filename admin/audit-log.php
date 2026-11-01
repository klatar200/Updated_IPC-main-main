<?php
require_once 'config.php';
require_auth();

// Read the audit log written by audit_log() in config.php. Lines are JSONL
// (one JSON object per line), newest at the bottom of the file.
$logPath = __DIR__ . '/admin-log.jsonl';
$entries = [];
// PLAN-13 Phase 6 (§2 F2) — one page of matches at a time. This was 500
// rows on one page; the reader below still stops as soon as it has the page
// it needs, so an early page costs what it did.
$PER_PAGE = 50;
$page = max(1, (int)as_str($_GET['page'] ?? null));

// NEW-N2-11 (audit 2026-09-27) — read BACKWARDS, newest first, across the
// live log and then its rotated archives, until a page of entries matches or a
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

// Filters, via the query string so they work with JavaScript off and survive
// a reload, Back and a bookmark (listfilter.js applies them as you type).
// `q` searches the SKU, the action and the detail. `sku` is the older
// SKU-only filter: links that carry it (and the harness) still work, and it
// fills the search box when `q` is absent.
$filterSku    = as_str($_GET['sku'] ?? null);   // A-5.7 — trim(array) fatals on PHP 8
$filterAction = as_str($_GET['action'] ?? null);
$q            = trim(as_str($_GET['q'] ?? null));
if ($q === '' && $filterSku !== '') $q = $filterSku;

// Parse and FILTER first, and only then page.
//
// This used to slice to the last 500 lines and filter what survived, so the
// filter could only ever search the tail of the file. That is fine until the
// tail stops being the owner's own history: every cool-off expiry lets one
// failed sign-in through to be logged, so a single credential scanner writes
// ~288 lines a day and fills the whole 500-line window in under two days. The
// owner then opens Activity Log, sees nothing but "Sign-in failed", picks
// "edit" from the filter, and is told "No entries match" — while his edits sit
// in the file, just outside the slice. (audit-runs/audit5.md A-5.4)
$filtering = ($q !== '' || $filterAction !== '');
$skip     = ($page - 1) * $PER_PAGE;
$hasOlder = false;
foreach ($logFiles as $file) {
    foreach ($linesBackward($file) as $line) {          // newest first
        $row = json_decode($line, true);
        if (!is_array($row)) continue;
        if ($filterAction !== '' && ($row['action'] ?? '') !== $filterAction) continue;
        if ($q !== '') {
            $hay = ($row['sku'] ?? '') . ' ' . ($row['action'] ?? '') . ' ' . ($row['detail'] ?? '');
            if (stripos((string)$hay, $q) === false) continue;
        }
        if ($skip > 0) { $skip--; continue; }
        if (count($entries) >= $PER_PAGE) { $hasOlder = true; break 2; }
        $entries[] = $row;
    }
    if ($budgetHit) break;
}
$query = ['q' => $q, 'action' => $filterAction];

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
    h1 { font-size: var(--fs-6); font-weight: 800; margin: 0 0 4px; }
    .sub { font-size: var(--fs-2); color: #6b7280; margin: 0; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: var(--fs-2); margin-bottom: 16px; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,45,82,0.06); }
    th { background: #0d2d52; color: rgba(255,255,255,0.7); font-size: var(--fs-1); font-weight: 700; padding: 12px 16px; text-align: left; }
    td { padding: 11px 16px; border-bottom: 1px solid #f0f4f8; font-size: var(--fs-2); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .ts   { color: #6b7280; font-size: var(--fs-1); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .sku  { font-weight: 700; color: #005da3; font-size: var(--fs-1); }
    .action-badge { display: inline-block; font-size: var(--fs-1); font-weight: 700; padding: 3px 8px; border-radius: 20px; }
    .detail { color: #374151; }
    .ip { color: #6b7280; font-size: var(--fs-1); font-family: var(--font-mono); white-space: nowrap; }
    .empty { padding: 40px; text-align: center; color: #6b7280; font-size: var(--fs-3); }
    /* PLAN-13 Phase 6 — one heading row per day inside the table. */
    tr.day-row th { background: #f6f8fb; color: var(--brand-dark); font-size: var(--fs-2); font-weight: 700; padding: 9px 16px; border-bottom: 1px solid #e5e9ee; }
    .reset { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 14px; border-radius: 7px; font-size: var(--fs-2); font-weight: 600; background: #f0f4f8; color: #141414; border: 1px solid #d1d9e0; text-decoration: none; }
    /* UX-6 (admin audit 2026-10-05) — at 390 px the 700 px table pushed the
       whole page sideways and hid the Detail column; it scrolls in its own
       box instead, as on the dashboard. */
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 10px; }
    .col-when { width: 170px; } .col-action { width: 110px; } .col-sku { width: 130px; } .col-ip { width: 120px; }
    /* AUDIT-12 decision 33 (A12-L9-01-4) — on a phone the one-line time took
       159 of the 342 px and pushed Detail, the column that says what happened,
       off the right edge. The date now sits over the time, the fixed column
       widths give way, and the cells are tighter, so Detail starts on the
       first screen; IP, the least-read column, is what scrolls. */
    @media (max-width: 640px) {
      .col-when, .col-action, .col-sku, .col-ip { width: auto; }
      th, td { padding: 9px 8px; }
      .ts { white-space: normal; }
      .ts span { display: block; white-space: nowrap; }
      .detail { min-width: 116px; }
    }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main class="admin-wide">
  <div class="page-header">
    <div>
      <h1>Audit Log</h1>
      <p class="sub">Every change made through the admin — newest first.<?= $budgetHit ? ' Older history was not searched (over ' . (int)(AUDIT_SCAN_BUDGET / 1048576) . ' MB); the archived admin-log-*.jsonl files in the admin folder hold it.' : '' ?></p>
    </div>
  </div>

  <?php if (!file_exists($logPath)): ?>
    <div class="alert">No activity recorded yet. The log file <code>admin/admin-log.jsonl</code> is created on the first save.</div>
  <?php endif; ?>

  <form method="GET" class="list-filters" data-live-filter="#log-results" role="search" aria-label="Filter the audit log">
    <div class="fld fld-grow">
      <label for="log-q">Search</label>
      <input type="search" id="log-q" name="q" value="<?= h($q) ?>" placeholder="A SKU, or a word from the detail — e.g. IP33PO, photo, FAQ" autocomplete="off" />
    </div>
    <div class="fld">
      <label for="log-action">Action</label>
      <select id="log-action" name="action">
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
    </div>
    <button type="submit" class="btn btn-primary filter-submit">Filter</button>
    <?php if ($filtering): ?>
      <a href="audit-log.php" class="reset">Clear</a>
    <?php endif; ?>
  </form>

  <div id="log-results" aria-live="polite">
  <?php if (empty($entries)): ?>
    <div class="empty"><?= $page > 1 ? 'No more entries.' : 'No entries match the current filter.' ?></div>
  <?php else: ?>
    <p class="list-count"><?= $filtering ? 'Matching entries' : 'Entries' ?> <?= ($page - 1) * $PER_PAGE + 1 ?>–<?= ($page - 1) * $PER_PAGE + count($entries) ?>, newest first.</p>
    <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th class="col-when">When</th>
          <th class="col-action">Action</th>
          <th class="col-sku">SKU</th>
          <th>Detail</th>
          <th class="col-ip">IP</th>
        </tr>
      </thead>
      <tbody>
        <?php $lastDay = null; foreach ($entries as $e):
          [$bg, $fg] = action_color($e['action'] ?? '');
          $tsParts = explode(' ', (string)($e['ts'] ?? ''), 2);
          // PLAN-13 Phase 6 — a heading row each time the day changes.
          if ($tsParts[0] !== $lastDay): $lastDay = $tsParts[0]; ?>
        <tr class="day-row"><th colspan="5" scope="colgroup"><?= h(admin_day_label((string)($e['ts'] ?? ''))) ?></th></tr>
          <?php endif; ?>
        <tr>
          <td class="ts"><span><?= h($tsParts[0]) ?></span> <span><?= h($tsParts[1] ?? '') ?></span></td>
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
  <?= admin_pager($page, $hasOlder, $query) ?>
  </div>
</main>
<script src="listfilter.js"></script>
</body>
</html>
