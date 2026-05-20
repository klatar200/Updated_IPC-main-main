<?php
require_once 'config.php';
require_auth();

$errors  = [];
$success = '';
$preview = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? 'preview';

    if ($action === 'preview') {
        // Show preview of what will be imported
        if (!isset($_FILES['json_file']) || $_FILES['json_file']['error'] !== UPLOAD_ERR_OK) {
            $errors[] = 'Please select a JSON file.';
        } else {
            $raw  = file_get_contents($_FILES['json_file']['tmp_name']);
            $data = json_decode($raw, true);
            if (!is_array($data)) {
                $errors[] = 'Invalid JSON format.';
            } else {
                $incoming  = isset($data['products']) ? $data['products'] : $data;
                $existing  = load_products();
                $newCount  = 0;
                $updCount  = 0;
                $skipCount = 0;
                $skipReasons = [];
                foreach ($incoming as $i => $p) {
                    $sku  = trim($p['sku'] ?? $p['id'] ?? '');
                    $name = trim($p['name'] ?? '');
                    $type = trim($p['partType'] ?? '');
                    // #7 — validate required fields
                    if (empty($sku)) {
                        $skipCount++;
                        $skipReasons[] = "Row $i: missing SKU";
                        continue;
                    }
                    if (empty($name)) {
                        $skipCount++;
                        $skipReasons[] = "SKU $sku: missing name";
                        continue;
                    }
                    if (empty($type)) {
                        $skipCount++;
                        $skipReasons[] = "SKU $sku: missing partType";
                        continue;
                    }
                    $idx = find_product($existing, $sku);
                    if ($idx === -1) $newCount++;
                    else            $updCount++;
                }
                $preview = [
                    'total'       => count($incoming),
                    'new'         => $newCount,
                    'updated'     => $updCount,
                    'skipped'     => $skipCount,
                    'skipReasons' => $skipReasons,
                    'json'        => $raw,
                ];
            }
        }
    } elseif ($action === 'confirm') {
        csrf_check();
        $raw  = $_POST['json_data'] ?? '';
        $data = json_decode($raw, true);
        if (!is_array($data)) { $errors[] = 'Invalid JSON data.'; }
        else {
            $incoming = isset($data['products']) ? $data['products'] : $data;
            $existing = load_products();
            // Merge: update existing by SKU, append new — skip invalid rows (#7)
            $mergedCount = 0;
            foreach ($incoming as $p) {
                $pSku  = trim($p['sku'] ?? $p['id'] ?? '');
                $pName = trim($p['name'] ?? '');
                $pType = trim($p['partType'] ?? '');
                if (empty($pSku) || empty($pName) || empty($pType)) continue; // skip invalid
                $idx = find_product($existing, $pSku);
                if ($idx === -1) $existing[] = $p;
                else             $existing[$idx] = $p;
                $mergedCount++;
            }
            if (save_products($existing)) {
                audit_log('import', '*', "Imported $mergedCount products from JSON upload"); // #6
                header('Location: index.php?msg=' . urlencode("Import complete — $mergedCount products merged") . '&type=success');
                exit;
            }
            $errors[] = 'Save failed. Check file permissions.';
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Import JSON</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    header { background: #0d2d52; padding: 0 24px; height: 60px; display: flex; align-items: center; }
    .logo { color: #fff; font-size: 14px; font-weight: 700; text-decoration: none; }
    main { max-width: 700px; margin: 0 auto; padding: 40px 24px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 6px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 28px; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 28px; margin-bottom: 20px; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #005da3; margin: 0 0 20px; padding-bottom: 8px; border-bottom: 1px solid #e5e9ee; }
    label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
    input[type=file] { width: 100%; padding: 10px; border: 2px dashed #d1d9e0; border-radius: 8px; font-size: 13px; cursor: pointer; }
    input[type=file]:hover { border-color: #005da3; }
    .btn { display: inline-flex; align-items: center; padding: 10px 22px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: background 0.15s; }
    .btn-primary { background: #005da3; color: #fff; }
    .btn-primary:hover { background: #004e8c; }
    .btn-secondary { background: #f0f4f8; color: #141414; }
    .btn-green { background: #166534; color: #fff; }
    .stats { display: flex; gap: 12px; margin: 16px 0; }
    .stat { flex: 1; text-align: center; padding: 14px; background: #f0f4f8; border-radius: 8px; }
    .stat-val { font-size: 24px; font-weight: 800; color: #005da3; }
    .stat-lbl { font-size: 11px; color: #6b7280; margin-top: 3px; }
    .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .btn-row { display: flex; gap: 10px; }
  </style>
</head>
<body>
<header><a class="logo" href="index.php">← IPC Admin</a></header>
<main>
  <h1>Import Products from JSON</h1>
  <p class="sub">Upload a <code>products-all.json</code> file (from the OverAI extractor or exported from the admin) to merge or update the catalog.</p>

  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>

  <?php if ($preview): ?>
    <div class="card">
      <div class="card-title">Import Preview</div>
      <div class="stats">
        <div class="stat"><div class="stat-val"><?= $preview['total'] ?></div><div class="stat-lbl">Total in File</div></div>
        <div class="stat"><div class="stat-val" style="color:#166534"><?= $preview['new'] ?></div><div class="stat-lbl">New</div></div>
        <div class="stat"><div class="stat-val" style="color:#b45309"><?= $preview['updated'] ?></div><div class="stat-lbl">Updated</div></div>
        <div class="stat"><div class="stat-val" style="color:#dc2626"><?= $preview['skipped'] ?></div><div class="stat-lbl">Skipped Invalid</div></div>
      </div>
      <?php if (!empty($preview['skipReasons'])): ?>
        <details style="margin-bottom:12px">
          <summary style="font-size:12px;color:#dc2626;cursor:pointer">
            <?= $preview['skipped'] ?> row(s) skipped — click to see why
          </summary>
          <ul style="font-size:12px;color:#6b7280;margin:8px 0 0 16px">
            <?php foreach ($preview['skipReasons'] as $r): ?><li><?= h($r) ?></li><?php endforeach; ?>
          </ul>
        </details>
      <?php endif; ?>
      <p style="font-size:13px;color:#6b7280">Existing products with matching SKUs will be <strong>overwritten</strong>. New SKUs will be <strong>appended</strong>. Nothing will be deleted. Invalid rows are skipped.</p>
      <form method="POST">
        <input type="hidden" name="action"    value="confirm"/>
        <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>"/>
        <input type="hidden" name="json_data" value="<?= htmlspecialchars($preview['json'], ENT_QUOTES, 'UTF-8') ?>"/>
        <div class="btn-row">
          <a href="import.php" class="btn btn-secondary">← Start Over</a>
          <button type="submit" class="btn btn-green">Confirm Import →</button>
        </div>
      </form>
    </div>
  <?php else: ?>
    <div class="card">
      <div class="card-title">Select JSON File</div>
      <form method="POST" enctype="multipart/form-data">
        <input type="hidden" name="action" value="preview"/>
        <label for="json_file">products-all.json or any IPC product JSON file</label>
        <input type="file" id="json_file" name="json_file" accept=".json,application/json" required style="margin-bottom:16px"/>
        <button type="submit" class="btn btn-primary">Preview Import →</button>
      </form>
    </div>
  <?php endif; ?>
</main>
</body>
</html>
