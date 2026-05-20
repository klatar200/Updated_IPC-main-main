<?php
require_once 'config.php';
require_auth();

$errors  = [];
$product = [
    'id' => '', 'sku' => '', 'name' => '', 'partType' => '',
    'caption' => '', 'operatingTemp' => '', 'specificationsSummary' => '',
    'photoUrl' => '', 'badges' => [], 'description' => [],
    'specTable1' => ['title' => 'Specifications:', 'rows' => []],
    'specTable2' => ['columnSpans' => [], 'rows' => []],
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check(); // #2
    $products = load_products();
    $sku = trim($_POST['sku'] ?? '');

    if (empty($sku)) { $errors[] = 'SKU is required.'; }
    elseif (find_product($products, $sku) !== -1) { $errors[] = 'A product with SKU "' . htmlspecialchars($sku) . '" already exists.'; }

    if (empty($_POST['name'])) { $errors[] = 'Product name is required.'; }
    if (empty($_POST['partType'])) { $errors[] = 'Part type is required.'; }

    if (empty($errors)) {
        $new = [
            'id'      => $sku, 'sku'     => $sku,
            'name'    => trim($_POST['name'] ?? ''),
            'partType'=> trim($_POST['partType'] ?? ''),
            'caption' => trim($_POST['caption'] ?? ''),
            'operatingTemp'          => trim($_POST['operatingTemp'] ?? ''),
            'specificationsSummary'  => trim($_POST['specificationsSummary'] ?? ''),
            'photoUrl'=> trim($_POST['photoUrl'] ?? ''),
            'badges'  => array_values(array_filter(array_map('trim', explode("\n", $_POST['badges'] ?? '')))),
            'description' => array_values(array_filter(array_map('trim', explode("\n", $_POST['description'] ?? '')))),
            'specTable1' => ['title' => trim($_POST['specTable1_title'] ?? 'Specifications:'), 'rows' => json_decode(trim($_POST['specTable1_rows'] ?? '[]'), true) ?: []],
            'specTable2' => json_decode(trim($_POST['specTable2_json'] ?? '{}'), true) ?: ['columnSpans' => [], 'rows' => []],
        ];
        $products[] = $new;
        if (save_products($products)) {
            audit_log('add', $sku, 'New product added'); // #6
            header('Location: index.php?msg=' . urlencode($sku . ' added successfully') . '&type=success');
            exit;
        }
        $errors[] = 'Failed to save. Check file permissions on products-all.json.';
    }

    $product = array_merge($product, $_POST);
    $product['badges']      = $_POST['badges'] ?? '';
    $product['description'] = $_POST['description'] ?? '';
}

