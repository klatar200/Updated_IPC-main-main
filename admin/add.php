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
    $sku = post_str('sku');

    // A6 — shared with edit.php via config.php. Covers the "required" case too,
    // so the old empty() branch is gone rather than duplicated.
    $skuErrors = sku_problems($sku);
    if ($skuErrors) { $errors = array_merge($errors, $skuErrors); }
    // No htmlspecialchars() here — the error list renders every entry through
    // h(), so escaping twice showed the admin  O&amp;#039;Brien  in his own
    // error message. Escape at the render boundary only.
    // (AUDIT_v3_FINDINGS NB18)
    elseif (find_product($products, $sku) !== -1) { $errors[] = 'A product with SKU "' . $sku . '" already exists.'; }

    if (post_str('name') === '')     { $errors[] = 'Product name is required.'; }
    if (post_str('partType') === '') { $errors[] = 'Part type is required.'; }

    // Spec-table JSON validation, ported from edit.php:91-120. The old code
    // here was `json_decode(...) ?: []`, which SWALLOWED malformed JSON and
    // saved an empty table while reporting "added successfully" — the exact
    // harm edit.php's comment names ("customers thought they had saved a
    // change when they hadn't"). (DEPLOY_READINESS_v2 T1.5)
    $st1Raw  = post_str('specTable1_rows');
    $st1Rows = [];
    if ($st1Raw !== '') {
        $decoded = json_decode($st1Raw, true);
        if (is_array($decoded)) {
            $st1Rows = $decoded;
        } else {
            $errors[] = 'Specifications Table JSON is invalid (' . json_last_error_msg() . '). Fix the syntax or clear the field.';
        }
    }

    $st2Raw = post_str('specTable2_json');
    $st2    = ['columnSpans' => [], 'rows' => []];
    if ($st2Raw !== '') {
        $decoded = json_decode($st2Raw, true);
        if (is_array($decoded)) {
            $st2 = $decoded;
        } else {
            $errors[] = 'Size / Dimension Table JSON is invalid (' . json_last_error_msg() . '). Fix the syntax or clear the field.';
        }
    }

    if (empty($errors)) {
        $new = [
            'id'      => $sku, 'sku'     => $sku,
            'name'    => post_str('name'),
            'partType'=> post_str('partType'),
            'caption' => post_str('caption'),
            'operatingTemp'          => post_str('operatingTemp'),
            'specificationsSummary'  => post_str('specificationsSummary'),
            // Always blank on create. This read post_str('photoUrl') for a
            // field add.php's form has never rendered, so it was always '' —
            // the same value the skeleton above already sets — while reading as
            // though a photo could be attached here. It cannot: photos are
            // assigned per-SKU on the Upload Image page, which is also what
            // clears them. (audit-runs/audit4.md D-04)
            'photoUrl'=> '',
            // post_str() first: explode() on an array is a TypeError on PHP 8
            // and a warning + null on 7.4. (AUDIT_v3_FINDINGS NB12)
            // Whitelisted against the vocabulary. A NEW product always gets an
            // explicit list — even an empty one — so it is never re-derived
            // from its own prose later.
            'approvals' => is_array($_POST['approvals'] ?? null)
                ? array_values(array_intersect(IPC_APPROVALS, $_POST['approvals']))
                : [],
            'badges'  => array_values(array_filter(array_map('trim', explode("\n", post_str('badges'))))),
            'description' => array_values(array_filter(array_map('trim', explode("\n", post_str('description'))))),
            'specTable1' => ['title' => post_str('specTable1_title', 'Specifications:'), 'rows' => $st1Rows],
            'specTable2' => $st2,
        ];
        $products[] = $new;
        if (save_products($products)) {
            audit_log('add', $sku, 'New product added'); // #6
            header('Location: index.php?msg=' . urlencode($sku . ' added successfully') . '&type=success');
            exit;
        }
        $errors[] = 'Failed to save. Check file permissions on products-all.json.';
    }

    // Repopulate from the submitted values. Only scalars — an array-typed field
    // reaching h() in the form below is another 500. (AUDIT_v3_FINDINGS NB12)
    foreach ($_POST as $k => $v) {
        if (is_string($v)) $product[$k] = $v;
    }
    $product['badges']      = post_str('badges');
    $product['description'] = post_str('description');
}

