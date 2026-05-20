<?php
require_once 'config.php';
require_auth();

$products = load_products();
$message  = $_GET['msg'] ?? '';
$msgType  = in_array($_GET['type'] ?? '', ['success', 'error']) ? $_GET['type'] : 'success'; // whitelist

// Group by partType
$grouped = [];
foreach ($products as $p) {
    $type = $p['partType'] ?? 'Other';
    $grouped[$type][] = $p;
}
ksort($grouped);
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Products</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body  { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    /* Header */
    header { background: #0d2d52; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
    .logo  { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .logo-mark { width: 36px; height: 36px; background: #005da3; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; color: #fff; }
    .logo-title { color: #fff; font-size: 13px; font-weight: 700; }
    .logo-sub   { color: rgba(255,255,255,0.5); font-size: 10px; }
    nav a   { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 13px; margin-left: 20px; }
    nav a:hover { color: #fff; }
    .logout { color: rgba(255,255,255,0.5) !important; }
    /* Layout */
    main { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .page-header h1 { font-size: 22px; font-weight: 800; margin: 0; }
    .page-header p  { font-size: 13px; color: #6b7280; margin: 2px 0 0; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: background 0.15s; }
    .btn-primary  { background: #005da3; color: #fff; }
    .btn-primary:hover  { background: #004e8c; }
    .btn-sm { padding: 5px 12px; font-size: 12px; }
    .btn-edit   { background: rgba(0,93,163,0.08); color: #005da3; }
    .btn-edit:hover { background: rgba(0,93,163,0.15); }
    .btn-danger { background: rgba(220,38,38,0.08); color: #dc2626; }
    .btn-danger:hover { background: rgba(220,38,38,0.15); }
    .btn-pdf    { background: rgba(0,190,242,0.1); color: #0369a1; }
    .btn-pdf:hover { background: rgba(0,190,242,0.2); }
    /* Stats bar */
    .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat  { background: #fff; border: 1px solid #e5e9ee; border-radius: 10px; padding: 14px 20px; flex: 1; min-width: 140px; }
    .stat-val { font-size: 22px; font-weight: 800; color: #005da3; line-height: 1; }
    .stat-lbl { font-size: 11px; color: #6b7280; margin-top: 3px; }
    /* Alert */
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; }
    .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .alert-error   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    /* Table */
    .section { margin-bottom: 32px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #005da3; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #e5e9ee; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,45,82,0.06); }
    th    { background: #0d2d52; color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 12px 16px; text-align: left; }
    td    { padding: 12px 16px; border-bottom: 1px solid #f0f4f8; font-size: 13px; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(0,93,163,0.02); }
    .sku  { font-weight: 700; color: #005da3; font-size: 12px; }
    .type-badge { background: rgba(17,158,200,0.1); color: #0369a1; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }
    .actions { display: flex; gap: 6px; align-items: center; }
    /* Search */
    .search-bar { display: flex; gap: 10px; margin-bottom: 20px; }
    .search-bar input { flex: 1; padding: 10px 14px; border: 1px solid #d1d9e0; border-radius: 8px; font-size: 13px; outline: none; }
    .search-bar input:focus { border-color: #005da3; }
  </style>
</head>
<body>
<header>
  <a class="logo" href="index.php">
    <div class="logo-mark">IPC</div>
    <div>
      <div class="logo-title">IPC Admin</div>
      <div class="logo-sub">Product Manager</div>
    </div>
  </a>
  <nav>
    <a href="add.php">+ Add Product</a>
    <a href="import.php">Import JSON</a>
    <a href="audit-log.php">Audit Log</a>
    <a href="/" target="_blank" rel="noopener" title="Opens the public site in a new tab">View Live Site ↗</a>
    <a href="auth.php?logout=1" class="logout">Sign Out</a>
  </nav>
</header>
<main>
  <div class="page-header">
    <div>
      <h1>Product Catalog</h1>
      <p><?= count($products) ?> products across <?= count($grouped) ?> categories</p>
    </div>
    <a href="add.php" class="btn btn-primary">+ Add Product</a>
  </div>

  <?php if ($message): ?>
    <div class="alert alert-<?= h($msgType) ?>"><?= h($message) ?></div>
  <?php endif; ?>

  <!-- Stats -->
  <div class="stats">
    <div class="stat"><div class="stat-val"><?= count($products) ?></div><div class="stat-lbl">Total Products</div></div>
    <div class="stat"><div class="stat-val"><?= count($grouped) ?></div><div class="stat-lbl">Categories</div></div>
    <div class="stat">
      <div class="stat-val"><?= count(array_filter($products, fn($p) => !empty($p['pdfUrl']))) ?></div>
      <div class="stat-lbl">With PDF</div>
    </div>
    <div class="stat">
      <div class="stat-val"><?= count(array_filter($products, fn($p) => empty($p['pdfUrl']))) ?></div>
      <div class="stat-lbl">Missing PDF</div>
    </div>
  </div>

  <!-- Products by category -->
  <?php foreach ($grouped as $type => $items): ?>
  <div class="section">
    <div class="section-title"><?= h($type) ?> (<?= count($items) ?>)</div>
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Product Name</th>
          <th>Temp Rating</th>
          <th>PDF</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($items as $p): ?>
        <tr>
          <td><span class="sku"><?= h($p['sku'] ?? $p['id'] ?? '—') ?></span></td>
          <td><?= h($p['name'] ?? '—') ?></td>
          <td style="font-size:12px;color:#6b7280"><?= h($p['operatingTemp'] ?? '—') ?></td>
          <td>
            <?php if (!empty($p['pdfUrl'])): ?>
              <a href="<?= h($p['pdfUrl']) ?>" target="_blank" class="btn btn-sm btn-pdf">View PDF</a>
            <?php else: ?>
              <span style="color:#9ca3af;font-size:12px;">None</span>
            <?php endif; ?>
          </td>
          <td>
            <div class="actions">
              <a href="edit.php?sku=<?= urlencode($p['sku'] ?? $p['id'] ?? '') ?>" class="btn btn-sm btn-edit">Edit</a>
              <a href="upload-pdf.php?sku=<?= urlencode($p['sku'] ?? $p['id'] ?? '') ?>" class="btn btn-sm btn-pdf">PDF</a>
              <a href="/?page=products&amp;productId=<?= urlencode($p['sku'] ?? $p['id'] ?? '') ?>"
                 target="_blank" rel="noopener"
                 class="btn btn-sm btn-edit"
                 title="Open this product on the public website in a new tab">View ↗</a>
              <a href="delete.php?sku=<?= urlencode($p['sku'] ?? $p['id'] ?? '') ?>"
                 class="btn btn-sm btn-danger"
                 onclick="return confirm('Delete <?= h(addslashes($p['sku'] ?? '')) ?>? This cannot be undone.')">Delete</a>
            </div>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endforeach; ?>
</main>
</body>
</html>
