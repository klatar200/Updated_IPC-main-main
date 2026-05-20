<?php
require_once 'config.php';
require_auth();

$sku      = $_GET['sku'] ?? '';
$products = load_products();
$idx      = find_product($products, $sku);
$errors   = [];

if ($idx === -1) {
    header('Location: index.php?msg=Product+not+found&type=error');
    exit;
}

$product = $products[$idx];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check(); // #2 — CSRF protection
    // Build updated product from form
    $updated = $product; // start with existing data

    $updated['name']                  = trim($_POST['name'] ?? '');
    $updated['sku']                   = trim($_POST['sku'] ?? '');
    $updated['id']                    = $updated['sku'];
    $updated['partType']              = trim($_POST['partType'] ?? '');
    $updated['caption']               = trim($_POST['caption'] ?? '');
    $updated['operatingTemp']         = trim($_POST['operatingTemp'] ?? '');
    $updated['specificationsSummary'] = trim($_POST['specificationsSummary'] ?? '');
    $updated['photoUrl']              = trim($_POST['photoUrl'] ?? '');

    // Badges — one per line
    $badgesRaw = trim($_POST['badges'] ?? '');
    $updated['badges'] = array_values(array_filter(array_map('trim', explode("\n", $badgesRaw))));

    // Description paragraphs — one per line
    $descRaw = trim($_POST['description'] ?? '');
    $updated['description'] = array_values(array_filter(array_map('trim', explode("\n", $descRaw))));

    // specTable1 rows — stored as JSON textarea. Silently skipping invalid
    // JSON was the old behavior and it meant customers thought they had
    // saved a change when they hadn't. Now we surface the parse error.
    $st1Raw = trim($_POST['specTable1_rows'] ?? '');
    if ($st1Raw !== '') {
        $st1Rows = json_decode($st1Raw, true);
        if (is_array($st1Rows)) {
            $updated['specTable1']['rows']  = $st1Rows;
            $updated['specTable1']['title'] = trim($_POST['specTable1_title'] ?? 'Specifications:');
        } else {
            $errors[] = 'Specifications Table JSON is invalid (' . json_last_error_msg() . '). Fix the syntax or clear the field.';
        }
    } else {
        // Empty field → clear the rows but keep the title.
        $updated['specTable1']['rows']  = [];
        $updated['specTable1']['title'] = trim($_POST['specTable1_title'] ?? 'Specifications:');
    }

    // specTable2 — same treatment.
    $st2Raw = trim($_POST['specTable2_json'] ?? '');
    if ($st2Raw !== '') {
        $st2 = json_decode($st2Raw, true);
        if (is_array($st2)) {
            $updated['specTable2'] = $st2;
        } else {
            $errors[] = 'Size / Dimension Table JSON is invalid (' . json_last_error_msg() . '). Fix the syntax or clear the field.';
        }
    } else {
        $updated['specTable2'] = ['columnSpans' => [], 'rows' => []];
    }

    // Validate required fields
    if (empty($updated['name']))    $errors[] = 'Product name is required.';
    if (empty($updated['sku']))     $errors[] = 'SKU is required.';
    if (empty($updated['partType'])) $errors[] = 'Part type is required.';

    // Block renaming an SKU onto another existing product. Without this,
    // two rows end up sharing an SKU and find_product() returns only the
    // first — the second silently becomes unreachable through the admin.
    if (empty($errors) && $updated['sku'] !== $sku) {
        $clashIdx = find_product($products, $updated['sku']);
        if ($clashIdx !== -1 && $clashIdx !== $idx) {
            $errors[] = 'Another product already uses SKU "' . h($updated['sku']) . '". Pick a different one.';
        }
    }

    if (empty($errors)) {
        $products[$idx] = $updated;
        if (save_products($products)) {
            audit_log('edit', $updated['sku'], 'Product details updated'); // #6
            header('Location: index.php?msg=' . urlencode($updated['sku'] . ' saved successfully') . '&type=success');
            exit;
        }
        $errors[] = 'Failed to save products.json. Check file permissions.';
    }

    $product = $updated; // repopulate form with submitted values
}