// PLAN-6 item 1 — the family list is owner-editable and lives in content.json.
// This was a literal here AND in the other of add.php/edit.php AND in
// src/App.jsx's FAMILY_ORDER: three copies that agreed only by luck, and whose
// drift would have been invisible here because the dropdown keeps an
// unrecognised value as a selected option (which is correct, and below).
$partTypes = ipc_product_families();
// Repopulate the spec-table textareas from the failed POST rather than
// resetting them to the empty seed — otherwise a validation error anywhere on
// the form silently discarded the whole size chart the user had just built.
// (DEPLOY_READINESS_v2 T1.5)
$emptyRows = '[]';
$emptyTable2 = json_encode(['columnSpans' => [['label' => "Order\nSize", 'colspan' => 1, 'sub' => null]], 'rows' => []], JSON_PRETTY_PRINT);
$st1TitleVal = 'Specifications:';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (is_string($_POST['specTable1_title'] ?? null)) $st1TitleVal = $_POST['specTable1_title'];
    if (isset($_POST['specTable1_rows']) && is_string($_POST['specTable1_rows']) && trim($_POST['specTable1_rows']) !== '') {
        $emptyRows = $_POST['specTable1_rows'];
    }
    if (isset($_POST['specTable2_json']) && is_string($_POST['specTable2_json']) && trim($_POST['specTable2_json']) !== '') {
        $emptyTable2 = $_POST['specTable2_json'];
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><link rel="icon" type="image/svg+xml" href="logo.svg" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Add Product</title>
  <?= admin_head() ?>
  <style>
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 6px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 28px; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 28px; margin-bottom: 24px; }
    input:focus, select:focus, textarea:focus { border-color: #005da3; box-shadow: 0 0 0 3px rgba(0,93,163,0.1); }
    @media(max-width:600px) { .grid-2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<?php $navActive = 'add'; include 'nav.php'; ?>
<main class="admin-wide">
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
      <div class="card-title">Approvals &amp; Certifications</div>
      <div class="hint" style="margin-bottom:10px">
        Tick every approval this product holds. These drive the
        <strong>Filter by approval</strong> controls on the Product Index.
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px 14px">
        <?php $addAp = is_array($_POST['approvals'] ?? null) ? $_POST['approvals'] : []; ?>
        <?php foreach (IPC_APPROVALS as $ap): ?>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;text-transform:none">
            <input type="checkbox" name="approvals[]" value="<?= h($ap) ?>" <?= in_array($ap, $addAp, true) ? 'checked' : '' ?> />
            <?= h($ap) ?>
          </label>
        <?php endforeach; ?>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Feature Badges</div>
      <?php /* A7 — a card-title <div> is not a label. These four textareas
               carried an id and no <label for>, so all four were announced as
               a bare "edit text" while edit.php labelled the same four fields
               correctly. Label text matches edit.php's word for word so the two
               pages describe one field the same way.
               (audit-runs/audit1.md A-07) */ ?>
      <label for="badges">One badge per line</label>
      <textarea id="badges" name="badges" rows="4" placeholder="Flame Retardant&#10;RoHS Compliant&#10;2:1 Shrink Ratio"><?= h(is_array($product['badges'] ?? '') ? implode("\n", $product['badges']) : ($product['badges'] ?? '')) ?></textarea>
    </div>

    <div class="card">
      <div class="card-title">Description Paragraphs</div>
      <label for="description">One paragraph per line</label>
      <textarea id="description" name="description" rows="6" placeholder="One paragraph per line..."><?= h(is_array($product['description'] ?? '') ? implode("\n", $product['description']) : ($product['description'] ?? '')) ?></textarea>
    </div>

    <div class="card">
      <div class="card-title">Specifications</div>
      <div class="form-group">
        <label for="specTable1_title">Section heading</label>
        <?php /* Hardcoded to "Specifications:" — a custom heading was thrown away
                 by any validation error on the form while the rows beside it
                 repopulated correctly. (AUDIT_v3_FINDINGS NB11) */ ?>
        <input type="text" id="specTable1_title" name="specTable1_title" value="<?= h($st1TitleVal) ?>" />
      </div>
      <label for="specTable1_rows">Rows JSON</label>
      <textarea id="specTable1_rows" name="specTable1_rows" rows="8" class="mono"><?= h($emptyRows) ?></textarea>
      <div class="hint">Array of {"label": "..." or null, "value": "..."} objects.</div>
    </div>

    <div class="card">
      <div class="card-title">Size chart</div>
      <label for="specTable2_json">Full Table JSON</label>
      <textarea id="specTable2_json" name="specTable2_json" rows="12" class="mono"><?= h($emptyTable2) ?></textarea>
    </div>

    <div class="form-actions">
      <a href="index.php" class="btn btn-secondary">Cancel</a>
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <button type="submit" class="btn btn-primary">Add Product</button>
    </div>
  </form>
</main>
<script src="spectable-editor.js"></script>
<script src="product-preview.js"></script>
<script src="unsaved.js" defer></script>
</body>
</html>
