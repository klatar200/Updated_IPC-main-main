<?php
require_once 'config.php';
require_auth();

$sku      = $_GET['sku'] ?? '';
$products = load_products();
$idx      = find_product($products, $sku);

if ($idx === -1) {
    header('Location: index.php?msg=Product+not+found&type=error');
    exit;
}

$product = $products[$idx];

// POST = confirmed delete — verify CSRF token
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    array_splice($products, $idx, 1);
    if (save_products($products)) {
        audit_log('delete', $sku, 'Product deleted: ' . ($product['name'] ?? '')); // #6
        header('Location: index.php?msg=' . urlencode($sku . ' deleted successfully') . '&type=success');
        exit;
    }
    header('Location: index.php?msg=' . urlencode('Delete failed — check file permissions') . '&type=error');
    exit;
}

// GET = confirmation page
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><title>IPC Admin — Delete <?= h($sku) ?></title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f0f4f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 12px; padding: 40px; max-width: 440px; width: 100%; box-shadow: 0 4px 24px rgba(0,45,82,0.12); text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 800; color: #141414; margin: 0 0 8px; }
    p  { font-size: 14px; color: #6b7280; margin: 0 0 28px; }
    .product-name { font-weight: 600; color: #141414; }
    .actions { display: flex; gap: 10px; justify-content: center; }
    .btn { padding: 10px 24px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: background 0.15s; }
    .btn-danger { background: #dc2626; color: #fff; }
    .btn-danger:hover { background: #b91c1c; }
    .btn-cancel { background: #f0f4f8; color: #141414; }
    .btn-cancel:hover { background: #e5e9ee; }
  </style>
</head>
<body>
<div class="card">
  <div class="icon">⚠️</div>
  <h1>Delete this product?</h1>
  <p>
    <span class="product-name"><?= h($sku) ?> — <?= h($product['name'] ?? '') ?></span><br><br>
    This will permanently remove it from <code>products-all.json</code>.
    The PDF file (if any) will <em>not</em> be deleted from the server.
    This action cannot be undone.
  </p>
  <div class="actions">
    <a href="index.php" class="btn btn-cancel">Cancel</a>
    <form method="POST" style="display:inline">
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <button type="submit" class="btn btn-danger">Yes, Delete</button>
    </form>
  </div>
</div>
</body>
</html>
