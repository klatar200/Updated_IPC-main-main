<?php
require_once 'config.php';
require_auth();
$navActive = 'help';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Help &amp; Documentation</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body  { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }

    /* Header (matches index.php) */
    header { background: #0d2d52; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 20; }
    .logo  { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .logo-title { color: #fff; font-size: 13px; font-weight: 700; }
    .logo-sub   { color: rgba(255,255,255,0.5); font-size: 10px; }
    nav a   { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 13px; margin-left: 20px; }
    nav a:hover, nav a.current { color: #fff; }
    nav a.current { border-bottom: 2px solid #005da3; padding-bottom: 4px; }
    .logout { color: rgba(255,255,255,0.5) !important; }

    main { max-width: 1280px; margin: 0 auto; padding: 32px 24px 80px; }

    .page-header { margin-bottom: 28px; background: linear-gradient(135deg, #0d2d52 0%, #005da3 100%); border-radius: 16px; padding: 28px 32px; display: flex; align-items: center; gap: 20px; box-shadow: 0 8px 24px rgba(13,45,82,0.18); }
    .page-header-icon { font-size: 30px; width: 58px; height: 58px; flex-shrink: 0; background: rgba(255,255,255,0.15); border-radius: 14px; display: flex; align-items: center; justify-content: center; }
    .page-header h1 { font-size: 26px; font-weight: 800; margin: 0 0 6px; color: #fff; }
    .page-header p  { font-size: 14px; color: rgba(255,255,255,0.82); margin: 0; max-width: 720px; line-height: 1.6; }

    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 18px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; white-space: nowrap; }
    .btn-primary  { background: #005da3; color: #fff; }
    .btn-sm { padding: 5px 12px; font-size: 12px; }
    .btn-edit   { background: rgba(0,93,163,0.08); color: #005da3; }
    .btn-danger { background: rgba(220,38,38,0.08); color: #dc2626; }
    .btn-pdf    { background: rgba(0,190,242,0.1); color: #0369a1; }
    .btn-mock { pointer-events: none; cursor: default; }
    /* Inline reproduction of the badges on the Inquiries page. */
    .badge-mock { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 20px; background: rgba(107,114,128,0.12); color: #4b5563; white-space: nowrap; }

    /* Two-column layout */
    .help-layout { display: flex; align-items: flex-start; gap: 32px; }
    .help-toc { position: sticky; top: 92px; width: 250px; flex-shrink: 0; background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 18px; max-height: calc(100vh - 120px); overflow-y: auto; }
    .help-toc .toc-group { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: #9ca3af; margin: 16px 0 6px; padding: 0 10px; }
    .help-toc .toc-group:first-child { margin-top: 0; }
    .help-toc a { display: block; font-size: 12.5px; color: #374151; text-decoration: none; padding: 6px 10px 6px 9px; border-radius: 6px; margin-bottom: 1px; line-height: 1.4; border-left: 3px solid transparent; transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease; }
    .help-toc a:hover { background: #f0f4f8; color: #005da3; }
    .help-toc a.active { background: #eaf3fb; color: #005da3; font-weight: 700; border-left-color: #005da3; }
    .help-content { flex: 1; min-width: 0; }

    section.help-section { background: #fff; border: 1px solid #e5e9ee; border-top: 4px solid transparent; border-radius: 14px; padding: 32px; margin-bottom: 22px; scroll-margin-top: 84px; box-shadow: 0 1px 3px rgba(13,45,82,0.04); }
    section.help-section:has(.eyebrow-start)     { border-top-color: #005da3; }
    section.help-section:has(.eyebrow-manage)    { border-top-color: #16a34a; }
    section.help-section:has(.eyebrow-advanced)  { border-top-color: #7c3aed; }
    section.help-section:has(.eyebrow-reference) { border-top-color: #b45309; }
    section.help-section:has(.eyebrow-site)      { border-top-color: #0284c7; }
    .help-section .eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px; padding: 4px 12px; border-radius: 20px; }
    .eyebrow-start     { background: rgba(0,93,163,0.1);   color: #005da3; }
    .eyebrow-manage    { background: rgba(22,163,74,0.1);  color: #15803d; }
    .eyebrow-advanced  { background: rgba(124,58,237,0.1); color: #6d28d9; }
    .eyebrow-reference { background: rgba(180,83,9,0.1);   color: #b45309; }
    .eyebrow-site      { background: rgba(2,132,199,0.1);  color: #0369a1; }
    .help-section h2 { font-size: 20px; font-weight: 800; margin: 0 0 12px; }
    .help-section h3 { font-size: 14px; font-weight: 700; margin: 22px 0 10px; color: #0d2d52; }
    .help-section p { font-size: 14px; line-height: 1.7; color: #374151; margin: 0 0 14px; }
    .help-section p:last-child { margin-bottom: 0; }
    .help-section ul.plain { font-size: 14px; line-height: 1.7; color: #374151; margin: 0 0 14px; padding-left: 20px; }
    .help-section ul.plain li { margin-bottom: 6px; }
    .help-section code { background: #f0f4f8; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 12.5px; color: #0d2d52; }
    .help-section strong { color: #141414; }

    /* Numbered step lists */
    ol.steps { list-style: none; margin: 0 0 16px; padding: 0; counter-reset: step; }
    ol.steps > li { counter-increment: step; position: relative; padding: 3px 0 3px 42px; margin-bottom: 16px; font-size: 14px; line-height: 1.65; color: #141414; }
    ol.steps > li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 28px; height: 28px; border-radius: 50%; background: #005da3; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    ol.steps > li p { margin: 4px 0 0; }

    /* Callouts */
    .callout { border-radius: 10px; padding: 14px 16px; font-size: 13px; margin: 16px 0; line-height: 1.6; }
    .callout b { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
    .callout-tip     { background: #eff8ff; border: 1px solid #bfe0f7; color: #0c4a6e; }
    .callout-warning { background: #fffbeb; border: 1px solid #fde68a; color: #78350f; }
    .callout-danger  { background: #fef2f2; border: 1px solid #fecaca; color: #7f1d1d; }
    .callout-tip b::before     { content: "💡 "; }
    .callout-warning b::before { content: "⚠️ "; }
    .callout-danger b::before  { content: "🚫 "; }

    /* Fill-in credentials record */
    .credentials-box { background: #f8fafc; border: 1px solid #e5e9ee; border-radius: 12px; padding: 4px 18px; margin: 16px 0; }
    .credentials-row { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px dashed #d9dee5; }
    .credentials-row:last-child { border-bottom: none; }
    .cred-label { flex: 0 0 210px; font-size: 12.5px; font-weight: 700; color: #0d2d52; }
    .cred-fill  { flex: 1; border-bottom: 1px solid #9ca3af; min-height: 20px; }

    /* Diagrams */
    .diagram-wrap { background: #f8fafc; border: 1px solid #e5e9ee; border-radius: 12px; padding: 18px; margin: 16px 0 20px; }
    .diagram-caption { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; margin: 0 0 12px; }
    .diagram-wrap svg { width: 100%; height: auto; display: block; }

    /* Back to top */
    .back-to-top { position: fixed; bottom: 28px; right: 28px; width: 44px; height: 44px; border-radius: 50%; background: #005da3; color: #fff; display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 18px; font-weight: 800; box-shadow: 0 4px 12px rgba(0,93,163,0.35); transition: background 0.15s ease, transform 0.15s ease; z-index: 15; }
    .back-to-top:hover { background: #004e8c; transform: translateY(-2px); }

    /* Field reference tables */
    table.field-ref { width: 100%; border-collapse: collapse; margin: 6px 0 18px; font-size: 13px; }
    table.field-ref th { text-align: left; background: #f0f4f8; color: #374151; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding: 9px 12px; }
    table.field-ref td { padding: 10px 12px; border-bottom: 1px solid #f0f4f8; vertical-align: top; color: #374151; }
    table.field-ref td:first-child { font-weight: 700; color: #005da3; white-space: nowrap; }
    table.field-ref tr:last-child td { border-bottom: none; }

    /* FAQ disclosure */
    details.faq { border: 1px solid #e5e9ee; border-radius: 10px; padding: 4px 16px; margin-bottom: 10px; transition: border-color 0.15s ease; }
    details.faq:hover { border-color: #bfe0f7; }
    details.faq summary { position: relative; padding: 12px 0 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; color: #0d2d52; list-style: none; }
    details.faq summary::-webkit-details-marker { display: none; }
    details.faq summary::after { content: "›"; position: absolute; left: 0; top: 9px; font-size: 19px; font-weight: 800; color: #005da3; display: inline-block; transition: transform 0.2s ease; }
    details.faq[open] summary::after { transform: rotate(90deg); }
    details.faq p { padding-bottom: 14px; margin: 0; }

    .visual-note { display: flex; gap: 10px; align-items: flex-start; background: #f8fafc; border: 1px dashed #c7d2dd; border-radius: 10px; padding: 12px 14px; margin: 8px 0 16px; font-size: 12.5px; color: #4b5563; line-height: 1.55; }
    .visual-note .vn-icon { flex-shrink: 0; font-size: 15px; }

    hr.sep { border: none; border-top: 1px solid #e5e9ee; margin: 24px 0; }

    @media (max-width: 900px) {
      .help-layout { flex-direction: column; }
      .help-toc { position: static; width: auto; max-height: none; }
      .page-header { flex-direction: column; align-items: flex-start; }
      .back-to-top { bottom: 16px; right: 16px; }
      /* A10-022 — the stacked layout must STRETCH, not sit at content width.
         .help-layout is align-items:flex-start, and this query only flipped
         flex-direction, so once stacked the two children kept a shrink-to-fit
         cross size: .help-layout measured a correct 342px while .help-content
         inside it measured 503px and overflowed the page. Worth 48px of the
         299. */
      .help-layout { align-items: stretch; }
    }

    /* A10-022 — at 390 this page rendered 689px wide in a 390px viewport:
       299px of PAGE-level horizontal overflow, so the header, the heading and
       the contents list all slid sideways along with the tables. Rick opens
       Help precisely when he is stuck, and the column holding every answer was
       off-screen.

       The finding names `td:first-child { white-space: nowrap }` as the driver,
       and it is the biggest one, but measuring each fix in the browser showed
       it is one of THREE and no single one is sufficient:

         689 -> 527   term column allowed to wrap (this rule)
         527 -> 479   .help-layout stretching when stacked (above)
         479 -> 390   long <code> tokens allowed to break, and .visual-note
                      allowed to wrap — it is a flex row whose text item could
                      not shrink, so `RoHS Compliant` alone held 24px of page

       All three are needed and together they land on exactly 390. Nothing is
       scrolled sideways to be read: the tables fit, so every explanation is
       painted in the viewport. Deliberately NOT `overflow-x: hidden` on body —
       that hides the symptom and makes the second column permanently
       unreachable. Scoped to 640px so 834 and above are untouched. */
    @media (max-width: 640px) {
      table.field-ref td:first-child { white-space: normal; }
      .help-section code { overflow-wrap: anywhere; }
      .visual-note { flex-wrap: wrap; }
      /* The worked size chart is the one table here that genuinely cannot fit:
         A10-029 replaced its stacked Min|Max header with four flat columns, so
         its four headings — Order Size, Expanded Diameter, Recovered Diameter,
         Wall Thickness — now sit on one row and its min-content width is 56px
         past a 390px screen. Unlike the two-column reference tables, shrinking
         a four-column numeric grid to 390px would not leave it readable, so
         this one gets the scroller: the container it already sits in scrolls,
         the page does not. Every other table still FITS. */
      .diagram-wrap { overflow-x: auto; }
    }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>

<main>
  <div class="page-header">
    <div class="page-header-icon">📘</div>
    <div>
      <h1>Help &amp; Documentation</h1>
      <p>A plain-language guide to running your product catalog — no technical background needed. This page only appears after you sign in, so it's safe to keep it open in a tab while you work.</p>
    </div>
  </div>

  <div class="help-layout">
    <!-- Table of contents -->
    <nav class="help-toc" aria-label="Help topics">
      <div class="toc-group">🧭 Getting Started</div>
      <a href="#overview">How this dashboard works</a>
      <a href="#quickref">Quick reference: find what you need</a>
      <a href="#signing-in">Signing in &amp; out</a>
      <a href="#password">Your admin password</a>
      <a href="#dashboard">Reading the dashboard</a>

      <div class="toc-group">🛠️ Managing Products</div>
      <a href="#adding">Adding a new product</a>
      <a href="#editing">Editing a product</a>
      <a href="#specs">Specifications list</a>
      <a href="#sizechart">Size / dimension chart</a>
      <a href="#photos">Product photos</a>
      <a href="#pdfs">PDF data sheets</a>
      <a href="#deleting">Deleting a product</a>
      <a href="#walkthrough">Launching a new product, start to finish</a>

      <div class="toc-group">🌐 Your Website</div>
      <a href="#business">Business Details</a>
      <a href="#pagecontent">Page Content</a>
      <a href="#inquiries">Inquiries (contact-form leads)</a>

      <div class="toc-group">⚙️ Advanced</div>
      <a href="#backups">Backups &amp; undo</a>
      <a href="#auditlog">Audit log / change history</a>

      <div class="toc-group">📚 Reference</div>
      <a href="#faq">Troubleshooting &amp; FAQ</a>
      <a href="#glossary">Glossary of terms</a>
      <a href="#help">Getting more help</a>
      <a href="#server-limits">What your server allows</a>
    </nav>

    <!-- Content -->
    <div class="help-content">

      <section class="help-section" id="overview">
        <div class="eyebrow eyebrow-start">Getting Started</div>
        <h2>🧭 How this dashboard works</h2>
        <p>This admin dashboard is where you manage the public website: your product catalog, the facts about your business, the wording on the pages, and the leads that come in through the contact form. You don't need to know any code to use it — every screen is forms, buttons, and clear confirmations.</p>
        <p>What lives behind it:</p>
        <ul class="plain">
          <li><strong>Your product catalog</strong> — every product's details, in one file that both this dashboard and the public website read from.</li>
          <li><strong>Your business details</strong> — phone, address, hours, certifications, colours and logo. See <a href="#business">Business Details</a>.</li>
          <li><strong>Your page content</strong> — headlines, FAQ, services, industries, footer links, policy text. See <a href="#pagecontent">Page Content</a>.</li>
          <li><strong>Your PDF data sheets and product photos</strong> — the actual files, in two folders on the server.</li>
          <li><strong>Your inquiry log and change history</strong> — every contact-form lead and every change made here. See <a href="#inquiries">Inquiries</a> and <a href="#auditlog">Audit log</a>.</li>
        </ul>
        <div class="callout callout-tip">
          <b>Good to know</b>
          Changes you make here appear on the public website automatically — there's nothing extra to "publish." Allow up to <strong>60 seconds</strong> for a change to show up, since the site briefly caches data for speed. If you want to see it instantly, hold <strong>Ctrl+Shift+R</strong> (Windows) or <strong>Cmd+Shift+R</strong> (Mac) on the live page to force a fresh reload.
        </div>
        <div class="callout callout-tip">
          <b>Your safety net</b>
          Every single time you save a change, the dashboard keeps a timestamped copy of the previous version on the server — the <strong><?= (int)BACKUP_KEEP ?> most recent</strong> for each of your catalog, business details and page content. If something gets saved wrong, <strong>you can put it back yourself</strong> from the <strong>Backups</strong> page. See <a href="#backups">Backups &amp; undo</a>.
        </div>
      </section>

      <section class="help-section" id="quickref">
        <div class="eyebrow eyebrow-start">Getting Started</div>
        <h2>🔍 Quick reference: find what you need</h2>
        <p>Not sure where to start? Match what you're trying to do to a row below.</p>
        <table class="field-ref">
          <tr><td>Add a brand-new part to the catalog</td><td>See the full sequence at <a href="#walkthrough">Launching a new product, start to finish</a>, or jump straight to <a href="#adding">Adding a new product</a>.</td></tr>
          <tr><td>Fix a typo, price, or spec on an existing part</td><td><a href="#editing">Editing an existing product</a></td></tr>
          <tr><td>Add a photo to a product</td><td><a href="#photos">Product photos</a> — one click, straight from your computer</td></tr>
          <tr><td>Add or replace a downloadable spec sheet</td><td><a href="#pdfs">Managing PDF data sheets</a></td></tr>
          <tr><td>Change the measurements/size table on a product page</td><td><a href="#sizechart">Building the size / dimension chart</a></td></tr>
          <tr><td>Remove a part that's discontinued</td><td><a href="#deleting">Deleting a product</a></td></tr>
          <tr><td><strong>Undo a mistake / get something back</strong></td><td><a href="#backups">Backups &amp; undo</a> — you can do this yourself</td></tr>
          <tr><td><strong>Change your password</strong></td><td><a href="#password">Your admin password</a> — you can do this yourself</td></tr>
          <tr><td>Change the phone number, address, hours, logo or colours</td><td><a href="#business">Business Details</a></td></tr>
          <tr><td>Change wording on the site, the FAQ, services or footer links</td><td><a href="#pagecontent">Page Content</a></td></tr>
          <tr><td>See quote requests and messages from the website</td><td><a href="#inquiries">Inquiries</a></td></tr>
          <tr><td>Check who changed something and when</td><td><a href="#auditlog">Audit log / change history</a></td></tr>
          <tr><td>Something looks wrong or won't save</td><td><a href="#faq">Troubleshooting &amp; FAQ</a></td></tr>
        </table>
      </section>

      <section class="help-section" id="signing-in">
        <div class="eyebrow eyebrow-start">Getting Started</div>
        <h2>🔐 Signing in &amp; out</h2>
        <h3>Signing in</h3>
        <ol class="steps">
          <li>Go to your admin web address (the one your developer gave you — it ends in <code>/admin/</code>).</li>
          <li>Enter your admin password and click <span class="btn btn-primary btn-mock">Sign In →</span>.</li>
          <li>You'll land on the <strong>Product Catalog</strong> page — that's your home base.</li>
        </ol>
        <div class="callout callout-warning">
          <b>If your password is rejected repeatedly</b>
          After 5 incorrect attempts in a row, the sign-in page will pause briefly before letting you try again. This is a normal security precaution against guessing attacks, not an error — wait a few seconds and re-enter your password carefully (check that Caps Lock isn't on).
        </div>
        <h3>Signing out</h3>
        <p>Click <strong>Sign Out</strong> in the top-right corner of any page. Your sign-in stays active until you do this — simply closing the browser tab does <em>not</em> sign you out (fully closing the browser itself normally will). Always click Sign Out when you're using a shared or public computer rather than relying on the tab being closed.</p>
        <div class="callout callout-tip">
          <b>One password for everyone</b>
          This dashboard uses a single shared admin password rather than individual employee logins. If more than one person updates the catalog, everyone signs in with the same password. Keep that in mind for two things: anyone who has the password can make changes, and the <a href="#auditlog">Audit log</a> can only identify a change by device/location and time, not by which person was typing — see the note in that section.
        </div>
      </section>

      <section class="help-section" id="password">
        <div class="eyebrow eyebrow-start">Getting Started</div>
        <h2>🔑 Your admin password</h2>
        <p>This dashboard is protected by a single password — the same one is used by anyone who manages the catalog (see <a href="#signing-in">Signing in &amp; out</a>).</p>

        <div class="credentials-box">
          <div class="credentials-row"><span class="cred-label">Admin dashboard address</span><span class="cred-fill"></span></div>
        </div>

        <div class="callout callout-tip">
          <b>Keep it safe</b>
          Store your password in a password manager. <strong>Don't write it on this page, in a document, or in an email</strong> — anything you can print or attach is something that can be forwarded.
        </div>
        <div class="callout callout-tip">
          <b>You can change it yourself, any time</b>
          Click <strong>Password</strong> in the top navigation. You'll need your current password, then a new one of at least 12 characters — a short sentence or four random words is both stronger and easier to remember than something like <code>Xk7!p</code>. The change takes effect immediately and you stay signed in. You don't need to call anyone.
        </div>
        <div class="callout callout-warning">
          <b>If you've forgotten it</b>
          That one does need your FTP or file-manager login. Upload an empty file named <code>ALLOW-PASSWORD-RESET</code> (no file extension) into the <code>admin</code> folder, then open the dashboard address in a browser: instead of the password box you'll get a "Set Admin Password" screen. Set a new password and the file deletes itself.
          <br><br>
          <strong>That window is open for one hour</strong> from the moment you upload the file, and while it's open <em>anyone</em> who visits your admin address gets that same screen. Finish the reset straight away, and if you change your mind, delete the file again over FTP. If you're signed in when the file goes up, the dashboard shows a red banner with a <strong>Close it now</strong> button.
        </div>
      </section>

      <section class="help-section" id="dashboard">
        <div class="eyebrow eyebrow-start">Getting Started</div>
        <h2>📊 Reading the dashboard</h2>
        <p>The <strong>Product Catalog</strong> page (your home page after signing in) is organized like this, top to bottom:</p>
        <ul class="plain">
          <li><strong>Header bar</strong> — your logo on the left; on the right, quick links to Products, Add Product, Audit Log, and Help, plus a link to open the live public website in a new tab and Sign Out. This same navigation bar appears at the top of every admin page, so you're never more than one click from anywhere else in the dashboard.</li>
          <li><strong>Search bar</strong> — start typing a SKU (part number) or product name and the list filters instantly. Clear the box to see everything again. It only matches the SKU and Product Name fields — it won't find a product by searching for a spec value, a badge, or something in the description.</li>
          <li><strong>Summary cards</strong> — four at-a-glance numbers: Total Products, Categories, products <strong>With PDF</strong>, and products <strong>Missing PDF</strong>. Useful for spotting gaps — if "Missing PDF" looks too high, that's a quick to-do list.</li>
          <li><strong>Product tables</strong> — every product, grouped into sections by category (Part Type), each showing SKU, Product Name, Temp Rating, whether a data sheet exists, and action buttons.</li>
        </ul>

        <div class="diagram-wrap">
          <div class="diagram-caption">Dashboard layout at a glance</div>
          <svg viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram of the dashboard layout: header, search bar, summary cards, and product table">
            <rect x="1" y="1" width="638" height="338" rx="10" fill="#ffffff" stroke="#e5e9ee"/>
            <rect x="10" y="10" width="620" height="30" rx="6" fill="#0d2d52"/>
            <text x="22" y="29" font-family="system-ui,sans-serif" font-size="11" fill="#ffffff">IPC Admin · Products · + Add Product · Audit Log · Help · Sign Out</text>
            <text x="10" y="56" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#005da3">HEADER — same on every page</text>

            <rect x="10" y="66" width="430" height="24" rx="6" fill="#ffffff" stroke="#d1d9e0"/>
            <text x="20" y="82" font-family="system-ui,sans-serif" font-size="10" fill="#9ca3af">Search by SKU or product name…</text>
            <text x="450" y="82" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#005da3">← SEARCH BAR</text>

            <g font-family="system-ui,sans-serif">
              <rect x="10" y="100" width="145" height="46" rx="8" fill="#f0f4f8" stroke="#e5e9ee"/>
              <text x="20" y="122" font-size="16" font-weight="800" fill="#005da3">128</text>
              <text x="20" y="136" font-size="9" fill="#6b7280">Total Products</text>

              <rect x="164" y="100" width="145" height="46" rx="8" fill="#f0f4f8" stroke="#e5e9ee"/>
              <text x="174" y="122" font-size="16" font-weight="800" fill="#005da3">9</text>
              <text x="174" y="136" font-size="9" fill="#6b7280">Categories</text>

              <rect x="318" y="100" width="145" height="46" rx="8" fill="#f0f4f8" stroke="#e5e9ee"/>
              <text x="328" y="122" font-size="16" font-weight="800" fill="#005da3">94</text>
              <text x="328" y="136" font-size="9" fill="#6b7280">With PDF</text>

              <rect x="472" y="100" width="158" height="46" rx="8" fill="#f0f4f8" stroke="#e5e9ee"/>
              <text x="482" y="122" font-size="16" font-weight="800" fill="#005da3">34</text>
              <text x="482" y="136" font-size="9" fill="#6b7280">Missing PDF</text>
            </g>
            <text x="10" y="162" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#005da3">SUMMARY CARDS — at-a-glance counts</text>

            <text x="10" y="186" font-family="system-ui,sans-serif" font-size="11" font-weight="800" fill="#0d2d52">Fiberglass Sleeving (12)</text>
            <line x1="10" y1="192" x2="630" y2="192" stroke="#e5e9ee" stroke-width="2"/>

            <rect x="10" y="198" width="620" height="22" fill="#0d2d52"/>
            <text x="20" y="213" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#ffffff">SKU</text>
            <text x="110" y="213" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#ffffff">PRODUCT NAME</text>
            <text x="340" y="213" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#ffffff">TEMP RATING</text>
            <text x="440" y="213" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#ffffff">DATA SHEET</text>
            <text x="530" y="213" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#ffffff">ACTIONS</text>

            <rect x="10" y="220" width="620" height="30" fill="#ffffff"/>
            <text x="20" y="239" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#005da3">IP33PO</text>
            <text x="110" y="239" font-family="system-ui,sans-serif" font-size="9" fill="#374151">3:1 Polyolefin Heat Shrink Tubing</text>
            <text x="340" y="239" font-family="system-ui,sans-serif" font-size="9" fill="#6b7280">-55°C to 135°C</text>
            <rect x="440" y="228" width="60" height="16" rx="8" fill="rgba(0,190,242,0.15)"/>
            <text x="447" y="240" font-family="system-ui,sans-serif" font-size="8" fill="#0369a1">View PDF</text>
            <rect x="530" y="228" width="34" height="16" rx="8" fill="rgba(0,93,163,0.1)"/><text x="536" y="240" font-family="system-ui,sans-serif" font-size="8" fill="#005da3">Edit</text>
            <rect x="568" y="228" width="34" height="16" rx="8" fill="rgba(220,38,38,0.1)"/><text x="573" y="240" font-family="system-ui,sans-serif" font-size="8" fill="#dc2626">Del</text>

            <rect x="10" y="250" width="620" height="30" fill="#f8fafc"/>
            <text x="20" y="269" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#005da3">IP50PVDF</text>
            <text x="110" y="269" font-family="system-ui,sans-serif" font-size="9" fill="#374151">2:1 PVDF Heat Shrink Tubing</text>
            <text x="340" y="269" font-family="system-ui,sans-serif" font-size="9" fill="#6b7280">-55°C to 175°C</text>
            <text x="440" y="269" font-family="system-ui,sans-serif" font-size="8" fill="#9ca3af">None</text>
            <rect x="530" y="258" width="34" height="16" rx="8" fill="rgba(0,93,163,0.1)"/><text x="536" y="270" font-family="system-ui,sans-serif" font-size="8" fill="#005da3">Edit</text>
            <rect x="568" y="258" width="34" height="16" rx="8" fill="rgba(220,38,38,0.1)"/><text x="573" y="270" font-family="system-ui,sans-serif" font-size="8" fill="#dc2626">Del</text>

            <line x1="10" y1="280" x2="630" y2="280" stroke="#f0f4f8" stroke-width="2"/>
            <text x="10" y="302" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#005da3">PRODUCT TABLE — grouped by category, action buttons on the right</text>
            <text x="10" y="322" font-family="system-ui,sans-serif" font-size="9" fill="#9ca3af">(A simplified example — your real catalog will show your actual products.)</text>
          </svg>
        </div>

        <h3>The action buttons on each row</h3>
        <table class="field-ref">
          <tr><td><span class="btn btn-sm btn-edit btn-mock">Edit</span></td><td>Opens the full edit form for that product — every field is changeable here.</td></tr>
          <tr><td><span class="btn btn-sm btn-pdf btn-mock">Manage PDF</span></td><td>Upload, replace, or remove that product's downloadable data sheet.</td></tr>
          <tr><td><span class="btn btn-sm btn-edit btn-mock">View ↗</span></td><td>Opens that exact product on your live public website in a new tab — the fastest way to double-check how a change actually looks to customers.</td></tr>
          <tr><td><span class="btn btn-sm btn-danger btn-mock">Delete</span></td><td>Permanently removes the product after you confirm. See <a href="#deleting">Deleting a product</a>.</td></tr>
        </table>
        <p>This dashboard works in any modern desktop or tablet browser (Chrome, Edge, Safari, Firefox). On narrower screens, the product tables scroll left-to-right — drag within the table itself to reach the Actions column on the right.</p>
      </section>

      <section class="help-section" id="adding">
        <div class="eyebrow eyebrow-manage">Managing Products</div>
        <h2>➕ Adding a new product</h2>
        <ol class="steps">
          <li>From the dashboard, click <span class="btn btn-primary btn-mock">+ Add Product</span> in the top right (it's also in the header nav on every page).</li>
          <li>
            <strong>Fill in Basic Information.</strong> Three fields are required (marked with *):
            <table class="field-ref">
              <tr><td>SKU / Part Number *</td><td>A short, unique code for this part (e.g. <code>IP33PO</code>). This becomes part of the product's web address <em>and</em> the filename of its PDF, so keep it to letters, numbers, and dashes — no spaces. It must be different from every other SKU already in your catalog.</td></tr>
              <tr><td>Part Type *</td><td>Pick the category from the dropdown. This decides which section of the catalog (and which page grouping) the product appears under. The available categories are: Polyolefin Heat Shrink, PVDF Heat Shrink, Dual-Wall Heat Shrink, Medical Grade Heat Shrink, Elastomeric Heat Shrink, Fiberglass Sleeving, Expandable Sleeving, End Cap, Tape, Adhesive, and Accessory. This list is fixed — if you need a new category added, ask your web developer.</td></tr>
              <tr><td>Product Name *</td><td>The full name shown to customers, e.g. "3:1 Polyolefin Heat Shrink Tubing."</td></tr>
              <tr><td>Operating Temperature</td><td>Optional. Free text, e.g. <code>-55°C to 135°C</code>.</td></tr>
              <tr><td>Image Caption</td><td>Optional short line shown underneath the product photo.</td></tr>
              <tr><td>Specifications Summary</td><td>Optional one-line summary shown in list/index views — keep it under about 120 characters, e.g. <code>U/L 224 · RoHS · -55°C to 135°C</code>.</td></tr>
            </table>
            <div class="visual-note"><span class="vn-icon">💡</span><strong>Not the same field:</strong> "Specifications Summary" above is only a one-line teaser shown in list views. The full label/value list customers see on the product page itself is a separate step further down the form — see <a href="#specs">Building the specifications list</a>.</div>
          </li>
          <li>
            <strong>Feature Badges</strong> — type one badge per line (press Enter between each). These become small colored pill labels on the product page, e.g.:
            <div class="visual-note"><span class="vn-icon">🏷️</span>Example: typing <code>Flame Retardant</code> on one line and <code>RoHS Compliant</code> on the next creates two separate badges shown side by side on the live page.</div>
          </li>
          <li>
            <strong>Description Paragraphs</strong> — one paragraph per line. Each line you type becomes its own paragraph of body text on the product page.
            <div class="visual-note"><span class="vn-icon">🔤</span>Badges and description text show up exactly as typed — plain text only. Typing formatting like <code>&lt;b&gt;bold&lt;/b&gt;</code> or markdown-style asterisks won't make anything bold on the live page; it'll show up as literal characters instead.</div>
          </li>
          <li>
            <strong>Specifications</strong> — this is the label/value list customers see (Material, Color, Shrink Ratio, etc.). Use the visual builder — see <a href="#specs">Building the specifications list</a> below for a full walkthrough.
          </li>
          <li>
            <strong>Size chart</strong> — the grid of measurements (order sizes, expanded/recovered diameters, etc.), if this product has one. Use the visual builder — see <a href="#sizechart">Building the size / dimension chart</a> below.
          </li>
          <li>Click <span class="btn btn-primary btn-mock">Add Product</span> at the bottom of the form.</li>
          <li>You'll land back on the dashboard with a green confirmation message. Find your new product and click <span class="btn btn-sm btn-edit btn-mock">View ↗</span> to see it live (remember: allow ~60 seconds, or hard-refresh to see it immediately).</li>
        </ol>
        <div class="callout callout-tip">
          <b>About the photo</b>
          The Add Product form doesn't include a photo field — new products start with a branded placeholder image. Once the product is saved, click <span class="btn btn-sm btn-edit btn-mock">Photo</span> on its row on the dashboard and choose a picture from your computer. See <a href="#photos">Product photos</a>.
        </div>
        <div class="callout callout-warning">
          <b>If Add Product won't save</b>
          The form will list exactly what's missing or wrong at the top in a red box — most often a blank required field, or a SKU that's already used by another product. Fix what's listed and click Add Product again; nothing is lost from the rest of the form.
        </div>
      </section>

      <section class="help-section" id="editing">
        <div class="eyebrow eyebrow-manage">Managing Products</div>
        <h2>✏️ Editing an existing product</h2>
        <ol class="steps">
          <li>Find the product on the dashboard (use the search bar if your catalog is long) and click <span class="btn btn-sm btn-edit btn-mock">Edit</span>.</li>
          <li>Change any field you need to. Every field from <a href="#adding">Adding a new product</a> is here, plus a few extra:
            <table class="field-ref">
              <tr><td>Photo URL</td><td><strong>You normally never type in this box.</strong> Use the <span class="btn btn-sm btn-edit btn-mock">Photo</span> button on the product's dashboard row to upload a picture from your computer, and this field fills itself in — see <a href="#photos">Product photos</a>. It's here for the rare case where a picture already lives somewhere else on your own site and you want to point at it (<code>/images/product.jpg</code>). Leave it blank to keep the branded placeholder.</td></tr>
              <tr><td>Primary PDF Button Label</td><td>Customizes the text on the main download button, e.g. "Molded Cap" instead of the default "Download PDF." This only changes the button's <em>label</em> — upload the actual file from the <a href="#pdfs">PDF data sheets</a> page.</td></tr>
              <tr><td>Additional PDF Links</td><td>One per line, formatted as <code>/pdfs/filename.pdf | Button Label</code> (the label is optional). Each line adds an extra download button, for products that ship with more than one document.</td></tr>
            </table>
            <div class="callout callout-warning">
              <b>Additional PDF files need developer help</b>
              This field only creates the extra download <em>button and link</em> — it does not upload a file. The dashboard's file-upload tool (on the <a href="#pdfs">PDF data sheets</a> page) only handles a product's one primary data sheet. To add a second or third PDF, ask your web developer to place that file in the <code>/pdfs/</code> folder first; once it's there, you can point an Additional PDF Link at it yourself, the same way you'd link to any file.
            </div>
          </li>
          <li>Click <span class="btn btn-primary btn-mock">Save Changes</span>.</li>
        </ol>
        <div class="callout callout-tip">
          <b>Renaming a SKU</b>
          You can change a product's SKU on this page. If it has a PDF, that file is automatically renamed to match the new SKU, so the download link keeps working. If you try to rename it to a SKU that's already used by another product, the save is blocked with a clear error — just pick a different one.
        </div>
        <div class="callout callout-tip">
          <b>What happens to old links</b>
          Every product's web address is built from its SKU, so a bookmark or printed catalog using the old SKU stops pointing at this product. The visitor now gets a clear <em>"We couldn't find part …"</em> message with the full catalog underneath, so nobody is shown the wrong part by mistake. Renaming a SKU is safe — just expect old links to land on that message rather than on the product.
        </div>
        <div class="callout callout-warning">
          <b>"This product was changed by another session" message</b>
          If a co-worker (or you, in another browser tab) saved a change to this same product while you had this edit page open, your save will be stopped with this message instead of silently overwriting theirs. Reload the page to see the current version, then re-apply your change.
        </div>
        <div class="callout callout-tip">
          <b>Part Type showing "(current — non-standard)"</b>
          If a product's category isn't one of the standard options listed in <a href="#adding">Adding a new product</a> — usually because it came from older imported data — its current category appears pinned at the top of the dropdown, labeled "non-standard," so saving the form doesn't silently reassign it. You can leave it as-is or switch it to one of the standard categories.
        </div>
      </section>

      <section class="help-section" id="specs">
        <div class="eyebrow eyebrow-manage">Managing Products</div>
        <h2>📋 Building the specifications list</h2>
        <p>This is the label/value list shown on the left side of a product's detail page (Material, Color, Shrink Ratio, and so on). Both the Add and Edit forms use the same easy, visual builder — no code required.</p>
        <ol class="steps">
          <li>Click <span class="btn btn-primary btn-mock" style="background:#fff;color:#005da3;border:1px solid #d1d9e0;">+ Add specification</span> to add a new row.</li>
          <li>Type a <strong>Label</strong> (e.g. "Material") and its <strong>Value</strong> (e.g. "Polyolefin") into the two boxes.</li>
          <li>Leave the Label box empty to create a wide note row instead — useful for a standalone line like "RoHS Compliant · UL 224" that doesn't need its own label.</li>
          <li>Click the <strong>×</strong> button on the right of any row to remove it.</li>
        </ol>
        <div class="visual-note"><span class="vn-icon">👀</span>As you type, a <strong>"Live preview — what the website shows"</strong> panel appears right below the editor, so you can see exactly how the list will look on the public page before you even save.</div>
      </section>

      <section class="help-section" id="sizechart">
        <div class="eyebrow eyebrow-manage">Managing Products</div>
        <h2>📐 Building the size / dimension chart</h2>
        <p>This is the grid table on the right side of a product page — typically order sizes down the left and measurements (expanded diameter, recovered diameter, wall thickness, etc.) across the top. It also uses a visual, click-and-type builder.</p>

        <div class="diagram-wrap">
          <div class="diagram-caption">Example of a finished chart, as customers see it</div>
          <table class="field-ref" style="margin:0;">
            <!-- A10-029 — this header used to split "Expanded Diameter" into
                 Min | Max, which made every row print a Max exactly HALF its
                 Min. THE NUMBERS ARE CORRECT; the header was wrong. The third
                 column is the RECOVERED diameter — what the tubing shrinks
                 down to — and the catalog settles it: IP29CG, IP33PO, IP33TW
                 and IP34SR all carry "Expanded Diameter" and "Recovered
                 Diameter" as two SIBLING columns, and IP29CG's first row
                 (3/64" | .046" | .023" | .018") is the same 2:1 shape as the
                 example below. No product uses a Min | Max split, so the old
                 header was also teaching a structure the real data never uses.
                 The three data rows are deliberately byte-identical: editing
                 them to make "Max" exceed "Min" would put a fabricated
                 specification into the owner's own documentation.
                 The fourth column keeps the name "Wall Thickness" rather than
                 the catalog's "Recovered Wall": that pair is settled by the
                 2:1 ratio, but whether 0.020" is a recovered or a nominal wall
                 is not, and renaming it would assert something unverified. -->
            <tr>
              <th style="vertical-align:middle;">Order Size</th>
              <th style="text-align:center;">Expanded Diameter</th>
              <th style="text-align:center;">Recovered Diameter</th>
              <th style="vertical-align:middle;">Wall Thickness</th>
            </tr>
            <tr><td>3/4&quot;</td><td style="text-align:center;">0.750&quot;</td><td style="text-align:center;">0.375&quot;</td><td style="text-align:center;">0.020&quot;</td></tr>
            <tr><td>1&quot;</td><td style="text-align:center;">1.000&quot;</td><td style="text-align:center;">0.500&quot;</td><td style="text-align:center;">0.024&quot;</td></tr>
            <tr><td>1-1/2&quot;</td><td style="text-align:center;">1.500&quot;</td><td style="text-align:center;">0.750&quot;</td><td style="text-align:center;">0.030&quot;</td></tr>
          </table>
        </div>

        <h3>Building it by hand</h3>
        <table class="field-ref">
          <tr><td>+ Add column</td><td>Adds a new column header. Click into the heading box and type its name, e.g. "Order Size."</td></tr>
          <!-- A10-029 — this taught the same Min/Max shape the example chart
               above it got wrong, and no product in the catalog uses one. The
               replacement is real: IP30HS and IP30UV both split "Recovered"
               into "Diameter" and "Wall". The feature itself stays — 16 column
               spans across the catalog use it, including CC/CC90/CCS ("Part
               Dimensions (inches)" over A | B | C). -->
          <tr><td>Split into sub-columns</td><td>Turns one column heading into a group covering two or more narrower columns underneath it — e.g. a heading "Recovered" split into "Diameter" and "Wall."</td></tr>
          <tr><td>+ sub-column</td><td>Adds another narrow column under a heading that's already split.</td></tr>
          <tr><td>+ Add row</td><td>Adds a blank data row at the bottom. Click into each cell and type the value.</td></tr>
          <tr><td>× (on a row or column)</td><td>Removes that row or column, and shifts the rest to fill the gap.</td></tr>
        </table>
        <h3>Pasting straight from a spreadsheet</h3>
        <p>If you already have this data in Excel or Google Sheets, you don't need to retype it:</p>
        <ol class="steps">
          <li>Select and copy the block of cells in your spreadsheet (include the header row if you have one).</li>
          <li>In the size chart editor, click <span class="btn btn-primary btn-mock" style="background:#fff;color:#141414;border:1px solid #d1d9e0;">Paste from Excel</span>.</li>
          <li>Click into the box that appears and paste (Ctrl+V or Cmd+V).</li>
          <li>Leave <strong>"First row is the column headings"</strong> checked if you copied a header row, or uncheck it if you only copied data.</li>
          <li>Click <span class="btn btn-primary btn-mock" style="background:#fff;color:#005da3;border:1px solid #d1d9e0;">Fill grid</span> — the whole table is built for you instantly.</li>
        </ol>
        <div class="callout callout-tip">
          <b>Advanced mode</b>
          There's an <strong>Advanced</strong> link in the corner of both spec-table editors that shows the raw underlying data as text. This is entirely optional and meant for technical users only — the visual editor above does everything most people will ever need. If you do open Advanced mode by accident, just don't change anything and switch back; nothing is lost.
        </div>
      </section>

      <section class="help-section" id="photos">
        <div class="eyebrow eyebrow-manage">Managing Products</div>
        <h2>🖼️ Product photos</h2>
        <p>Every product on the dashboard has a <span class="btn btn-sm btn-edit btn-mock">Photo</span> button on its row. That is the whole feature — you pick a picture from your own computer and it is uploaded to your server. <strong>You do not need Dropbox, Google Drive, or any image-hosting service</strong>, and you do not need to know what a "direct link" is.</p>
        <ol class="steps">
          <li>On the <strong>Products</strong> page, find the product and click <span class="btn btn-sm btn-edit btn-mock">Photo</span>.</li>
          <li>Click <strong>Choose Image</strong> and pick a <code>.jpg</code>, <code>.png</code>, <code>.gif</code> or <code>.webp</code> file. It must be <strong><?= h(min_upload_label(8)) ?> or smaller</strong>.</li>
          <li>You'll see a preview. Click <strong>Upload</strong>.</li>
          <li>That's it — the product's Photo URL field is filled in for you automatically. The new picture appears on the public site within about a minute.</li>
        </ol>
        <div class="callout callout-tip">
          <b>What makes a good product photo</b>
          A plain, well-lit shot of the part on a white or light background, roughly square, at least 800&nbsp;pixels wide. Photos are shown fairly small on the site, so detail matters less than a clean background and sharp focus.
        </div>
        <div class="callout callout-tip">
          <b>Replacing or removing one</b>
          Uploading again simply replaces the old picture. To go back to the branded placeholder, open the product with <strong>Edit</strong> and clear the <strong>Photo URL</strong> box, then Save. Removing a photo that no other product uses also deletes the file from the server.
        </div>
      </section>

      <section class="help-section" id="pdfs">
        <div class="eyebrow eyebrow-manage">Managing Products</div>
        <h2>📄 Managing PDF data sheets</h2>
        <p>Every product can have a downloadable spec-sheet PDF. When a product has one, its page shows a <strong>"Download PDF"</strong> button; when it doesn't, customers instead see a <strong>"Request Data Sheet"</strong> button (so they can contact you directly).</p>
        <h3>Uploading a PDF for the first time</h3>
        <ol class="steps">
          <li>From the dashboard, click <span class="btn btn-sm btn-pdf btn-mock">Manage PDF</span> on the product's row (or the "Upload PDF" link at the top of its Edit page).</li>
          <li>Click <strong>Select PDF File</strong> and choose the file from your computer. It must be a genuine PDF, <strong><?= h(min_upload_label(20)) ?> or smaller</strong> — that is the lower of the dashboard's own 20MB limit and what your server accepts (see <a href="#server-limits">What your server allows</a>).</li>
          <li>Click <span class="btn btn-primary btn-mock">Upload PDF →</span>.</li>
          <li>You'll see a green confirmation, and the button on the product's live page switches to "Download PDF" automatically (allow up to 60 seconds, or hard-refresh to see it right away).</li>
        </ol>
        <h3>Replacing a PDF</h3>
        <p>Open the same "Manage PDF" page and upload a new file the same way. The new file <strong>overwrites the old one in place</strong> — the download link customers already have keeps working, and no leftover old file is left behind.</p>
        <h3>Removing a PDF</h3>
        <ol class="steps">
          <li>Open the product's "Manage PDF" page.</li>
          <li>Click the red <span class="btn btn-sm btn-mock" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;">Remove PDF</span> button next to the current file.</li>
          <li>Confirm the removal. The product reverts to showing "Request Data Sheet," and the file is deleted from the server.</li>
        </ol>
        <div class="callout callout-warning">
          <b>Shared data sheets</b>
          Some data sheets cover more than one related product (a single PDF listing several SKUs). If you remove that PDF from one product while another product still points to the same file, the dashboard automatically keeps the file safe on the server for the other product — it's only deleted once nothing references it anymore.
        </div>
      </section>

      <section class="help-section" id="deleting">
        <div class="eyebrow eyebrow-manage">Managing Products</div>
        <h2>🗑️ Deleting a product</h2>
        <ol class="steps">
          <li>From the dashboard, click <span class="btn btn-sm btn-danger btn-mock">Delete</span> on the product's row.</li>
          <li>Read the confirmation screen carefully — it names the exact product you're about to remove.</li>
          <li>Click <strong>Yes, Delete</strong> to confirm, or <strong>Cancel</strong> to back out.</li>
        </ol>
        <div class="callout callout-warning">
          <b>You can undo this yourself</b>
          Deleting a product removes it from the catalog immediately. Its PDF data sheet is deleted too (unless another product still shares that same file), and so is its uploaded photo (same rule). There's no "undo" button on this screen — but a backup of the whole catalog is written <em>immediately before</em> the deletion, so go to <strong>Backups</strong> and restore the most recent Product Catalog entry. See <a href="#backups">Backups &amp; undo</a>. Do it before you make other changes, since only the <?= (int)BACKUP_KEEP ?> most recent backups are kept.
        </div>
      </section>

      <section class="help-section" id="walkthrough">
        <div class="eyebrow eyebrow-manage">Managing Products</div>
        <h2>🚀 Launching a brand-new product, start to finish</h2>
        <p>Adding one part usually touches three different pages, not just the Add Product form. Here's the full sequence in order, pulling together the steps from the sections above:</p>
        <div class="callout callout-tip">
          <b>Before you start, have these ready</b>
          <!-- A10-028, third instance: this asked for "a hosted link to a
               product photo", the same abandoned workflow the diagram above
               was teaching. Photos are uploaded from the computer. -->
          The SKU/part number and category, the full product name, the photo file on your computer (if you have one), the PDF data sheet file (if you have one), and any specification or size-chart numbers. Having these on hand up front means you can usually do this in one sitting instead of stopping mid-form to go find something.
        </div>

        <div class="diagram-wrap">
          <div class="diagram-caption">The four-step sequence, visually</div>
          <svg viewBox="0 0 680 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram of the four steps: Add Product, Photo, Manage PDF, View">
            <g font-family="system-ui,sans-serif">
              <rect x="6" y="30" width="150" height="80" rx="10" fill="#eaf3fb" stroke="#9cc9e8"/>
              <circle cx="30" cy="30" r="14" fill="#005da3"/><text x="30" y="35" font-size="13" font-weight="800" fill="#fff" text-anchor="middle">1</text>
              <text x="81" y="60" font-size="12" font-weight="800" fill="#0d2d52" text-anchor="middle">Add Product</text>
              <text x="81" y="78" font-size="9" fill="#374151" text-anchor="middle">SKU, category,</text>
              <text x="81" y="92" font-size="9" fill="#374151" text-anchor="middle">name &amp; details</text>

              <text x="172" y="78" font-size="22" font-weight="800" fill="#9cc9e8" text-anchor="middle">→</text>

              <rect x="188" y="30" width="150" height="80" rx="10" fill="#eaf3fb" stroke="#9cc9e8"/>
              <circle cx="212" cy="30" r="14" fill="#005da3"/><text x="212" y="35" font-size="13" font-weight="800" fill="#fff" text-anchor="middle">2</text>
              <!-- A10-028 — this box read "Edit / Paste in a / Photo URL" and
                   contradicted numbered step 2 directly beneath it, which says
                   to click Photo and upload from the computer. The page also
                   says of the Photo URL field itself: "You normally never type
                   in this box." The diagram is the thing people actually read,
                   and it sent a non-technical owner off to find an image host.
                   Only the three strings changed; the x/y/font-size/anchor
                   attributes and the box geometry are untouched. -->
              <text x="263" y="60" font-size="12" font-weight="800" fill="#0d2d52" text-anchor="middle">Photo</text>
              <text x="263" y="78" font-size="9" fill="#374151" text-anchor="middle">Upload from</text>
              <text x="263" y="92" font-size="9" fill="#374151" text-anchor="middle">your computer</text>

              <text x="354" y="78" font-size="22" font-weight="800" fill="#9cc9e8" text-anchor="middle">→</text>

              <rect x="370" y="30" width="150" height="80" rx="10" fill="#eaf3fb" stroke="#9cc9e8"/>
              <circle cx="394" cy="30" r="14" fill="#005da3"/><text x="394" y="35" font-size="13" font-weight="800" fill="#fff" text-anchor="middle">3</text>
              <text x="445" y="60" font-size="12" font-weight="800" fill="#0d2d52" text-anchor="middle">Manage PDF</text>
              <text x="445" y="78" font-size="9" fill="#374151" text-anchor="middle">Upload the</text>
              <text x="445" y="92" font-size="9" fill="#374151" text-anchor="middle">data sheet</text>

              <text x="536" y="78" font-size="22" font-weight="800" fill="#9cc9e8" text-anchor="middle">→</text>

              <rect x="552" y="30" width="122" height="80" rx="10" fill="#eefaf1" stroke="#a7e2b8"/>
              <circle cx="576" cy="30" r="14" fill="#16a34a"/><text x="576" y="35" font-size="13" font-weight="800" fill="#fff" text-anchor="middle">4</text>
              <text x="613" y="60" font-size="12" font-weight="800" fill="#166534" text-anchor="middle">View ↗</text>
              <text x="613" y="78" font-size="9" fill="#374151" text-anchor="middle">Confirm it</text>
              <text x="613" y="92" font-size="9" fill="#374151" text-anchor="middle">looks right</text>
            </g>
          </svg>
        </div>

        <ol class="steps">
          <li>Go to <a href="#adding">Adding a new product</a> and fill in the Add Product form — SKU, Part Type, Product Name, badges, description, and (if the data is ready) the Specifications list and Size chart. Click <strong>Add Product</strong>.</li>
          <li>Click <span class="btn btn-sm btn-edit btn-mock">Photo</span> on the product you just created and upload a picture from your computer — see <a href="#photos">Product photos</a>. The Add form has no photo field, so this always happens as a second step.</li>
          <li>Click <span class="btn btn-sm btn-pdf btn-mock">Manage PDF</span> and upload the product's data sheet, if you have one — see <a href="#pdfs">Managing PDF data sheets</a>.</li>
          <li>Open the product with <span class="btn btn-sm btn-edit btn-mock">View ↗</span> and hard-refresh (<strong>Ctrl+Shift+R</strong> / <strong>Cmd+Shift+R</strong>) to check the photo, specs, size chart, and PDF button all look right.</li>
        </ol>
        <div class="visual-note"><span class="vn-icon">✅</span>None of this has to happen in one sitting. A product with no photo or PDF yet is still live and visible on the site — just less complete. Come back and finish it with Edit whenever the missing pieces are ready.</div>
      </section>

      <section class="help-section" id="business">
        <div class="eyebrow eyebrow-site">Your Website</div>
        <h2>🏢 Business Details</h2>
        <p>Click <strong>Business Details</strong> in the header. This one page controls the facts about your company that appear all over the public site — the phone number in the header, the address in the footer, the copyright year, your hours, your certifications, and the colours and logo.</p>
        <p>Change something here and it changes <em>everywhere it appears</em>. You never have to hunt for the same phone number on six pages.</p>
        <table class="field-ref">
          <tr><td>Company name, short name, slogan</td><td>Header, footer, page titles, and the information search engines read about you.</td></tr>
          <tr><td>Phone, fax, email</td><td>Header, footer, Contact page, About page. The phone number is also what the "call us" links dial, so type it the way you'd say it — the dialling version is a separate field beside it.</td></tr>
          <tr><td>Address, hours</td><td>Footer, Contact page, and the map listing search engines build from your site.</td></tr>
          <tr><td>Founded year</td><td>Drives the "© 1974–<?= date('Y') ?>" line automatically. You never update the second year.</td></tr>
          <tr><td>Certifications</td><td>ISO registration plus any others, shown in the footer and on the Quality page.</td></tr>
          <tr><td>Brand colours &amp; logo</td><td>Live preview on the right of the page as you change them.</td></tr>
          <tr><td>Social links</td><td>Not shown as icons on the site; they tell search engines which accounts are yours.</td></tr>
          <tr><td>Catalog PDF URL</td><td>Optional. Point it at a full-catalog PDF (e.g. <code>/pdfs/catalog.pdf</code>) and a "Full product catalog (PDF)" link appears in the site footer. Leave blank for no link.</td></tr>
        </table>
        <div class="callout callout-warning">
          <b>Most fields refuse to be left blank — on purpose</b>
          If you clear the phone number, the company name, the founded year or the address and save, the previous value comes back. That is deliberate: an empty phone number becomes a dead "call us" link and an empty year prints "©&nbsp;–<?= date('Y') ?>" to every visitor. To <em>change</em> one, type the new value over the old one.
          <br><br>
          The exceptions — fields you genuinely can clear, because "we don't have one" is a real answer — are <strong>fax number</strong>, the <strong>social links</strong>, <strong>short name</strong> and <strong>slogan</strong>. Clear one of those and it disappears from the site properly.
        </div>
        <div class="callout callout-tip">
          <b>If you have two tabs open</b>
          Save in one and the other will refuse to save, with a warning, rather than quietly overwriting what you just did. Nothing you typed is lost — it stays on the screen.
        </div>
      </section>

      <section class="help-section" id="pagecontent">
        <div class="eyebrow eyebrow-site">Your Website</div>
        <h2>📝 Page Content</h2>
        <p>Click <strong>Page Content</strong> in the header. This is the wording and the blocks of the public site: homepage headlines and button labels, the feature cards, the industries you serve, your services, the FAQ, the company milestones on the About page, the footer links, and the privacy/terms text.</p>
        <p>Each block is a row. Rows have <strong>↑ ↓</strong> buttons to reorder them, an <strong>✕</strong> to remove them, and a <strong>+ Add</strong> button at the bottom of each section.</p>
        <div class="callout callout-tip">
          <b>Deleting every row of a section really does empty it</b>
          If you remove all eight footer links, the site shows no footer links. Earlier versions quietly put the originals back; this one does what you asked. The same is true for FAQ entries, services, industries, milestones and the privacy text.
        </div>
        <div class="callout callout-warning">
          <b>Headings and labels won't go blank</b>
          Clearing a heading or a button label restores the previous wording rather than leaving an empty space, because a button with no text is one you can never find again to fix. To change one, type over it. Sub-headings <em>can</em> be cleared, since those are genuinely optional.
        </div>
        <div class="callout callout-warning">
          <b>If the page says it didn't submit completely</b>
          This form is large. If your server cuts the request short, you'll get a clear red message saying <strong>nothing was saved</strong> — and everything you typed is still on the screen. Remove a few entries, save, and add them back afterwards. If it keeps happening, send your developer the "Max form fields per save" number from <a href="#server-limits">What your server allows</a>.
        </div>
        <div class="callout callout-tip">
          <b>Every error keeps your typing</b>
          Whatever goes wrong on this page — a stale tab, a cut-off request, a permissions problem — the form comes back with your words in it, not the old ones from the server. You should never have to retype anything.
        </div>
      </section>

      <section class="help-section" id="inquiries">
        <div class="eyebrow eyebrow-site">Your Website</div>
        <h2>📥 Inquiries — every lead from the contact form</h2>
        <p>Click <strong>Inquiries</strong> in the header. Every quote request and message submitted through the website is recorded here, <em>including ones the mail server failed to send</em>. This is your safety net: if email breaks, the lead is still on this page.</p>
        <p>Click any row to expand it and see the full message, the part number, quantities, required date and the visitor's contact details. Reply from your own email program — this page does not send email.</p>
        <table class="field-ref">
          <tr><td><span class="badge-mock">Quote</span> / <span class="badge-mock">Message</span></td><td>Which form the visitor used. "Quote" is a full RFQ with part number and quantity.</td></tr>
          <tr><td><span class="badge-mock">Emailed</span></td><td>The notification reached your inbox. Normal.</td></tr>
          <tr><td><span class="badge-mock">Email failed</span></td><td>The mail server refused it. <strong>The lead is not lost</strong> — it's right here. If you see several of these, tell your developer.</td></tr>
          <tr><td><span class="badge-mock">Spam trap</span> / <span class="badge-mock">Rate limited</span> / <span class="badge-mock">Blocked</span></td><td>The website refused the submission. Almost always a bot. These are counted separately and are <em>not</em> an email problem.</td></tr>
        </table>
        <div class="callout callout-tip">
          <b>The two numbers at the top</b>
          <strong>Total received</strong> is everything ever submitted. <strong>Email delivery failed</strong> counts only genuine send failures — if that number is above zero, something is wrong with mail. Blocked spam is deliberately kept out of it so it can't cause a false alarm.
        </div>
        <div class="callout callout-tip">
          <b>Why a blocked entry might be worth reading</b>
          "Rate limited" can be a real customer: five people in one office share a single internet connection, and the sixth request inside ten minutes gets refused. Those are recorded here specifically so you can call them back.
        </div>
      </section>

      <section class="help-section" id="backups">
        <div class="eyebrow eyebrow-advanced">Advanced</div>
        <h2>↩️ Backups &amp; undo</h2>
        <p>Click <strong>Backups</strong> in the header. <strong>You can undo your own mistakes — you do not need to call anyone.</strong></p>
        <p>Every time you save products, business details or page content, a dated copy of the previous version is written first. The <?= (int)BACKUP_KEEP ?> most recent are kept for each of the three. Each entry shows what's inside it ("41 products", "17 content rows", your company name and phone) so you're not choosing between identical timestamps.</p>
        <ol class="steps">
          <li>Find the entry from just before the change you want to undo.</li>
          <li>Click <strong>Restore this version</strong> and confirm.</li>
          <li>Done. The site reflects it within about a minute.</li>
        </ol>
        <div class="callout callout-tip">
          <b>A restore can itself be undone</b>
          Restoring backs up the <em>current</em> state first, so if you restore the wrong one, the version you just replaced is now the newest entry in the list. You cannot get stuck.
        </div>
        <div class="callout callout-warning">
          <b>Act sooner rather than later</b>
          Only the <?= (int)BACKUP_KEEP ?> most recent are kept per file, and <em>every</em> save counts — including each photo upload, PDF upload, add and delete. A busy afternoon can push an older mistake off the end of the list.
        </div>
      </section>

      <section class="help-section" id="auditlog">
        <div class="eyebrow eyebrow-advanced">Advanced</div>
        <h2>🕒 Audit log / change history</h2>
        <p>Every add, edit, deletion, and PDF upload or removal made through this dashboard is automatically recorded — who made it (by IP address), exactly when, and what changed.</p>
        <ol class="steps">
          <li>Click <strong>Audit Log</strong> in the header navigation.</li>
          <li>Browse the list — newest changes are always at the top.</li>
          <li>Use the filter boxes to narrow it down: type a SKU to see everything that's happened to one specific product, or pick an action type (add, edit, delete, upload-pdf, remove-pdf) from the dropdown.</li>
          <li>Click <strong>Clear</strong> to reset the filters.</li>
        </ol>
        <h3>What each colored badge means</h3>
        <table class="field-ref">
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#dcfce7;color:#166534;">add</span></td><td>A brand-new product was created.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#dbeafe;color:#1e40af;">edit</span></td><td>An existing product's details were changed.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#fee2e2;color:#991b1b;">delete</span></td><td>A product was permanently removed.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#cffafe;color:#155e75;">upload-pdf</span></td><td>A data sheet was uploaded or replaced.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#fde68a;color:#92400e;">remove-pdf</span></td><td>A data sheet was removed from a product.</td></tr>
        </table>
        <div class="visual-note"><span class="vn-icon">🔍</span>Handy for questions like "did someone change this product's price recently?" or "who deleted that part last week?" — check here first before assuming something is a bug.</div>
        <div class="callout callout-tip">
          <b>What the audit log can (and can't) tell you</b>
          Because everyone signs in with the same shared password (see <a href="#signing-in">Signing in &amp; out</a>), the log identifies changes by IP address and timestamp, not by employee name. That's usually enough to tell "this came from the office" versus "this came from somewhere else," and it always shows exactly what changed and when — just not automatically which person was at the keyboard.
        </div>
      </section>

      <section class="help-section" id="faq">
        <div class="eyebrow eyebrow-reference">Reference</div>
        <h2>❓ Troubleshooting &amp; frequently asked questions</h2>

        <details class="faq">
          <summary>I saved a change but it doesn't show on the website yet.</summary>
          <p>This is expected — allow up to 60 seconds for the public site to catch up. To see it immediately, go to the live page and hold <strong>Ctrl+Shift+R</strong> (Windows) or <strong>Cmd+Shift+R</strong> (Mac) to force a full reload instead of using a cached copy.</p>
        </details>

        <details class="faq">
          <summary>I got "A product with this SKU already exists."</summary>
          <p>Every SKU (part number) must be unique across your whole catalog. Search the dashboard for that SKU to see the existing product, or choose a different SKU for the new one.</p>
        </details>

        <details class="faq">
          <summary>While editing, I got "Another product already uses SKU X."</summary>
          <p>You tried to rename a product's SKU to one that's already taken by a different product. Pick a different new SKU and save again.</p>
        </details>

        <details class="faq">
          <summary>The Specifications or Size Chart won't save — it mentions invalid data/JSON.</summary>
          <p>This usually only happens if the optional "Advanced" text box was edited directly and a bracket, quote, or comma got out of place. The safest fix is to close the page without saving, reopen Edit, and rebuild the change using the visual editor (the +Add specification / +Add row buttons) instead of the Advanced box. If you're not sure, ask your web developer to take a look.</p>
        </details>

        <details class="faq">
          <summary>My product photo isn't showing.</summary>
          <p>First, give it a minute and then hard-refresh the live page (<strong>Ctrl+Shift+R</strong> / <strong>Cmd+Shift+R</strong>). If it still isn't there, upload it again with the <strong>Photo</strong> button on the product's dashboard row — see <a href="#photos">Product photos</a>. If the upload itself is failing, check <a href="#server-limits">What your server allows</a>: the <code>uploads/images</code> row must say Yes, and the file must be <?= h(min_upload_label(8)) ?> or smaller.</p>
          <p>If the Photo URL box was filled in by hand with an address from somewhere else, clear it and use the Photo button instead. A product with no photo shows a branded placeholder rather than a broken image.</p>
        </details>

        <details class="faq">
          <summary>I can't log in — it says my password is incorrect.</summary>
          <p>Double-check Caps Lock and any extra spaces. After 5 incorrect attempts in a row, the page will briefly pause before allowing another try — this is a normal anti-guessing safeguard, not a lockout. Wait a few seconds and try again.</p>
        </details>

        <details class="faq">
          <summary>I want to change my password.</summary>
          <p>Click <strong>Password</strong> in the header navigation. You'll need your current password and a new one of at least 12 characters. It takes effect immediately and you stay signed in — no developer needed. See <a href="#password">Your admin password</a>.</p>
        </details>

        <details class="faq">
          <summary>I forgot the admin password entirely.</summary>
          <p>If you have your FTP or file-manager login you can recover it yourself: upload an empty file named <code>ALLOW-PASSWORD-RESET</code> into the <code>admin</code> folder, then open the dashboard — you'll get a "Set Admin Password" screen instead of the password box. The full steps, and the one-hour time limit, are in <a href="#password">Your admin password</a>. If you don't have FTP access, that is the point to call your developer.</p>
        </details>

        <details class="faq">
          <summary>Can two people use the dashboard at the same time?</summary>
          <p>Yes — everyone signs in with the same shared password. If two people happen to edit the exact same product at the same time, whoever saves second sees a warning instead of silently overwriting the first change (see <a href="#editing">Editing an existing product</a>). Editing two different products at the same time is completely safe.</p>
        </details>

        <details class="faq">
          <summary>How do I add a second PDF to a product that already has one?</summary>
          <p>Use the <strong>Additional PDF Links</strong> field on the Edit page — but note it only creates the extra download button, it doesn't upload the file. Ask your web developer to place the second PDF in the <code>/pdfs/</code> folder first, then point the link at it. See <a href="#editing">Editing an existing product</a>.</p>
        </details>

        <details class="faq">
          <summary>I deleted the wrong product — can I get it back?</summary>
          <p><strong>Yes, and you can do it yourself.</strong> A backup of the whole catalog is written immediately before every deletion. Go to <strong>Backups</strong>, find the most recent <em>Product Catalog</em> entry — the one whose product count is one higher than now — and click <strong>Restore this version</strong>. See <a href="#backups">Backups &amp; undo</a>. Do it before making other changes, since only the <?= (int)BACKUP_KEEP ?> most recent backups are kept.</p>
        </details>

        <details class="faq">
          <summary>I cleared the fax number (or a social link) and it came back.</summary>
          <p>Those are clearable and should stay cleared — if one reappears, you may have cleared a different field. Most Business Details fields deliberately refuse to go blank, because an empty phone number or founded year breaks the public site. See the note in <a href="#business">Business Details</a> for exactly which fields can be emptied.</p>
        </details>

        <details class="faq">
          <summary>The Inquiries page shows "Email failed" on some entries.</summary>
          <p>Those leads are safe — the message is stored here regardless. "Email failed" means only that the notification didn't reach your inbox. If several appear, tell your developer. Entries badged <strong>Spam trap</strong>, <strong>Rate limited</strong> or <strong>Blocked</strong> are <em>not</em> mail failures and are counted separately. See <a href="#inquiries">Inquiries</a>.</p>
        </details>

        <details class="faq">
          <summary>Page Content said "this page did not submit completely."</summary>
          <p>Your server cut the request short because the form has grown too large for its field limit. <strong>Nothing was saved, and nothing you typed was lost</strong> — it's all still on the screen. Remove a few entries, save, then add them back. Send your developer the "Max form fields per save" figure from <a href="#server-limits">What your server allows</a> to get the limit raised.</p>
        </details>
      </section>

      <section class="help-section" id="glossary">
        <div class="eyebrow eyebrow-reference">Reference</div>
        <h2>📖 Glossary of terms</h2>
        <table class="field-ref">
          <tr><td>SKU / Part Number</td><td>The unique code identifying one specific product, e.g. <code>IP33PO</code>. It also becomes part of that product's web address and its PDF file's name.</td></tr>
          <tr><td>Part Type</td><td>The category a product belongs to (Heat Shrink, End Cap, Tape, etc.), which controls where it's grouped on the dashboard and the site.</td></tr>
          <tr><td>Badge</td><td>A small colored pill shown on a product page highlighting a certification or feature, e.g. "RoHS Compliant."</td></tr>
          <tr><td>Specifications list</td><td>The label/value list on a product page (Material, Color, Shrink Ratio, etc.) — see <a href="#specs">Building the specifications list</a>.</td></tr>
          <tr><td>Size / dimension chart</td><td>The grid table of measurements on a product page (order sizes, expanded/recovered diameters, etc.) — see <a href="#sizechart">Building the size / dimension chart</a>.</td></tr>
          <tr><td>PDF data sheet</td><td>The downloadable spec-sheet document customers can get for a product — see <a href="#pdfs">Managing PDF data sheets</a>.</td></tr>
          <tr><td>Audit log</td><td>The running history of every change made through this dashboard — see <a href="#auditlog">Audit log / change history</a>.</td></tr>
          <tr><td>IP address</td><td>A number identifying the device/network a change came from, shown in the audit log. Since this dashboard uses one shared password, it tells you roughly where a change came from, not which employee made it.</td></tr>
          <tr><td>Backup</td><td>A dated copy of your catalog, business details or page content, saved automatically just before each change. Restore one yourself from <a href="#backups">Backups</a>.</td></tr>
          <tr><td>RFQ / Quote request</td><td>The longer contact form, with part number, quantity and required date. Arrives in <a href="#inquiries">Inquiries</a> badged "Quote".</td></tr>
          <tr><td>Honeypot / spam trap</td><td>A field on the contact form that is invisible to people but which automated spam programs fill in. Anything that fills it is recorded but not emailed to you.</td></tr>
          <tr><td>FTP</td><td>A way of copying files directly to and from your web server, separate from this dashboard. You only need it to recover a forgotten password — see <a href="#password">Your admin password</a>.</td></tr>
        </table>
      </section>

      <section class="help-section" id="help">
        <div class="eyebrow eyebrow-reference">Reference</div>
        <h2>🆘 Getting more help</h2>
        <h3>A quick safety checklist</h3>
        <ul class="plain">
          <li>Don't share the admin password over insecure channels like plain text or email if you can help it — anyone who has it can change the catalog (see <a href="#signing-in">Signing in &amp; out</a>).</li>
          <li>Don't edit the "Advanced" raw-text box in the Specifications or Size chart editors unless you're comfortable with it — the visual editor above it does everything most people need.</li>
          <li>Don't rename a SKU that's already been shared publicly unless you're prepared for old links to stop working (see the warning in <a href="#editing">Editing an existing product</a>).</li>
          <li>Check the <a href="#auditlog">Audit Log</a> before assuming something is a bug — it often shows a change was made on purpose.</li>
          <li>When in doubt before deleting something, it's always safe to click Cancel and double-check first — and if you do delete the wrong thing, go straight to <a href="#backups">Backups</a>.</li>
        </ul>
        <p>This guide covers everything you can do from inside the dashboard, which is nearly all of it — including <strong>changing your own password</strong> and <strong>restoring a backup</strong>, both of which used to be developer jobs and are not any more. What genuinely still needs your developer:</p>
        <ul class="plain">
          <li>Recovering a <em>forgotten</em> password, if you don't have your own FTP login (see <a href="#password">Your admin password</a> — you can do it yourself if you do)</li>
          <li>Adding a second or third PDF <em>file</em> to a product (see <a href="#editing">Editing an existing product</a>)</li>
          <li>Changing the overall look, layout, or features of the public website beyond what <a href="#business">Business Details</a> and <a href="#pagecontent">Page Content</a> cover</li>
          <li>Anything in <a href="#server-limits">What your server allows</a> reading a value you were told it shouldn't</li>
        </ul>
        <p>For anything covered on this page that isn't behaving the way it's described, that's worth flagging to your developer too — it may be worth a second look.</p>
      </section>

      <section class="help-section" id="server-limits">
        <div class="eyebrow eyebrow-reference">Reference</div>
        <h2>🖥️ What your server allows</h2>
        <p>These are read live from the server right now, not typed into the page. If an upload is rejected as "too large", compare the file against the first two numbers. If they read 2M and 8M, the <code>.user.ini</code> file that raises them is not being applied on this host &mdash; send this section to your developer.</p>
        <table class="field-ref">
          <tr><th>Largest single file the server accepts</th><td><code><?= h(ini_get('upload_max_filesize') ?: 'unknown') ?></code></td></tr>
          <tr><th>Largest whole form submission</th><td><code><?= h(ini_get('post_max_size') ?: 'unknown') ?></code></td></tr>
          <tr><th>Max form fields per save</th><td><code><?= h((string)(ini_get('max_input_vars') ?: 'unknown')) ?></code> (the Page Content form currently posts about 450)</td></tr>
          <tr><th>Signed-out after inactivity</th><td><code><?= h((string)round(((int)ini_get('session.gc_maxlifetime')) / 60)) ?> minutes</code></td></tr>
          <tr><th>PHP version</th><td><code><?= h(PHP_VERSION) ?></code></td></tr>
          <tr><th><code>admin</code> folder writable</th><td><?= admin_writable() ? 'Yes' : '<strong style="color:#dc2626">NO &mdash; sales leads are being discarded</strong>' ?></td></tr>
          <tr><th><code>data</code> folder writable</th><td><?= data_writable() ? 'Yes' : '<strong style="color:#dc2626">NO &mdash; nothing you edit can be saved</strong>' ?></td></tr>
          <tr><th><code>uploads/images</code> writable</th><td><?= (is_dir(IMG_DIR) && is_writable(IMG_DIR)) ? 'Yes' : '<strong style="color:#dc2626">NO &mdash; photo uploads will fail</strong>' ?></td></tr>
          <tr><th>Backups kept per file</th><td><code><?= (int)BACKUP_KEEP ?></code></td></tr>
        </table>
        <div class="callout callout-tip">
          <b>The two limits that actually apply to you</b>
          A data sheet must be a PDF and <strong><?= h(min_upload_label(20)) ?> or smaller</strong>; a product photo must be <strong><?= h(min_upload_label(8)) ?> or smaller</strong>. Those are the <em>lower</em> of the server's figure above and the dashboard's own cap (20MB for PDFs, 8MB for photos), so raising the server number alone will not lift them.
        </div>
      </section>

    </div>
  </div>
</main>
<a href="#" class="back-to-top" title="Back to top" aria-label="Back to top">↑</a>
<script src="help.js"></script>
</body>
</html>