// Format helpers for form display
$badgesStr  = implode("\n", $product['badges'] ?? []);
$descStr    = implode("\n", $product['description'] ?? []);
$st1Title   = $product['specTable1']['title'] ?? 'Specifications:';
$st1Rows    = json_encode($product['specTable1']['rows'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
$st2Json    = json_encode($product['specTable2'] ?? ['columnSpans' => [], 'rows' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

$partTypes = ['Polyolefin Heat Shrink','PVDF Heat Shrink','Dual-Wall Heat Shrink','Medical Grade Heat Shrink','Elastomeric Heat Shrink','Fiberglass Sleeving','Expandable Sleeving','End Cap','Tape','Adhesive','Accessory'];
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Edit <?= h($product['sku'] ?? '') ?></title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body  { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    header { background: #0d2d52; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
    .logo  { color: #fff; font-size: 14px; font-weight: 700; text-decoration: none; }
    nav a  { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 13px; margin-left: 16px; }
    nav a:hover { color: #fff; }
    main   { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; flex-wrap: wrap; }
    .page-header h1 { font-size: 22px; font-weight: 800; margin: 0; }
    .page-header p  { font-size: 13px; color: #6b7280; margin: 4px 0 0; }
    .btn { display: inline-flex; align-items: center; padding: 9px 18px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: background 0.15s; }
    .btn-primary { background: #005da3; color: #fff; }
    .btn-primary:hover { background: #004e8c; }
    .btn-secondary { background: #fff; color: #141414; border: 1px solid #d1d9e0; }
    .btn-secondary:hover { background: #f0f4f8; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 28px; margin-bottom: 24px; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #005da3; margin: 0 0 20px; padding-bottom: 8px; border-bottom: 1px solid #e5e9ee; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { margin-bottom: 16px; }
    .form-group.full { grid-column: 1 / -1; }
    label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 5px; }
    .hint { font-size: 11px; color: #9ca3af; margin-top: 4px; }
    input[type=text], select, textarea {
      width: 100%; padding: 10px 12px; border: 1px solid #d1d9e0; border-radius: 7px;
      font-size: 13px; color: #141414; outline: none; font-family: inherit; transition: border-color 0.15s;
    }
    input[type=text]:focus, select:focus, textarea:focus { border-color: #005da3; box-shadow: 0 0 0 3px rgba(0,93,163,0.1); }
    textarea { resize: vertical; line-height: 1.5; }
    .mono { font-family: 'Courier New', monospace; font-size: 12px; }
    .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .error-list li { font-size: 13px; margin-bottom: 4px; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 8px; }
    @media(max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<header>
  <a class="logo" href="index.php">← IPC Admin</a>
  <nav>
    <a href="upload-pdf.php?sku=<?= urlencode($product['sku'] ?? '') ?>">Upload PDF</a>
    <a href="auth.php?logout=1">Sign Out</a>
  </nav>
</header>
<main>
  <div class="page-header">
    <div>
      <h1>Edit Product: <?= h($product['sku'] ?? '') ?></h1>
      <p><?= h($product['name'] ?? '') ?></p>
    </div>
    <div style="display:flex;gap:8px;">
      <a href="index.php" class="btn btn-secondary">← Back</a>
    </div>
  </div>

  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>

  <form method="POST">
    <!-- Basic Info -->
    <div class="card">
      <div class="card-title">Basic Information</div>
      <div class="grid-2">
        <div class="form-group">
          <label for="sku">SKU / Part Number *</label>
          <input type="text" id="sku" name="sku" value="<?= h($product['sku'] ?? '') ?>" required />
        </div>
        <div class="form-group">
          <label for="partType">Part Type / Category *</label>
          <select id="partType" name="partType" required>
            <?php foreach ($partTypes as $pt): ?>
              <option value="<?= h($pt) ?>" <?= ($product['partType'] ?? '') === $pt ? 'selected' : '' ?>><?= h($pt) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="form-group full">
          <label for="name">Product Name *</label>
          <input type="text" id="name" name="name" value="<?= h($product['name'] ?? '') ?>" required />
        </div>
        <div class="form-group">
          <label for="operatingTemp">Operating Temperature</label>
          <input type="text" id="operatingTemp" name="operatingTemp" value="<?= h($product['operatingTemp'] ?? '') ?>" placeholder="e.g. -55°C to 135°C" />
        </div>
        <div class="form-group">
          <label for="caption">Image Caption</label>
          <input type="text" id="caption" name="caption" value="<?= h($product['caption'] ?? '') ?>" placeholder="Short caption below the product photo" />
        </div>
        <div class="form-group full">
          <label for="photoUrl">Photo URL</label>
          <input type="text" id="photoUrl" name="photoUrl" value="<?= h($product['photoUrl'] ?? '') ?>" placeholder="https://... or /images/product.jpg" />
          <div class="hint">Leave blank to use the IPC branded placeholder.</div>
        </div>
        <div class="form-group full">
          <label for="specificationsSummary">Specifications Summary <small style="text-transform:none;font-weight:400">(shown in Product Index table)</small></label>
          <input type="text" id="specificationsSummary" name="specificationsSummary" value="<?= h($product['specificationsSummary'] ?? '') ?>" placeholder="e.g. U/L 224 VW-1 · RoHS · -55°C to 135°C · 600V" />
          <div class="hint">Comma/bullet-separated summary. Keep under 120 characters.</div>
        </div>
      </div>
    </div>

    <!-- Feature Badges -->
    <div class="card">
      <div class="card-title">Feature Badges</div>
      <div class="form-group">
        <label for="badges">One badge per line</label>
        <textarea id="badges" name="badges" rows="4" placeholder="Flame Retardant&#10;RoHS Compliant&#10;2:1 Shrink Ratio"><?= h($badgesStr) ?></textarea>
        <div class="hint">These appear as pill badges on the product detail page.</div>
      </div>
    </div>

    <!-- Description -->
    <div class="card">
      <div class="card-title">Description Paragraphs</div>
      <div class="form-group">
        <label for="description">One paragraph per line</label>
        <textarea id="description" name="description" rows="8" placeholder="First paragraph about the product...&#10;Second paragraph..."><?= h($descStr) ?></textarea>
        <div class="hint">Each line becomes a separate paragraph on the product page.</div>
      </div>
    </div>

    <!-- Spec Table 1 -->
    <div class="card">
      <div class="card-title">Specifications Table (Left)</div>
      <div class="form-group">
        <label for="specTable1_title">Table Header Title</label>
        <input type="text" id="specTable1_title" name="specTable1_title" value="<?= h($st1Title) ?>" />
      </div>
      <div class="form-group">
        <label for="specTable1_rows">Rows JSON</label>
        <textarea id="specTable1_rows" name="specTable1_rows" rows="10" class="mono"><?= h($st1Rows) ?></textarea>
        <div class="hint">JSON array of <code>{"label": "..." or null, "value": "..."}</code> objects. Use \n in value for line breaks.</div>
      </div>
    </div>

    <!-- Spec Table 2 -->
    <div class="card">
      <div class="card-title">Size / Dimension Table (Right)</div>
      <div class="form-group">
        <label for="specTable2_json">Full Table JSON</label>
        <textarea id="specTable2_json" name="specTable2_json" rows="16" class="mono"><?= h($st2Json) ?></textarea>
        <div class="hint">JSON with <code>columnSpans</code> and <code>rows</code> arrays.</div>
      </div>
    </div>

    <div class="form-actions">
      <a href="index.php" class="btn btn-secondary">Cancel</a>
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </div>
  </form>
</main>
</body>
</html>
