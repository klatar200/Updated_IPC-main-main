<?php
require_once 'config.php';
require_auth();

$sku      = as_str($_GET['sku'] ?? null);   // A-5.7 — ?sku[]=x fatalled find_product(string)
$products = load_products();
$idx      = find_product($products, $sku);
$errors   = [];

if ($idx === -1) {
    header('Location: index.php?msg=Product+not+found&type=error');
    exit;
}

$product = $products[$idx];

// Optimistic-concurrency signature of the record as it is currently stored.
// The form echoes this back in a hidden field; on save we compare, so two
// people editing the SAME product can't silently clobber each other.
$storedSig = sha1(json_encode($product));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check(); // #2 — CSRF protection

    // If the stored record changed since this form was opened, refuse the save
    // and tell the user to reload. (A resubmit after this warning will carry
    // the refreshed signature and go through, giving an explicit override.)
    $submittedSig = $_POST['orig_sig'] ?? '';
    if ($submittedSig !== '' && $submittedSig !== $storedSig) {
        $errors[] = 'This product was changed by another session since you opened this page. Your edits were NOT saved. Reload to see the current version, then re-apply your changes (submitting again will overwrite the other change).';
    }

    // Build updated product from form
    $updated = $product; // start with existing data

    $updated['name']                  = post_str('name');
    $updated['sku']                   = post_str('sku');
    $updated['id']                    = $updated['sku'];
    $updated['partType']              = post_str('partType');
    $updated['caption']               = post_str('caption');
    $updated['operatingTemp']         = post_str('operatingTemp');
    $updated['specificationsSummary'] = post_str('specificationsSummary');
    $updated['photoUrl']              = post_str('photoUrl');

    // Whitelisted against the vocabulary — a posted value that is not an
    // approval never reaches the catalogue. array_intersect also deduplicates
    // and restores canonical order.
    $postedAp = $_POST['approvals'] ?? [];
    $updated['approvals'] = is_array($postedAp)
        ? array_values(array_intersect(IPC_APPROVALS, $postedAp))
        : [];

    // Badges — one per line
    $badgesRaw = post_str('badges');
    $updated['badges'] = array_values(array_filter(array_map('trim', explode("\n", $badgesRaw))));

    // Description paragraphs — one per line
    $descRaw = post_str('description');
    $updated['description'] = array_values(array_filter(array_map('trim', explode("\n", $descRaw))));

    // Primary PDF button label (e.g. "Molded Cap"). Empty → remove the key so
    // the frontend falls back to its default "Download PDF" text.
    $pdfLabel = post_str('pdfLabel');
    if ($pdfLabel !== '') {
        $updated['pdfLabel'] = $pdfLabel;
    } else {
        unset($updated['pdfLabel']);
    }

    // Additional PDF links — one per line, "URL | Label" (label optional).
    // These reference extra data sheets in /pdfs/. We only validate structure
    // here; the file itself is uploaded/managed on the Upload PDF page.
    $addRaw  = post_str('additionalPdfs');
    $addList = [];
    if ($addRaw !== '') {
        foreach (preg_split('/\r\n|\r|\n/', $addRaw) as $line) {
            $line = trim($line);
            if ($line === '') continue;
            $parts = explode('|', $line, 2);
            $url   = trim($parts[0]);
            $label = isset($parts[1]) ? trim($parts[1]) : '';
            if ($url === '') continue;
            // F6: validate the URL so a stray pipe/space or a non-PDF target is
            // caught with a clear message instead of a silently broken link.
            // (Entry is kept so it re-displays for the user to fix; the error
            // blocks the save.)
            if (!preg_match('#^(/|https?://)\S+\.pdf$#i', $url)) {
                $errors[] = 'Additional PDF link "' . $url . '" is not valid — use a path or URL ending in .pdf (e.g. /pdfs/file.pdf | Label).';
            }
            $addList[] = ['url' => $url, 'label' => $label];
        }
    }
    if ($addList) {
        $updated['additionalPdfs'] = $addList;
    } else {
        unset($updated['additionalPdfs']);
    }

    // specTable1 rows — stored as JSON textarea. Silently skipping invalid
    // JSON was the old behavior and it meant customers thought they had
    // saved a change when they hadn't. Now we surface the parse error.
    $st1Raw = post_str('specTable1_rows');
    if ($st1Raw !== '') {
        $st1Rows = json_decode($st1Raw, true);
        if (is_array($st1Rows)) {
            // A-5.12 — same shape check as the size grid below.
            $shape1 = spec_table1_problem($st1Rows);
            if ($shape1 !== '') $errors[] = $shape1;
            $updated['specTable1']['rows']  = $st1Rows;
            $updated['specTable1']['title'] = post_str('specTable1_title', 'Specifications:');
        } else {
            $errors[] = 'Specifications Table JSON is invalid (' . json_last_error_msg() . '). Fix the syntax or clear the field.';
        }
    } else {
        // Empty field → clear the rows but keep the title.
        $updated['specTable1']['rows']  = [];
        $updated['specTable1']['title'] = post_str('specTable1_title', 'Specifications:');
    }

    // specTable2 — same treatment.
    $st2Raw = post_str('specTable2_json');
    if ($st2Raw !== '') {
        $st2 = json_decode($st2Raw, true);
        if (is_array($st2)) {
            // A-5.12 — is_array() is not the shape the renderer needs.
            $shape = spec_table2_problem($st2);
            if ($shape !== '') $errors[] = $shape;
            $updated['specTable2'] = $st2;
        } else {
            $errors[] = 'Size / Dimension Table JSON is invalid (' . json_last_error_msg() . '). Fix the syntax or clear the field.';
        }
    } else {
        $updated['specTable2'] = ['columnSpans' => [], 'rows' => []];
    }

    // Validate required fields
    if (empty($updated['name']))    $errors[] = 'Product name is required.';
    // A6 — the same shared rule add.php uses. A rename could previously turn a
    // working SKU into one whose derived upload filenames are dotfiles.
    $errors = array_merge($errors, sku_problems($updated['sku']));
    if (empty($updated['partType'])) $errors[] = 'Part type is required.';

    // Block renaming an SKU onto another existing product. Without this,
    // two rows end up sharing an SKU and find_product() returns only the
    // first — the second silently becomes unreachable through the admin.
    if (empty($errors) && $updated['sku'] !== $sku) {
        $clashIdx = find_product($products, $updated['sku']);
        if ($clashIdx !== -1 && $clashIdx !== $idx) {
            // No h() here — the error list escapes every entry on render
            // (edit.php's <ul class="error-list">), so escaping now produces
            // the double-escaped text. Measured before the fix: a clashing SKU
            // of O'Brien was reported as O&amp;#039;Brien. Same class as
            // AUDIT_v3 NB18, which fixed add.php and upload-pdf.php and missed
            // this one. (audit-runs/audit1.md A-11)
            $errors[] = 'Another product already uses SKU "' . $updated['sku'] . '". Pick a different one.';
        }
    }

    if (empty($errors)) {
        // If the SKU changed, realign every PDF whose filename starts with the
        // old SKU — the primary sheet AND any additionalPdfs — onto the new SKU,
        // preserving each file's "-suffix" (F3). Renames are strictly scoped to
        // PDF_DIR, skip when the target already exists (no clobber), and only
        // update the stored URL when the physical rename succeeds.
        $renameNote = '';
        if ($updated['sku'] !== $sku) {
            $oldSku      = $sku;
            $newSku      = $updated['sku'];
            $realPdfDir  = realpath(PDF_DIR);
            $renameNotes = [];
            $renameOne = function ($url) use ($oldSku, $newSku, $realPdfDir, &$renameNotes) {
                if (empty($url)) return $url;
                $oldName = basename($url);
                $newName = pdf_rename_for_sku_change($oldName, $oldSku, $newSku);
                if ($newName === null || $newName === $oldName) return $url; // leave alone
                $realOld = realpath(PDF_DIR . $oldName);
                if ($realPdfDir && $realOld && strpos($realOld, $realPdfDir) === 0
                    && !file_exists(PDF_DIR . $newName)
                    && @rename($realOld, PDF_DIR . $newName)) {
                    $renameNotes[] = $oldName . ' → ' . $newName;
                    return PDF_URL . $newName;
                }
                return $url; // rename failed or target exists — keep old reference
            };
            if (!empty($updated['pdfUrl'])) {
                $updated['pdfUrl'] = $renameOne($updated['pdfUrl']);
            }
            if (!empty($updated['additionalPdfs']) && is_array($updated['additionalPdfs'])) {
                foreach ($updated['additionalPdfs'] as $k => $ap) {
                    if (!empty($ap['url'])) {
                        $updated['additionalPdfs'][$k]['url'] = $renameOne($ap['url']);
                    }
                }
            }
            if ($renameNotes) $renameNote = ' | PDF renamed ' . implode(', ', $renameNotes);
        }
        $products[$idx] = $updated;
        if (save_products($products)) {
            // F3 — a no-op save is still a success and still redirects, so the
            // concurrency signature is recomputed from (unchanged) disk on the
            // next load and matches. Only the flash message differs; edit.php
            // carries its result on index.php's ?msg= rather than a banner of
            // its own, so `type` stays `success` and the wording does the work.
            $noop = last_save_was_noop();
            $detail = ($updated['sku'] !== $sku ? ('Renamed from ' . $sku . '. ') : '') . 'Product details updated' . $renameNote;
            audit_log('edit', $updated['sku'], $noop ? 'Submitted — no changes' : $detail); // #6
            $msg = $noop
                ? $updated['sku'] . ' — no changes to save'
                : $updated['sku'] . ' saved successfully';
            header('Location: index.php?msg=' . urlencode($msg) . '&type=success');
            exit;
        }
        $errors[] = 'Failed to save products.json. Check file permissions.';
    }

    $product = $updated; // repopulate form with submitted values
}