$partTypes = ['Polyolefin Heat Shrink','PVDF Heat Shrink','Dual-Wall Heat Shrink','Medical Grade Heat Shrink','Elastomeric Heat Shrink','Fiberglass Sleeving','Expandable Sleeving','End Cap','Tape','Adhesive','Accessory'];
$emptyRows = '[]';
$emptyTable2 = json_encode(['columnSpans' => [['label' => "Order\nSize", 'colspan' => 1, 'sub' => null]], 'rows' => []], JSON_PRETTY_PRINT);
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Add Product</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    header { background: #0d2d52; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
    .logo { color: #fff; font-size: 14px; font-weight: 700; text-decoration: none; }
    nav a { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 13px; margin-left: 16px; }
    main { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 6px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 28px; }
    .btn { display: inline-flex; align-items: center; padding: 9px 18px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: background 0.15s; }
    .btn-primary { background: #005da3; color: #fff; }
    .btn-primary:hover { background: #004e8c; }
    .btn-secondary { background: #fff; color: #141414; border: 1px solid #d1d9e0; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 28px; margin-bottom: 24px; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #005da3; margin: 0 0 20px; padding-bottom: 8px; border-bottom: 1px solid #e5e9ee; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { margin-bottom: 16px; }
    .form-group.full { grid-column: 1 / -1; }
    label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 5px; }
    .hint { font-size: 11px; color: #9ca3af; margin-top: 4px; }
    input[type=text], select, textarea { width: 100%; padding: 10px 12px; border: 1px solid #d1d9e0; border-radius: 7px; font-size: 13px; color: #141414; outline: none; font-family: inherit; transition: border-color 0.15s; }
    input:focus, select:focus, textarea:focus { border-color: #005da3; box-shadow: 0 0 0 3px rgba(0,93,163,0.1); }
    textarea { resize: vertical; }
    .mono { font-family: 'Courier New', monospace; font-size: 12px; }
    .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; }
    @media(max-width:600px) { .grid-2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<header>
  <a class="logo" href="index.php">← IPC Admin</a>
  <nav><a href="auth.php?logout=1">Sign Out</a></nav>
</header>
<main>
  <h1>Add New Product</h1>
  <p class="sub">Fill in the product details. All required fields are marked with *.</p>

  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>

  <form method="POST">
    <div class="card">
      <div class="card-title">Basic Information</div>
      <div class="grid-2">
        <div class="form-group">
          <label for="sku">SKU / Part Number *</label>
          <input type="text" id="sku" name="sku" value="<?= h(is_array($product['sku']) ? '' : $product['sku']) ?>" required placeholder="e.g. IP33PO" />
        </div>
        <div class="form-group">
          <label for="partType">Part Type *</label>
          <select id="partType" name="partType" required>
            <option value="">— Select —</option>
            <?php foreach ($partTypes as $pt): ?>
              <option value="<?= h($pt) ?>" <?= (is_string($product['partType'] ?? null) && $product['partType'] === $pt) ? 'selected' : '' ?>><?= h($pt) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="form-group full">
          <label for="name">Product Name *</label>
          <input type="text" id="name" name="name" value="<?= h(is_array($product['name'] ?? '') ? '' : ($product['name'] ?? '')) ?>" required placeholder="Full product name" />
        </div>
        <div class="form-group">
          <label for="operatingTemp">Operating Temperature</label>
          <input type="text" id="operatingTemp" name="operatingTemp" value="<?= h($product['operatingTemp'] ?? '') ?>" placeholder="-55°C to 135°C" />
        </div>
        <div class="form-group">
          <label for="caption">Image Caption</label>
          <input type="text" id="caption" name="caption" value="<?= h($product['caption'] ?? '') ?>" />
        </div>
        <div class="form-group full">
          <label for="specificationsSummary">Specifications Summary</label>
          <input type="text" id="specificationsSummary" name="specificationsSummary" value="<?= h($product['specificationsSummary'] ?? '') ?>" placeholder="U/L 224 · RoHS · -55°C to 135°C" />
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Feature Badges</div>
      <textarea id="badges" name="badges" rows="4" placeholder="Flame Retardant&#10;RoHS Compliant&#10;2:1 Shrink Ratio"><?= h(is_array($product['badges'] ?? '') ? implode("\n", $product['badges']) : ($product['badges'] ?? '')) ?></textarea>
    </div>

    <div class="card">
      <div class="card-title">Description Paragraphs</div>
      <textarea id="description" name="description" rows="6" placeholder="One paragraph per line..."><?= h(is_array($product['description'] ?? '') ? implode("\n", $product['description']) : ($product['description'] ?? '')) ?></textarea>
    </div>

    <div class="card">
      <div class="card-title">Spec Table 1 (Specifications)</div>
      <div class="form-group">
        <label>Table Title</label>
        <input type="text" name="specTable1_title" value="Specifications:" />
      </div>
      <label>Rows JSON</label>
      <textarea name="specTable1_rows" rows="8" class="mono"><?= h($emptyRows) ?></textarea>
      <div class="hint">Array of {"label": "..." or null, "value": "..."} objects.</div>
    </div>

    <div class="card">
      <div class="card-title">Spec Table 2 (Size Chart)</div>
      <textarea name="specTable2_json" rows="12" class="mono"><?= h($emptyTable2) ?></textarea>
    </div>

    <div class="form-actions">
      <a href="index.php" class="btn btn-secondary">Cancel</a>
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <button type="submit" class="btn btn-primary">Add Product</button>
    </div>
  </form>
</main>
</body>
</html>