// Format helpers for form display
$badgesStr  = implode("\n", $product['badges'] ?? []);

/* Seed the checkboxes: the stored field if the product has one, otherwise a
 * one-time read of its existing text. `$approvalSeeded` drives the warning —
 * the owner must be told the ticks were guessed, every time, until he saves. */
$approvalSet    = ipc_product_approvals($product);
$approvalSeeded = !array_key_exists('approvals', $product);

$descStr    = implode("\n", $product['description'] ?? []);

// Additional PDFs → one "URL | Label" line each for the textarea.
$addPdfStr  = '';
if (!empty($product['additionalPdfs']) && is_array($product['additionalPdfs'])) {
    $addLines = [];
    foreach ($product['additionalPdfs'] as $ap) {
        if (is_array($ap) && !empty($ap['url'])) {
            $lbl = (isset($ap['label']) && $ap['label'] !== '') ? ' | ' . $ap['label'] : '';
            $addLines[] = $ap['url'] . $lbl;
        }
    }
    $addPdfStr = implode("\n", $addLines);
}
$st1Title   = $product['specTable1']['title'] ?? 'Specifications:';
$st1Rows    = json_encode($product['specTable1']['rows'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
$st2Json    = json_encode($product['specTable2'] ?? ['columnSpans' => [], 'rows' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

// On a validation error the spec-table textareas must show what was TYPED.
// When the JSON does not parse, the branches above never assign it to
// $updated, so these three re-encoded the value still on DISK — under the
// message "Fix the syntax", pointing at a table the admin could no longer see.
// A 2,500-character size chart with one trailing comma was unrecoverable.
// add.php:87-94 already does this correctly; the WHATS_LEFT note claiming
// add.php was "ported from edit.php" has it exactly backwards.
// (AUDIT_v3_FINDINGS NB5)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($errors)) {
    if (is_string($_POST['specTable1_rows'] ?? null)) $st1Rows  = $_POST['specTable1_rows'];
    if (is_string($_POST['specTable2_json'] ?? null)) $st2Json  = $_POST['specTable2_json'];
    if (is_string($_POST['specTable1_title'] ?? null)) $st1Title = $_POST['specTable1_title'];
}

// PLAN-6 item 1 — the family list is owner-editable and lives in content.json.
// This was a literal here AND in the other of add.php/edit.php AND in
// src/App.jsx's FAMILY_ORDER: three copies that agreed only by luck, and whose
// drift would have been invisible here because the dropdown keeps an
// unrecognised value as a selected option (which is correct, and below).
$partTypes = ipc_product_families();
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Edit <?= h($product['sku'] ?? '') ?></title>
  <?= admin_head() ?>
  <style>
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; flex-wrap: wrap; }
    .page-header h1 { font-size: 22px; font-weight: 800; margin: 0; }
    .page-header p  { font-size: 13px; color: #6b7280; margin: 4px 0 0; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 28px; margin-bottom: 24px; }
    textarea { resize: vertical; line-height: 1.5; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 8px; }
    @media(max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<?php
$navExtra = '<a href="upload-pdf.php?sku=' . urlencode($product['sku'] ?? '') . '">Upload PDF</a>';
include 'nav.php';
?>
<main class="admin-wide">
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
            <?php
              // If the product's current partType isn't one of the standard
              // options (e.g. it came from an import), keep it as a selected
              // option so saving the form doesn't silently reset the category.
              $curPt = $product['partType'] ?? '';
              if ($curPt !== '' && !in_array($curPt, $partTypes, true)): ?>
              <option value="<?= h($curPt) ?>" selected><?= h($curPt) ?> (current — non-standard)</option>
            <?php endif; ?>
            <?php foreach ($partTypes as $pt): ?>
              <option value="<?= h($pt) ?>" <?= $curPt === $pt ? 'selected' : '' ?>><?= h($pt) ?></option>
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
          <div class="hint">Leave blank to use the IPC branded placeholder — or <a href="upload-image.php?sku=<?= urlencode($sku) ?>">upload a photo</a> and this field is filled in automatically.</div>
        </div>
        <div class="form-group full">
          <label for="specificationsSummary">Specifications Summary <small style="text-transform:none;font-weight:400">(shown in Product Index table)</small></label>
          <input type="text" id="specificationsSummary" name="specificationsSummary" value="<?= h($product['specificationsSummary'] ?? '') ?>" placeholder="e.g. U/L 224 VW-1 · RoHS · -55°C to 135°C · 600V" />
          <div class="hint">Comma/bullet-separated summary. Keep under 120 characters.</div>
        </div>
      </div>
    </div>

    <!-- Approvals & Certifications -->
    <div class="card">
      <div class="card-title">Approvals &amp; Certifications</div>
      <div class="form-group">
        <div class="hint" style="margin-bottom:10px">
          Tick every approval this product holds. These drive the
          <strong>Filter by approval</strong> controls on the Product Index and the
          marks on the Datasheets page. The free-text badges below cannot do that
          &mdash; &ldquo;U/L CSA MIL-Spec.&rdquo; and &ldquo;U/L, MIL-Spec.&rdquo; are
          different strings to a computer.
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px 14px">
          <?php foreach (IPC_APPROVALS as $ap): $on = in_array($ap, $approvalSet, true); ?>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:<?= $on ? '600' : '400' ?>;cursor:pointer;text-transform:none">
              <input type="checkbox" name="approvals[]" value="<?= h($ap) ?>" <?= $on ? 'checked' : '' ?> />
              <?= h($ap) ?>
            </label>
          <?php endforeach; ?>
        </div>
        <?php if ($approvalSeeded && $approvalSet): ?>
          <div class="hint" style="margin-top:10px;color:#92400e">
            &#9888; Pre-ticked by reading this product&rsquo;s existing text
            (<?= h(implode(', ', $approvalSet)) ?>). <strong>Check them before saving.</strong>
            Prose is not a reliable source for this &mdash; saving once makes it a real field.
          </div>
        <?php elseif ($approvalSeeded): ?>
          <div class="hint" style="margin-top:10px">
            Nothing was found in this product&rsquo;s existing text. Tick anything it holds.
          </div>
        <?php endif; ?>
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

    <!-- PDF Data Sheet Options -->
    <div class="card">
      <div class="card-title">PDF Data Sheet Options</div>
      <div class="form-group">
        <label for="pdfLabel">Primary PDF Button Label</label>
        <input type="text" id="pdfLabel" name="pdfLabel" value="<?= h($product['pdfLabel'] ?? '') ?>" placeholder="e.g. Molded Cap (leave blank for “Download PDF”)" />
        <div class="hint">Text shown on the main data-sheet button. The PDF <em>file</em> itself is uploaded on the <a href="upload-pdf.php?sku=<?= urlencode($product['sku'] ?? '') ?>">Upload PDF</a> page.</div>
      </div>
      <div class="form-group">
        <label for="additionalPdfs">Additional PDF Links — one per line</label>
        <textarea id="additionalPdfs" name="additionalPdfs" rows="4" placeholder="/pdfs/IP52EC-plugged-cap.pdf | Plugged Cap"><?= h($addPdfStr) ?></textarea>
        <div class="hint">Format: <code>/pdfs/filename.pdf | Button Label</code> (label optional). Each becomes an extra download button. Upload the referenced files to <code>/pdfs/</code> first — the admin doesn’t move them for you.</div>
      </div>
    </div>

    <!-- Spec Table 1 -->
    <div class="card">
      <div class="card-title">Specifications</div>
      <div class="form-group">
        <label for="specTable1_title">Section heading</label>
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
      <div class="card-title">Size chart</div>
      <div class="form-group">
        <label for="specTable2_json">Full Table JSON</label>
        <textarea id="specTable2_json" name="specTable2_json" rows="16" class="mono"><?= h($st2Json) ?></textarea>
        <div class="hint">JSON with <code>columnSpans</code> and <code>rows</code> arrays.</div>
      </div>
    </div>

    <div class="form-actions">
      <a href="index.php" class="btn btn-secondary">Cancel</a>
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="orig_sig" value="<?= h($storedSig) ?>">
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </div>
  </form>
</main>
<!-- A-5.20 — edit.php was the only editing page without this. It carries the
     longest typing sessions in the admin (descriptions, hand-edited spec JSON)
     and it lost BOTH of unsaved.js's jobs: the beforeunload prompt, and the
     5-minute ping.php keepalive that stops a long edit timing out. Omission,
     not exemption — it was never wired. -->
<script src="unsaved.js" defer></script>
<script src="spectable-editor.js"></script>
<script src="product-preview.js"></script>
</body>
</html>
