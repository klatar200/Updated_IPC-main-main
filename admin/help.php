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
  <?= admin_head() ?>
  <style>
    html { scroll-behavior: smooth; }

    /* Header (matches index.php) */
    /* Only the sticky part. Every other property this rule used to carry
       (background, padding, height, display, align-items, justify-content) was
       a copy of nav.php's `.ipc-admin-header`, which outranks a bare `header`
       and was already winning — see the A10-021 note there, which had to add
       `height: auto` precisely to beat these copies. `position` is the one
       thing nav.php does not set, so Help's sticky nav is real and stays. */
    header { position: sticky; top: 0; z-index: 20; }
    nav a:hover, nav a.current { color: #fff; }
    nav a.current { border-bottom: 2px solid #005da3; padding-bottom: 4px; }

    .page-header { margin-bottom: 28px; background: linear-gradient(135deg, #0d2d52 0%, #005da3 100%); border-radius: 16px; padding: 28px 32px; display: flex; align-items: center; gap: 20px; box-shadow: 0 8px 24px rgba(13,45,82,0.18); }
    .page-header-icon { font-size: 30px; width: 58px; height: 58px; flex-shrink: 0; background: rgba(255,255,255,0.15); border-radius: 14px; display: flex; align-items: center; justify-content: center; }
    .page-header h1 { font-size: 26px; font-weight: 800; margin: 0 0 6px; color: #fff; }
    .page-header p  { font-size: 14px; color: rgba(255,255,255,0.82); margin: 0; max-width: 720px; line-height: 1.6; }

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
    /* #sitemap's tables: the left column is a description, not a label, so it wraps (nowrap put it 325px past a 1440 viewport). */
    table.map-ref td:first-child { white-space: normal; width: 38%; }

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

<main class="admin-wide">
  <div class="page-header">
    <div class="page-header-icon">📘</div>
    <div>
      <h1>Help</h1>
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
      <a href="#sitemap">Where each part of the site is edited</a>
      <a href="#business">Business Details</a>
      <a href="#pagecontent">Page Content</a>
      <a href="#inquiries">Inquiries (contact-form leads)</a>

      <div class="toc-group">⚙️ Advanced</div>
      <a href="#backups">Backups &amp; undo</a>
      <a href="#auditlog">Audit log / change history</a>
      <a href="#health">Server warnings on the dashboard</a>

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
          <li><strong>Your business details</strong> — phone, address, hours, certifications, colors and logo. See <a href="#business">Business Details</a>.</li>
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
          <tr><td>Add or replace a downloadable data sheet</td><td><a href="#pdfs">Managing PDF data sheets</a></td></tr>
          <tr><td>Change the measurements/size table on a product page</td><td><a href="#sizechart">Building the size / dimension chart</a></td></tr>
          <tr><td>Remove a part that's discontinued</td><td><a href="#deleting">Deleting a product</a></td></tr>
          <tr><td><strong>Undo a mistake / get something back</strong></td><td><a href="#backups">Backups &amp; undo</a> — you can do this yourself</td></tr>
          <tr><td><strong>Change your password</strong></td><td><a href="#password">Your admin password</a> — you can do this yourself</td></tr>
          <tr><td><strong>Find where anything on a page is edited</strong></td><td><a href="#sitemap">Where each part of the site is edited</a> — every page, top to bottom</td></tr>
          <tr><td>Change the phone number, address, hours, logo or colors</td><td><a href="#business">Business Details</a></td></tr>
          <tr><td>Change the auto-reply email, or add a holiday notice</td><td><a href="#pagecontent">Page Content</a> → Contact Page — Form → the three <em>Auto-reply</em> boxes at the bottom</td></tr>
          <tr><td>Put up a new page photo or logo</td><td><a href="#newfiles">Putting a new photo or logo on the server</a></td></tr>
          <tr><td>Change wording on the site, the FAQ, services or footer links</td><td><a href="#pagecontent">Page Content</a></td></tr>
          <tr><td>Add or rename a product category</td><td><a href="#pagecontent">Page Content</a> → Product Families / Categories — you can do this yourself</td></tr>
          <tr><td>Change the title or description Google shows for a page</td><td><a href="#pagecontent">Page Content</a> → Search Engine Text (SEO)</td></tr>
          <tr><td>Swap the homepage, About or Services photo</td><td><a href="#pagecontent">Page Content</a> → Site Images</td></tr>
          <tr><td><strong>A red "server setup problem" box appeared</strong></td><td><a href="#health">If the dashboard warns you about the server</a></td></tr>
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
          <li>You'll land on the <strong>Products</strong> page — that's your home base.</li>
        </ol>
        <div class="callout callout-warning">
          <b>If your password is rejected repeatedly</b>
          <!-- NEW-N3-10 — this said "after 5". login_attempt_gate() counts an
               attempt on the way in and only refuses once a stored cool-off is
               in the future, and login_cooloff_until() starts one only when the
               count passes LOGIN_FREE_ATTEMPTS: so attempts 1-6 are all checked
               and the 7th is the first refused. Numbers come from the constants
               so this cannot drift from config.php again. -->
          After <?= (int)LOGIN_FREE_ATTEMPTS + 1 ?> wrong passwords in a row, the sign-in page asks you to wait <strong><?= (int)LOGIN_COOLOFF_BASE ?> seconds</strong> before it will check another one — even the right one. Each further wrong password doubles the wait, up to a maximum of <strong><?= (int)round(LOGIN_COOLOFF_MAX / 60) ?> minutes</strong>. It never locks you out permanently, and it forgets the failed attempts entirely after <?= (int)round(LOGIN_THROTTLE_WINDOW / 60) ?> quiet minutes. This is a normal security precaution against guessing attacks, not an error. Wait it out and re-enter your password carefully (check that Caps Lock isn't on).
        </div>
        <h3>Signing out</h3>
        <p>Click <strong>Sign Out</strong> in the top-right corner of any page. Your sign-in stays active until you do this, until <strong><?= (int)(ADMIN_IDLE_LIMIT / 3600) ?> hours</strong> pass without you opening or saving a page, or <strong><?= (int)(ADMIN_ABSOLUTE_LIMIT / 3600) ?> hours</strong> after you signed in, whichever comes first. A page left open does not count as using the dashboard. Simply closing the browser tab does <em>not</em> sign you out (fully closing the browser itself normally will). Always click Sign Out when you're using a shared or public computer rather than relying on the tab being closed. If you are ever signed out in the middle of an edit, see <em>"I was signed out in the middle of editing"</em> in <a href="#faq">Troubleshooting</a> before you press anything.</p>
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
          <strong>That window is open for one hour</strong> from the moment you upload the file, and while it's open <em>anyone</em> who visits your admin address gets that same screen. Finish the reset straight away, and if you change your mind, delete the file again over FTP. If you're signed in when the file goes up, the dashboard shows a red banner with a <strong>Close It Now</strong> button.
        </div>
      </section>

      <section class="help-section" id="dashboard">
        <div class="eyebrow eyebrow-start">Getting Started</div>
        <h2>📊 Reading the dashboard</h2>
        <p>The <strong>Products</strong> page (your home page after signing in) is organized like this, top to bottom:</p>
        <ul class="plain">
          <li><strong>Header bar</strong> — your logo on the left; on the right, a link to every page of the dashboard: <strong>Products</strong>, <strong>+ Add Product</strong>, <strong>Business Details</strong>, <strong>Page Content</strong>, <strong>Inquiries</strong> (with a red number when new leads have arrived since you last looked), <strong>Backups</strong>, <strong>Audit Log</strong>, <strong>Password</strong> and <strong>Help</strong>, plus <strong>View Live Site ↗</strong> to open the public website in a new tab and <strong>Sign Out</strong>. This same navigation bar appears at the top of every admin page, so you're never more than one click from anywhere else in the dashboard.</li>
          <li><strong>Search bar</strong> — start typing a SKU (part number) or product name and the list filters instantly. Clear the box to see everything again. It only matches the SKU and Product Name fields — it won't find a product by searching for a spec value, a badge, or something in the description.</li>
          <li><strong>Summary cards</strong> — four at-a-glance numbers: Total Products, Categories, products <strong>With PDF</strong>, and products <strong>Missing PDF</strong>. Useful for spotting gaps — if "Missing PDF" looks too high, that's a quick to-do list.</li>
          <li><strong>Product tables</strong> — every product, grouped into sections by category (Part Type), each showing SKU, Product Name, Temp Rating, whether a data sheet exists, and action buttons.</li>
        </ul>

        <div class="diagram-wrap">
          <div class="diagram-caption">Dashboard layout at a glance</div>
          <svg viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram of the dashboard layout: header, search bar, summary cards, and product table">
            <rect x="1" y="1" width="638" height="338" rx="10" fill="#ffffff" stroke="#e5e9ee"/>
            <rect x="10" y="10" width="620" height="30" rx="6" fill="#0d2d52"/>
            <!-- ADM-9(d) — this omitted Inquiries and View Live Site; it now
                 lists admin/nav.php's items in nav.php's order. Two more items
                 would run past the bar at the old 9px, so the size drops to 8
                 and textLength pins the line inside the 620px bar. -->
            <text x="20" y="29" font-family="system-ui,sans-serif" font-size="8" fill="#ffffff" textLength="600" lengthAdjust="spacingAndGlyphs">IPC Admin · Products · + Add Product · Business Details · Page Content · Inquiries · Backups · Audit Log · Password · Help · View Live Site ↗ · Sign Out</text>
            <text x="10" y="56" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#005da3">HEADER — same on every page</text>

            <rect x="10" y="66" width="430" height="24" rx="6" fill="#ffffff" stroke="#d1d9e0"/>
            <text x="20" y="82" font-family="system-ui,sans-serif" font-size="9" fill="#9ca3af">Search by SKU / part number or product name…</text>
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
          <tr><td><span class="btn btn-sm btn-pdf btn-mock">Photo</span></td><td>Upload, replace, or remove that product's photo, straight from your computer. See <a href="#photos">Product photos</a>.</td></tr>
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
              <tr><td>SKU / Part Number *</td><td>A short, unique code for this part (e.g. <code>IP33PO</code>). This becomes part of the product's web address <em>and</em> the filenames of its PDF and photo. It may use letters, numbers, spaces and the characters <code>- _ . / &amp; + ,</code> (up to 64 characters) — plain letters, numbers and dashes are simplest. It must be different from every other SKU already in your catalog, and that check <strong>ignores capitals, spaces and punctuation</strong>: <code>ip-33 po</code> counts as the same SKU as <code>IP33PO</code> and is refused, because the website and the file names would treat them as one.</td></tr>
              <tr><td>Part Type *</td><td>Pick the category from the dropdown. This decides which section of the catalog (and which page grouping) the product appears under. <strong>You control this list yourself</strong> — it comes from <strong>Page Content → Product Families / Categories</strong>, where you can add a category, rename one, or reorder them with the ↑ ↓ buttons — that order is the order the catalog sidebar and the Products menu use. See <a href="#pagecontent">Page Content</a>.</td></tr>
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
            <strong>Approvals &amp; Certifications</strong> — tick every approval this part genuinely holds. These are tick-boxes rather than free text on purpose: they drive the approval filters and the certification badges on the public site, so they have to be the same words everywhere. The twelve available are <code>UL Recognized</code>, <code>UL Listed</code>, <code>UL Approved</code>, <code>cUL</code>, <code>CSA</code>, <code>MIL-SPEC</code>, <code>RoHS</code>, <code>FDA</code>, <code>USP Class VI</code>, <code>ISO 10993-5</code>, <code>UL VW-1</code> and <code>UL-94</code>.
            <!-- Docs audit 2026-09-29 — this said "If a part is RoHS compliant, do
                 both". isStandardBadge() in src/App.jsx drops any badge that names
                 a standard from Product Features, so the badge half never shows. -->
            <div class="visual-note"><span class="vn-icon">✅</span>Tick the box — don't type "RoHS" (or UL, MIL-SPEC, FDA …) as a Feature Badge. The tick-box is the fact a buyer can filter on and it shows as an Approvals chip on the product page; a badge that names a standard is deliberately left out of the "Product Features" chips so the same certification is never listed twice.</div>
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
              <tr><td>Primary PDF Button Label</td><td>Customizes the text on the main download button, e.g. "Molded Cap" instead of the default "Datasheet." This only changes the button's <em>label</em> — upload the actual file from the <a href="#pdfs">PDF data sheets</a> page.</td></tr>
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
          You can change a product's SKU on this page. If it has a PDF, that file is automatically renamed to match the new SKU, so the download link keeps working — unless another product shares that same file, in which case it keeps its old name so the other product's link keeps working too, and the confirmation message says so. If you try to rename it to a SKU that's already used by another product (or one that differs from it only in capitals, spaces or punctuation), the save is blocked with a clear error — just pick a different one.
        </div>
        <div class="callout callout-tip">
          <b>What happens to old links</b>
          <!-- ADM-9(i) — the site looks a product up by its `id`, not its SKU.
               add.php:68 and edit.php:37 both set id = sku on every save, and
               every product in the shipped catalog already has id = sku. -->
          Every product's web address is built from its product ID, which the dashboard sets to the SKU every time the product is saved — so changing the SKU changes the address, and a bookmark or printed catalog using the old SKU stops pointing at this product. The visitor now gets a clear <em>"We couldn't find part …"</em> message with the full catalog underneath, so nobody is shown the wrong part by mistake. Renaming a SKU is safe — just expect old links to land on that message rather than on the product.
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
          <li>Click <span class="btn btn-primary btn-mock" style="background:#fff;color:#005da3;border:1px solid #d1d9e0;">+ Add Specification</span> to add a new row.</li>
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
          <tr><td>+ Add Column</td><td>Adds a new column header. Click into the heading box and type its name, e.g. "Order Size."</td></tr>
          <!-- A10-029 — this taught the same Min/Max shape the example chart
               above it got wrong, and no product in the catalog uses one. The
               replacement is real: IP30HS and IP30UV both split "Recovered"
               into "Diameter" and "Wall". The feature itself stays — 16 column
               spans across the catalog use it, including CC/CC90/CCS ("Part
               Dimensions (inches)" over A | B | C). -->
          <tr><td>Split into Sub-columns</td><td>Turns one column heading into a group covering two or more narrower columns underneath it — e.g. a heading "Recovered" split into "Diameter" and "Wall."</td></tr>
          <tr><td>+ sub-column</td><td>Adds another narrow column under a heading that's already split.</td></tr>
          <tr><td>+ Add Row</td><td>Adds a blank data row at the bottom. Click into each cell and type the value.</td></tr>
          <tr><td>× (on a row or column)</td><td>Removes that row or column, and shifts the rest to fill the gap.</td></tr>
        </table>
        <h3>Pasting straight from a spreadsheet</h3>
        <p>If you already have this data in Excel or Google Sheets, you don't need to retype it:</p>
        <ol class="steps">
          <li>Select and copy the block of cells in your spreadsheet (include the header row if you have one).</li>
          <li>In the size chart editor, click <span class="btn btn-primary btn-mock" style="background:#fff;color:#141414;border:1px solid #d1d9e0;">Paste from Excel</span>.</li>
          <li>Click into the box that appears and paste (Ctrl+V or Cmd+V).</li>
          <li>Leave <strong>"First row is the column headings"</strong> checked if you copied a header row, or uncheck it if you only copied data.</li>
          <li>Click <span class="btn btn-primary btn-mock" style="background:#fff;color:#005da3;border:1px solid #d1d9e0;">Fill Grid</span> — the whole table is built for you instantly.</li>
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
          <li>Click <strong>Choose File</strong> and pick a <code>.jpg</code>, <code>.png</code>, <code>.gif</code> or <code>.webp</code> file. It must be <strong><?= h(min_upload_label(8)) ?> or smaller</strong>.</li>
          <li>Click <strong>Upload Photo →</strong>.</li>
          <li>That's it — the product's Photo URL field is filled in for you automatically. The new picture appears on the public site within about a minute.</li>
        </ol>
        <div class="callout callout-tip">
          <b>What makes a good product photo</b>
          A plain, well-lit shot of the part on a white or light background, roughly square, at least 800&nbsp;pixels wide. Photos are shown fairly small on the site, so detail matters less than a clean background and sharp focus. A photo straight off your phone is fine — anything wider than <?= (int)IMG_MAX_WIDTH ?>&nbsp;pixels is scaled down automatically so pages stay fast, and the upload screen tells you when that happens.
        </div>
        <div class="callout callout-tip">
          <b>Replacing or removing one</b>
          Uploading again simply replaces the old picture. To go back to the branded placeholder, open the <span class="btn btn-sm btn-edit btn-mock">Photo</span> screen again and click <strong>Remove Photo</strong> — that clears the product's Photo URL <em>and</em> deletes the file from the server, as long as no other product is still using it.
          <br><br>
          You can also clear the <strong>Photo URL</strong> box on the <strong>Edit</strong> screen, and the placeholder comes back the same way — but that only forgets the link. The image file itself stays on the server, where nothing lists it and nothing will ever clean it up. Use <strong>Remove Photo</strong> unless you have a reason not to.
        </div>
      </section>

      <section class="help-section" id="pdfs">
        <div class="eyebrow eyebrow-manage">Managing Products</div>
        <h2>📄 Managing PDF data sheets</h2>
        <p>Every product can have a downloadable data sheet PDF. When a product has one, its page shows a <strong>"Datasheet"</strong> button; when it doesn't, customers instead see a <strong>"Request Datasheet"</strong> button (so they can contact you directly).</p>
        <h3>Uploading a PDF for the first time</h3>
        <ol class="steps">
          <li>From the dashboard, click <span class="btn btn-sm btn-pdf btn-mock">Manage PDF</span> on the product's row (or the "Upload PDF" link at the top of its Edit page).</li>
          <li>Click <strong>Select PDF File</strong> and choose the file from your computer. It must be a genuine PDF, <strong><?= h(min_upload_label(20)) ?> or smaller</strong> — that is the lower of the dashboard's own 20MB limit and what your server accepts (see <a href="#server-limits">What your server allows</a>).</li>
          <li>Click <span class="btn btn-primary btn-mock">Upload PDF →</span>.</li>
          <li>You'll see a green confirmation, and the button on the product's live page switches to "Datasheet" automatically (allow up to 60 seconds, or hard-refresh to see it right away).</li>
        </ol>
        <h3>Replacing a PDF</h3>
        <p>Open the same "Manage PDF" page and upload a new file the same way. The new file <strong>overwrites the old one in place</strong> — the download link customers already have keeps working, and no leftover old file is left behind.</p>
        <h3>Removing a PDF</h3>
        <ol class="steps">
          <li>Open the product's "Manage PDF" page.</li>
          <li>Click the red <span class="btn btn-sm btn-mock" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;">Remove PDF</span> button next to the current file.</li>
          <li>Confirm the removal. The product reverts to showing "Request Datasheet," and the file is deleted from the server.</li>
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
          Deleting a product removes it from the catalog immediately. Its PDF data sheet comes off the website too (unless another product still shares that same file), and so does its uploaded photo (same rule) — both are kept out of sight on the server rather than erased. There's no "undo" button on this screen — but a backup of the whole catalog is written <em>immediately before</em> the deletion, so go to <strong>Backups</strong> and restore the most recent Product Catalog entry: the product, its data sheet and its photo all come back. See <a href="#backups">Backups &amp; undo</a>. Do it before you make other changes, since only the <?= (int)BACKUP_KEEP ?> most recent backups are kept.
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

      <!-- Page-by-page map, added 2026-09-29 (owner-docs audit). Every row was
           measured, not read off the code: _harness/docmap.js writes a unique
           marker into every Page Content and Business Details field through the
           real admin forms, loads every page, and records where each marker
           appears; the "Fixed" rows are the text no field reaches. If you add a
           field to content.php or settings.php, add its row here — docmap.js
           fails until you do. -->
      <section class="help-section" id="sitemap">
        <div class="eyebrow eyebrow-site">Your Website</div>
        <h2>🗺️ Where each part of the website is edited</h2>
        <p>Every word, photo and link on your public website comes from one of four places:</p>
        <ul class="plain">
          <li><strong>Business Details</strong> — the facts about your company (phone, address, hours, certifications, colors, logo). Change one there and it changes on every page at once. See <a href="#business">Business Details</a>.</li>
          <li><strong>Page Content</strong> — the wording and the lists: headings, buttons, cards, FAQ, menus, the privacy policy. Each section below names the exact box. See <a href="#pagecontent">Page Content</a>.</li>
          <li><strong>The product itself</strong> — anything about one part comes from its <strong>Edit</strong>, <strong>Photo</strong> and <strong>Manage PDF</strong> screens on the Products page.</li>
          <li><strong>Fixed</strong> — part of the site's design. Nothing in this dashboard changes it; ask your developer. These are listed below so you don't go looking for a box that doesn't exist.</li>
        </ul>
        <div class="callout callout-tip">
          <b>You don't need to retype your phone number in the wording</b>
          The website swaps the <em>original</em> phone number, fax, email and address for your current Business Details wherever they appear inside FAQ answers, the privacy policy, search-engine descriptions and the contact form's error messages. It does the same for the original business hours, city and street, founded year, minimum order and "25 million" stock figure inside all Page Content wording. So after you change one of those in Business Details, the older wording keeps up by itself. (A <em>new</em> sentence you type yourself is shown exactly as typed.)
        </div>

        <h3>On every page — the header (top bar and menus)</h3>
        <table class="field-ref map-ref">
          <tr><td>Logo</td><td>Business Details → <strong>Logo URL</strong>. To use a new logo file, see <a href="#newfiles">Putting a new photo or logo on the server</a>.</td></tr>
          <tr><td>"INSULATION PRODUCTS CORPORATION" beside the logo</td><td><strong>Fixed.</strong> It does not follow the Company name field.</td></tr>
          <tr><td>The small line under the name</td><td>Business Details → <strong>Slogan / Tagline</strong> (clear it and the line disappears).</td></tr>
          <tr><td>"Home", "Products", "Company" and the <strong>Request a Quote</strong> button</td><td>Page Content → <strong>Navigation — Header Labels</strong>.</td></tr>
          <tr><td>Products menu: its column headings and the Browse All / Product Index / Datasheets links</td><td>Page Content → <strong>Navigation — Header Labels</strong>. The small grey line under each link is <strong>fixed</strong>.</td></tr>
          <tr><td>Products menu: the list of categories</td><td>Built from your products' <strong>Part Type</strong>, in the order set in Page Content → <strong>Product Families / Categories</strong>. A category that no product uses is not shown.</td></tr>
          <tr><td>Company menu: each item, its grey sub-line and where it goes</td><td>Page Content → <strong>Navigation — Company Menu</strong>.</td></tr>
          <tr><td>The "Contact" link in the phone-sized menu</td><td><strong>Fixed.</strong></td></tr>
          <tr><td>The colors of the bar, buttons and highlights</td><td>Business Details → <strong>Branding &amp; Theme</strong> colors.</td></tr>
        </table>

        <h3>On every page — the footer</h3>
        <table class="field-ref map-ref">
          <tr><td>Logo and company name</td><td>Business Details → <strong>Logo URL</strong> and <strong>Company Name</strong>.</td></tr>
          <tr><td>"ESTABLISHED 1974 · ISO 9001" and any other certifications</td><td>Business Details → <strong>Founded Year</strong>, <strong>ISO Certification</strong> and <strong>Other Certifications</strong> (one per line, shown exactly as typed). The word "ESTABLISHED" is fixed.</td></tr>
          <tr><td>The short paragraph about IPC</td><td><strong>Fixed</strong>, except the minimum-order figure in it, which is Business Details → <strong>Minimum Order</strong>.</td></tr>
          <tr><td>Social media icons</td><td>Business Details → <strong>Social Links</strong>. An empty box removes that icon.</td></tr>
          <tr><td>"Contact" and "Quick Links" headings</td><td>Page Content → <strong>Footer — Labels</strong>.</td></tr>
          <tr><td>Phone, fax, email, address, hours</td><td>Business Details → <strong>Contact</strong>, <strong>Address</strong> and <strong>Hours (display text)</strong>.</td></tr>
          <tr><td>"Full product catalog (PDF)" link</td><td>Business Details → <strong>Catalog PDF URL</strong>. Hidden while that box is empty.</td></tr>
          <tr><td>The Quick Links themselves</td><td>Page Content → <strong>Navigation — Footer Quick Links</strong>.</td></tr>
          <tr><td>"© 1974–<?= date('Y') ?> …" line</td><td>Business Details → <strong>Founded Year</strong> and <strong>Company Name</strong>. The second year updates itself every January.</td></tr>
          <tr><td>The web address shown under it</td><td>Page Content → <strong>Footer — Labels</strong> → <strong>Domain shown in footer</strong>; the city, state and ZIP after it come from Business Details.</td></tr>
          <tr><td>The footer's dark blue background</td><td><strong>Fixed</strong> — it does not follow the brand colors.</td></tr>
        </table>

        <h3>Homepage</h3>
        <table class="field-ref map-ref">
          <tr><td>Small badge, the three headline lines, the paragraph and the two buttons (their words and where they go)</td><td>Page Content → <strong>Homepage — Hero</strong>.</td></tr>
          <tr><td>The small cards beside the headline ("$50 Minimum Order" …)</td><td>Page Content → <strong>Homepage — Hero Proof Points</strong>.</td></tr>
          <tr><td>The large photo</td><td>Page Content → <strong>Site Images</strong> → Homepage hero. See <a href="#newfiles">Putting a new photo on the server</a>.</td></tr>
          <tr><td>The scrolling strip of ✓ items</td><td>Page Content → <strong>Homepage — Hero Trust Ticker</strong>.</td></tr>
          <tr><td>The bar of numbers under the hero (years in business, products stocked …)</td><td>Page Content → <strong>Trust Bar Stats</strong>. <strong>These numbers are typed by you, not counted</strong> — when you add or remove products, update the "Products Stocked" figure here yourself.</td></tr>
          <tr><td>"Products &amp; Services" heading, the dark ribbon's text and its button</td><td>Page Content → <strong>Homepage — "Products &amp; Services" heading</strong>. The "View Full Catalog →" link is fixed.</td></tr>
          <tr><td>The product and service cards</td><td>Page Content → <strong>Products &amp; Services Cards</strong>.</td></tr>
          <tr><td>The team and building photos band</td><td>Photos: Page Content → <strong>Site Images</strong> (team and building). The heading and sentence are <strong>fixed</strong> wording, with your street address and ISO filled in from Business Details. The band disappears if you empty both photos.</td></tr>
          <tr><td>"Industries" heading and its paragraph</td><td>Page Content → <strong>Homepage — "Industries" heading</strong>.</td></tr>
          <tr><td>The industry cards</td><td>Page Content → <strong>Industries Grid</strong>. Each card's "Learn More →" jumps to the matching section of the Industries page — so the card's <strong>Name</strong> must be spelled exactly like that section's <strong>Industry name</strong> in <em>Industries Page — Detail Sections</em>, or it lands at the top of the page instead.</td></tr>
          <tr><td>The "$50 minimum order. 25 million feet in stock." band near the bottom</td><td>Business Details → <strong>Minimum Order</strong>, <strong>Feet In Stock</strong>, <strong>Phone</strong> and <strong>Fax</strong>. The rest of the wording and its two buttons are fixed.</td></tr>
        </table>

        <h3>Products page and each product's own page</h3>
        <table class="field-ref map-ref">
          <tr><td>"Product Catalog" heading and "Browse all 42 products …"</td><td><strong>Fixed</strong> wording; the number is counted automatically.</td></tr>
          <tr><td>Category list in the left column, and its counts</td><td>Your products' <strong>Part Type</strong>, in the order of Page Content → <strong>Product Families / Categories</strong>.</td></tr>
          <tr><td>Each product card: photo, part number, category, name</td><td>That product's <strong>Photo</strong> button, <strong>SKU</strong>, <strong>Part Type</strong> and <strong>Product Name</strong>.</td></tr>
          <tr><td>Product page: the name and part number at the top</td><td><strong>Product Name</strong> and <strong>SKU</strong>.</td></tr>
          <tr><td>The line under the name, and the caption under the photo</td><td><strong>Image Caption</strong> (both places). Left empty, the line under the name reads "Part … — full specifications, data sheet and quote request below."</td></tr>
          <tr><td>"Datasheet" button</td><td><strong>Manage PDF</strong>; its wording is <strong>Primary PDF Button Label</strong>. Extra buttons: <strong>Additional PDF Links</strong>. With no PDF the button reads "Request Datasheet" (fixed).</td></tr>
          <tr><td>"Approvals &amp; Certifications" chips</td><td>The <strong>Approvals &amp; Certifications</strong> tick-boxes.</td></tr>
          <tr><td>"Product Features" chips</td><td><strong>Feature Badges</strong>. A badge that names a standard (UL, RoHS, MIL-SPEC, FDA …) is <strong>left out here on purpose</strong> — the Approvals chips already say it — so tick the box rather than typing it as a badge.</td></tr>
          <tr><td>Body paragraphs</td><td><strong>Description Paragraphs</strong>.</td></tr>
          <tr><td>Specification list and size chart</td><td><a href="#specs">Specifications</a> and <a href="#sizechart">Size chart</a> on the Edit screen.</td></tr>
          <tr><td>"Related Products"</td><td>Automatic: up to four other products with the same Part Type. (Not shown for Accessory, Adhesive or Tape — fixed.)</td></tr>
          <tr><td>The product page's browser-tab title and Google description</td><td>Automatic, from <strong>Product Name</strong>, <strong>SKU</strong>, <strong>Part Type</strong> and <strong>Specifications Summary</strong>.</td></tr>
          <tr><td>"Request a Quote" and "Request Datasheet" buttons, "Product Detail" label, section headings</td><td><strong>Fixed.</strong></td></tr>
        </table>

        <h3>Product Index page (the searchable table)</h3>
        <table class="field-ref map-ref">
          <tr><td>"Product Index" heading and the sentence under it</td><td><strong>Fixed</strong> — this page has no banner card in Page Content.</td></tr>
          <tr><td>Category buttons</td><td>Part Type, in Product Families order.</td></tr>
          <tr><td>"Filter by approval" chips</td><td>The products' Approvals tick-boxes.</td></tr>
          <tr><td>Table columns</td><td>Product Name, SKU, Part Type, the start of the first Description paragraph, <strong>Operating Temperature</strong> ("Temp") and <strong>Specifications Summary</strong> ("Specifications"). This table is the <strong>only</strong> place Operating Temperature appears.</td></tr>
        </table>

        <h3>Datasheets page</h3>
        <table class="field-ref map-ref">
          <tr><td>Heading and intro</td><td>Page Content → <strong>Datasheets page — banner</strong>. Those boxes are empty as shipped, which means the site shows its built-in wording ("Datasheets" …); type in them to replace it.</td></tr>
          <tr><td>The list of data sheets</td><td>Automatic: every product that has a PDF, grouped by Part Type. Add one with <strong>Manage PDF</strong>.</td></tr>
        </table>

        <h3>Industries page</h3>
        <table class="field-ref map-ref">
          <tr><td>Banner</td><td>Page Content → <strong>Industries page — banner</strong>.</td></tr>
          <tr><td>Each industry: icon, name, sub-heading, "Common Applications", "IPC Products" links, certification chips</td><td>Page Content → <strong>Industries Page — Detail Sections</strong>. Product links are one per line as <code>SKU | name shown</code>; the SKU must match a product in your catalog (the page warns you when it doesn't).</td></tr>
          <tr><td>The three small headings in each section, its buttons, and the "PPAP &amp; IMDS Documentation Available" box at the bottom</td><td><strong>Fixed.</strong></td></tr>
        </table>

        <h3>Services page</h3>
        <table class="field-ref map-ref">
          <tr><td>Banner</td><td>Page Content → <strong>Services page — banner</strong>. Photo: <strong>Site Images</strong> → Services.</td></tr>
          <tr><td>"Standard Lead Time: …" bar</td><td>Worked out from the <strong>Lead time</strong> boxes in <strong>Value-Added Services</strong>: the lead time most services share is shown here, and a card shows its own lead time only when it differs. The rest of that bar is fixed.</td></tr>
          <tr><td>Service cards: icon, title, description, ✓ bullet points, brochure download</td><td>Page Content → <strong>Value-Added Services</strong>.</td></tr>
          <tr><td>"Need something not listed?" panel</td><td><strong>Fixed.</strong></td></tr>
        </table>

        <h3>About page</h3>
        <table class="field-ref map-ref">
          <tr><td>Banner, and the "Our Story", Certifications, Team and bottom headings</td><td>Page Content → <strong>About page — banner &amp; headings</strong>.</td></tr>
          <tr><td>"Our Story" paragraphs</td><td>Business Details → <strong>About story</strong> (one paragraph per line) — not Page Content.</td></tr>
          <tr><td>Photo</td><td>Page Content → <strong>Site Images</strong> → About.</td></tr>
          <tr><td>Fact box: Founded, Headquarters, Inventory, Minimum Order, Quality, Phone, Fax</td><td>Business Details. The rows "Privately Held", "Custom Lead Time ≤ 1 week" and "PPAP / IMDS: Available on request" are <strong>fixed</strong>.</td></tr>
          <tr><td>"Company Timeline" and its entries</td><td>The heading is fixed; the entries are Page Content → <strong>About — Company Timeline</strong>.</td></tr>
          <tr><td>Certification cards</td><td>Page Content → <strong>About — Certifications &amp; Standards</strong>.</td></tr>
          <tr><td>Team cards</td><td>Page Content → <strong>About — Team &amp; Capabilities</strong>.</td></tr>
          <tr><td>Bottom "Call …, email …" line and its buttons</td><td>Fixed wording, your phone and email from Business Details.</td></tr>
        </table>

        <h3>FAQ page</h3>
        <table class="field-ref map-ref">
          <tr><td>Banner</td><td>Page Content → <strong>FAQ page — banner</strong>.</td></tr>
          <tr><td>The category buttons and category headings</td><td>The <strong>Category</strong> box on each FAQ row, in the order they first appear. Spell a category the same way every time or it splits into two.</td></tr>
          <tr><td>Questions and answers</td><td>Page Content → <strong>FAQ / Resources</strong>. Google is given the same list.</td></tr>
          <tr><td>"Still have questions?" box</td><td>Fixed wording; hours, phone, fax and email from Business Details.</td></tr>
        </table>

        <h3>Contact page, the confirmation, and the emails</h3>
        <table class="field-ref map-ref">
          <tr><td>Banner and the "Direct Contact" heading</td><td>Page Content → <strong>Contact page — banner</strong>.</td></tr>
          <tr><td>The two tabs, form headings, every field's label and grey example text, the submit buttons, "Sending…", the "required" line and the privacy line above the button</td><td>Page Content → <strong>Contact Page — Form</strong>.</td></tr>
          <tr><td>The cards on the right: phone, fax, email, address, hours</td><td>Business Details. The card titles and the lines "For POs &amp; documentation" and "Typical reply: same day" are <strong>fixed</strong>.</td></tr>
          <tr><td>"For fastest response, include:" and the tips under it</td><td>The heading: <strong>Contact Page — Form</strong> (Sidebar tips heading). The tips: <strong>Contact Page — Sidebar Tips</strong>.</td></tr>
          <tr><td>After someone sends the form: the title, "Thank you!", the message and the "For urgent inquiries" line</td><td>Page Content → <strong>Contact Page — Form</strong>, the <em>Success</em> boxes.</td></tr>
          <tr><td>The message shown if sending fails</td><td>Page Content → <strong>Contact Page — Form</strong>, the <em>Error</em> boxes.</td></tr>
          <tr><td><strong>Where quote requests are emailed</strong></td><td>Business Details → <strong>Email</strong>. The same address is shown on the site — change it and new leads go to the new address.</td></tr>
          <tr><td>The automatic reply the customer receives</td><td>Page Content → <strong>Contact Page — Form</strong>, the three <em>Auto-reply</em> boxes: the response promise for quotes, the one for messages, and an optional notice (e.g. a holiday closure — empty it again afterwards). The rest of that email is fixed.</td></tr>
        </table>

        <h3>Privacy Policy page</h3>
        <table class="field-ref map-ref">
          <tr><td>Title, "Effective Date" and the lead paragraph</td><td>Page Content → <strong>Privacy page — banner</strong>. Update the effective date whenever you change the policy.</td></tr>
          <tr><td>The numbered sections</td><td>Page Content → <strong>Privacy Policy — Sections</strong> (the numbers are automatic).</td></tr>
        </table>

        <h3>Browser tabs, Google and social-media previews</h3>
        <table class="field-ref map-ref">
          <tr><td>Each page's browser-tab title and Google description</td><td>Page Content → <strong>Search Engine Text (SEO)</strong>, one row per page. The Datasheets page has no row as shipped — add one with <strong>+ Add Page</strong> and choose Datasheets if you want to set its text. Product pages are automatic (above).</td></tr>
          <tr><td>The company information Google reads: description, opening days and times, country, short name, social accounts</td><td>Business Details → <strong>Short Description</strong>, <strong>Opens</strong> / <strong>Closes</strong> / <strong>Open Days</strong>, <strong>Country</strong>, <strong>Short Name</strong>, <strong>Social Links</strong>. None of these appears in the text of a page (Short Name can end a product page's browser-tab title — see <a href="#business">Business Details</a>).</td></tr>
        </table>

        <h3>Error pages</h3>
        <table class="field-ref map-ref">
          <tr><td>"Page not found", "Catalog Unavailable" and "Something went wrong"</td><td><strong>Fixed</strong> wording, with your phone and email from Business Details.</td></tr>
        </table>

        <h3 id="newfiles">Putting a new photo or logo on the server</h3>
        <!-- Rewritten 2026-09-29: the Site Images & Logo page (site-images.php)
             replaced the File Manager steps this section taught for one day. -->
        <p>Open <a href="site-images.php"><strong>Site Images &amp; Logo</strong></a> — it is linked from the <strong>Site Images</strong> card on Page Content and from the <strong>Logo URL</strong> box on Business Details. There is one card for each of the five page photos and one for the logo, each showing what is on the website now. (Product photos are different: use the <strong>Photo</strong> button, see <a href="#photos">Product photos</a>.)</p>
        <ol class="steps">
          <li><strong>Upload a new picture:</strong> click <strong>Choose File</strong> on the card, pick a JPG, PNG, WEBP or GIF from your computer (<?= h(min_upload_label(8)) ?> at most), and click <strong>Upload &amp; Use →</strong>. It is checked the same way as a product photo, scaled down if it is wider than <?= (int)IMG_MAX_WIDTH ?>&nbsp;pixels, and goes on the website straight away.</li>
          <li><strong>Or reuse one already on the server:</strong> pick it from the list under the upload box — your earlier uploads first, then the pictures that came with the website — and click <strong>Use This One</strong>.</li>
          <li><strong>Remove Photo</strong> empties that spot on the page; on the logo card, <strong>Use the Original Logo</strong> puts the shipped logo back.</li>
          <li>Open the page on the live site and hard-refresh (<strong>Ctrl+Shift+R</strong> / <strong>Cmd+Shift+R</strong>).</li>
        </ol>
        <p>Nothing on that page deletes a file, so an old picture stays in the list, and <strong>Backups</strong> can put a previous choice back. An <strong>SVG</strong> logo cannot be uploaded there — SVG files can carry program code — so that one is still for your developer (or upload it into <code>public_html/uploads/site/</code> with your hosting File Manager and type <code>/uploads/site/logo.svg</code> into Business Details → Logo URL).</p>
        <div class="callout callout-warning">
          <b>Never put your own pictures in the <code>images</code> folder</b>
          Everything in <code>public_html/images/</code> is part of the website itself and is replaced the next time your developer updates the site — a photo you put there silently disappears. <code>uploads/</code> is yours and is never touched by an update.
        </div>
      </section>

      <section class="help-section" id="business">
        <div class="eyebrow eyebrow-site">Your Website</div>
        <h2>🏢 Business Details</h2>
        <p>Click <strong>Business Details</strong> in the header. This one page controls the facts about your company that appear all over the public site — the phone number in the header, the address in the footer, the copyright year, your hours, your certifications, and the colors and logo.</p>
        <p>Change something here and it changes <em>everywhere it appears</em>. You never have to hunt for the same phone number on six pages.</p>
        <table class="field-ref">
          <!-- NEW-V2-2 — this row said all three drive the "header, footer,
               page titles". The header's name beside the logo is fixed text in
               the site code; most page titles come from content.json's seo
               rows; shortName is only used by fitProductTitle() and the JSON-LD
               alternateName. -->
          <tr><td>Company name</td><td>The footer (including the © line) and the information search engines read about you. It is also the ending of product pages' browser-tab titles, and of any page that has no title of its own in <a href="#pagecontent">Page Content</a> → Search Engine Text (SEO) — every other page title comes from there, not from here. It does <strong>not</strong> change the name printed beside the logo in the site header; that is part of the site design, so ask your developer.</td></tr>
          <tr><td>Short name</td><td>Never shown in the text of any page. It is listed in the information search engines read, and it replaces the full company name in a product page's browser-tab title when the full name would make that title too long for search results.</td></tr>
          <tr><td>Slogan</td><td>The small line under the company name in the site header, and the information search engines read.</td></tr>
          <tr><td>Phone, fax, email</td><td>Footer, Contact page, About page, FAQ page and the homepage quote band. <strong>The email address is also where every quote request and contact-form message is sent</strong> — change it and new leads go to the new address, so make sure it is a mailbox someone reads. The phone number is also what the "call us" links dial, so type it the way you'd say it — the dialling version is a separate field beside it. <strong>When you change the phone number, change the dial box too — or empty it</strong>: left empty, it is worked out from the phone number when you save (for an ordinary 10-digit US/Canada number; for anything else the page asks you to fill it in).</td></tr>
          <tr><td>Address</td><td>Footer, Contact page, About page fact box, Privacy page, and the map listing search engines build from your site. <strong>Country</strong> is only given to search engines.</td></tr>
          <tr><td>Hours (display text)</td><td>The hours shown in the footer and on the Contact page, e.g. "Mon–Fri, 8am–5pm CT".</td></tr>
          <tr><td>Opens, Closes, Open Days</td><td>Not shown on any page — they are the opening hours search engines (Google Maps and the like) read, so keep them in step with the display text above. Times are 24-hour (<code>08:00</code>, <code>17:00</code>); days are full names separated by commas.</td></tr>
          <tr><td>Short Description</td><td>Not shown on any page — it is the one-paragraph description of IPC given to search engines. (The box's own hint on the Business Details page also mentioned the footer until 2026-09-29; the footer paragraph is fixed.)</td></tr>
          <tr><td>Minimum Order, Feet In Stock</td><td>The homepage quote band ("$50 minimum order. 25 million feet in stock."), the About page fact box and the footer paragraph. The site also swaps the original "$50" and "25 million" for these values inside your Page Content wording.</td></tr>
          <tr><td>About story</td><td>The "Our Story" paragraphs on the About page — one paragraph per line. (Its heading is in Page Content → About page — banner &amp; headings.)</td></tr>
          <tr><td>Founded year</td><td>Drives the "© 1974–<?= date('Y') ?>" line automatically. You never update the second year.</td></tr>
          <tr><td>Certifications</td><td><strong>The ISO field here is the only place the ISO certification is set.</strong> What you type in it appears everywhere the site claims it &mdash; the homepage trust bar and hero badges, the Certifications &amp; Standards block on the About page, the company story, the footer and the search-engine descriptions. Put the revision year in only when your registrar has confirmed it (<code>ISO 9001:2015</code>) and every one of those places changes with it; leave it as plain <code>ISO 9001</code> and no revision is claimed anywhere. You do not need to hunt for the wording in Page Content &mdash; whatever is typed there, the revision comes from this field. <strong>The &ldquo;Other certifications&rdquo; box beside it is published too:</strong> each line appears in the footer of every page, exactly as typed, as soon as you save &mdash; list only certifications IPC currently holds. <em>(There is no separate Quality page — this row said there was until 2026-09-14.)</em></td></tr>
          <tr><td>Brand colors &amp; logo</td><td>Live preview on the right of the page as you change them. <strong>Primary</strong> colors buttons and highlights, <strong>Dark</strong> the navigation bar and dark bands, and the <strong>Secondary accent</strong> (with Primary) the page banners; a note beside each warns when text on it would be hard to read. The footer background does not follow these colors. The <strong>Logo URL</strong> is the address of a picture already on your server — to use a new one, see <a href="#newfiles">Putting a new photo or logo on the server</a>.</td></tr>
          <tr><td>Social links</td><td>Each one you fill in appears as a small clickable icon in the footer of every page, and tells search engines which accounts are yours. Leave one empty and its icon disappears. Each must be a full address starting <code>https://</code> (or <code>http://</code>).</td></tr>
          <tr><td>Catalog PDF URL</td><td>Optional. Point it at a full-catalog PDF (e.g. <code>/pdfs/catalog.pdf</code>) and a "Full product catalog (PDF)" link appears in the site footer. Leave blank for no link.</td></tr>
        </table>
        <div class="callout callout-warning">
          <b>Most fields refuse to be left blank — on purpose</b>
          <!-- ADM-9(g) — this said "the previous value comes back". It does
               not: settings.php saves the blank, and mergeSiteInfo() in
               src/App.jsx drops blanks and falls back to SITE_DEFAULTS, i.e.
               the value the site shipped with. The company name is different
               again: settings.php refuses the whole save. -->
          If you clear the phone number, the founded year, the email or a line of the address and save, the public site does not go blank — it goes back to the <strong>original value the website was built with</strong>, not to whatever you had there before (this page will show the box empty). That is deliberate: an empty phone number becomes a dead "call us" link and an empty year prints "©&nbsp;–<?= date('Y') ?>" to every visitor. To <em>change</em> one, type the new value over the old one. The <strong>company name</strong> cannot be cleared at all: the save is refused with a message, and nothing on the page is saved until you put a name back.
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
        <p>Click <strong>Page Content</strong> in the header. This is the wording and the blocks of the public site: homepage headlines and button labels, the feature cards, the industries you serve, your services, the FAQ, the company milestones on the About page, the navigation menus, the footer links, the contact form's wording and its automatic reply email, and the privacy policy.</p>
        <p>Not sure which card controls something you can see on the site? <a href="#sitemap">Where each part of the site is edited</a> walks every page top to bottom and names the card.</p>
        <p>Each block is a row. Rows have <strong>↑ ↓</strong> buttons to reorder them, an <strong>✕</strong> to remove them, and a <strong>+ Add</strong> button at the bottom of each section.</p>
        <div class="callout callout-warning">
          <b>Renaming a product category does not move the products in it</b>
          <strong>Product Families / Categories</strong> is where the Part Type list on the Add and Edit forms comes from, so you can add or rename a category yourself. But each product stores its own category as text: rename <em>Tape</em> to <em>Tapes</em> and the products stay under <em>Tape</em> until you open each one and re-save it. The number beside each row tells you how many products that is before you start. Adding a new category is safe and instant; renaming one is a two-step job.
        </div>
        <div class="callout callout-tip">
          <b>The photos on the homepage, About and Services pages</b>
          The <strong>Site Images</strong> section holds the five pictures that are part of the pages themselves rather than of any product: the homepage hero photo, the two photos in the homepage band (your team and your building), the About page photo and the Services page photo. Each is a path to a picture on your server — to upload a new one or pick another, use the <a href="site-images.php">Site Images &amp; Logo</a> page (see <a href="#newfiles">Putting a new photo or logo on the server</a>). <strong>Clearing one removes that picture from the page</strong> rather than restoring the original — which is the point, if you would rather show no photo than the wrong one.
        </div>
        <div class="callout callout-tip">
          <b>It also controls what Google shows</b>
          The <strong>Search Engine Text (SEO)</strong> section sets the browser-tab title and the description that appears under your link in search results — and the preview card when someone shares a page on social media. There is one row per page, and the <strong>home</strong> row is the site-wide default used by any page without its own. You are writing for two readers at once here: a search engine, and a buyer deciding whether to click. Describe the page plainly and include the words a customer would actually type.
        </div>
        <div class="callout callout-tip">
          <b>Deleting every row of a section really does empty it</b>
          If you remove all eight footer links, the site shows no footer links. Earlier versions quietly put the originals back; this one does what you asked. The same is true for FAQ entries, services, industries, milestones and the privacy text.
        </div>
        <div class="callout callout-warning">
          <b>Headings and labels won't go blank</b>
          <!-- Docs audit 2026-09-29 — this said "restores the previous wording". It
               restores the BUILT-IN wording (COPY_DEFAULTS via mergeContent in
               src/App.jsx), the same trap ADM-9(g) fixed for Business Details. -->
          Clearing a heading or a button label and saving puts back the website's <strong>built-in original wording</strong> — not whatever you had there before — rather than leaving an empty space, because a button with no text is one you can never find again to fix. To change one, type over it. The homepage sub-headline and the <strong>Site Images</strong> can be cleared, since those are genuinely optional.
          <br><br>
          This is also why a few boxes are <strong>empty as shipped</strong> — the Datasheets page banner, the header's "Datasheets" link, and the form's "required fields" and privacy lines: an empty box means the site is showing its built-in wording. Type in one to replace it.
        </div>
        <div class="callout callout-warning">
          <b>If the page says it didn't submit completely</b>
          This form is large. If your server cuts the request short, you'll get a clear red message saying <strong>nothing was saved</strong> — and everything you typed is still on the screen. Remove a few entries, save, and add them back afterwards. If it keeps happening, send your developer the "Max form fields per save" number from <a href="#server-limits">What your server allows</a>.
        </div>
        <div class="callout callout-tip">
          <b>Every error keeps your typing</b>
          Whatever goes wrong on this page — a stale tab, a cut-off request, a permissions problem — the form comes back with your words in it, not the old ones from the server. You should never have to retype anything. The one exception is being <strong>signed out</strong> while the page was open: your typing can still be recovered, but only if you sign in again in a new tab <em>first</em> — see <em>"I was signed out in the middle of editing"</em> in <a href="#faq">Troubleshooting</a>.
        </div>
      </section>

      <section class="help-section" id="inquiries">
        <div class="eyebrow eyebrow-site">Your Website</div>
        <h2>📥 Inquiries — every lead from the contact form</h2>
        <p>Click <strong>Inquiries</strong> in the header. Every quote request and message submitted through the website is recorded here, <em>including ones the mail server failed to send</em>. This is your safety net: if email breaks, the lead is still on this page.</p>
        <p>Click any row to expand it and see the full message, the part number, quantities, required date and the visitor's contact details. Reply from your own email program — this page does not send email.</p>
        <table class="field-ref">
          <tr><td><span class="badge-mock">Quote</span> / <span class="badge-mock">Message</span></td><td>Which form the visitor used. "Quote" is a full RFQ with part number and quantity.</td></tr>
          <!-- Docs audit 2026-09-29 — this row said "Emailed … reached your inbox";
               inquiries.php renamed the badge in A-5.6 because the site cannot
               see an inbox, only the hand-off to the mail server. -->
          <tr><td><span class="badge-mock">Sent to mail server</span></td><td>The notification was handed to your mail server. Normal. The website cannot see your inbox, so this is not proof it arrived — if a customer says you never replied, check here and in your spam folder.</td></tr>
          <tr><td><span class="badge-mock">Email failed</span></td><td>The mail server refused it. <strong>The lead is not lost</strong> — it's right here. If you see several of these, tell your developer.</td></tr>
          <tr><td><span class="badge-mock">Spam trap</span> / <span class="badge-mock">Rate limited</span> / <span class="badge-mock">Blocked</span></td><td>The website refused the submission. Almost always a bot. These are counted separately and are <em>not</em> an email problem.</td></tr>
        </table>
        <div class="callout callout-tip">
          <b>The numbers at the top</b>
          <strong>Total received</strong> is everything ever submitted. <strong>Mail server refused</strong> counts only genuine send failures — if that number is above zero, something is wrong with mail. Blocked spam is deliberately kept out of it so it can't cause a false alarm.
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
        <p>Every time you save a <em>change</em> to products, business details or page content, a dated copy of the previous version is written first. The <?= (int)BACKUP_KEEP ?> most recent are kept for each of the three. If you press Save without having changed anything, nothing is written and no backup slot is used — so the list never fills up with identical copies of the same version, and the <?= (int)BACKUP_KEEP ?> slots hold <?= (int)BACKUP_KEEP ?> genuinely different versions. Each entry shows what's inside it ("41 products", "17 content rows", your company name and phone) so you're not choosing between identical timestamps.</p>
        <ol class="steps">
          <li>Find the entry from just before the change you want to undo.</li>
          <li>Click <strong>Restore This Version</strong> and confirm.</li>
          <li>Done. The site reflects it within about a minute.</li>
        </ol>
        <div class="callout callout-tip">
          <b>A restore can itself be undone</b>
          Restoring backs up the <em>current</em> state first, so if you restore the wrong one, the version you just replaced is now the newest entry in the list. You cannot get stuck.
        </div>
        <div class="callout callout-warning">
          <b>Act sooner rather than later</b>
          Only the <?= (int)BACKUP_KEEP ?> most recent are kept per file, and every save that <em>changes</em> something counts — including each photo upload, PDF upload, add and delete. Re-saving an unchanged page no longer uses a slot, but a busy afternoon of real edits can still push an older mistake off the end of the list.
        </div>
      </section>

      <section class="help-section" id="auditlog">
        <div class="eyebrow eyebrow-advanced">Advanced</div>
        <h2>🕒 Audit log / change history</h2>
        <p><strong>Everything you can change from this dashboard is recorded here</strong> — not just products. Adding, editing and deleting parts; uploading and removing data sheets and photos; changing a page photo or the logo; saving Business Details; saving Page Content; restoring a backup; and changing your password. Each entry records what happened, which product it was about, exactly when, and the IP address it came from.</p>
        <ol class="steps">
          <li>Click <strong>Audit Log</strong> in the header navigation.</li>
          <li>Browse the list — newest changes are always at the top.</li>
          <li>Use the filter boxes to narrow it down: type a SKU to see everything that's happened to one specific product, or pick an action type from the dropdown. The dropdown lists every action in the table below.</li>
          <li>Click <strong>Clear</strong> to reset the filters.</li>
        </ol>
        <h3>What each colored badge means</h3>
        <table class="field-ref">
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#dcfce7;color:#166534;">add</span></td><td>A brand-new product was created.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#dbeafe;color:#1e40af;">edit</span></td><td>An existing product's details were changed.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#fee2e2;color:#991b1b;">delete</span></td><td>A product was permanently removed.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#cffafe;color:#155e75;">upload-pdf</span></td><td>A data sheet was uploaded or replaced.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#fde68a;color:#92400e;">remove-pdf</span></td><td>A data sheet was removed from a product.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#ede9fe;color:#5b21b6;">upload-image</span></td><td>A product photo was uploaded from a computer.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#fee2e2;color:#991b1b;">remove-image</span></td><td>A product photo was removed, and the file deleted from the server because nothing else was using it.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#ede9fe;color:#5b21b6;">site-image</span></td><td>A page photo or the logo was uploaded, picked or removed on the Site Images &amp; Logo page. The entry names which one.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#e0f2fe;color:#075985;">settings</span></td><td>Business Details was saved. The entry only says the details were updated (or that nothing had changed) — it does not list which fields. The version from before each save is kept on the <a href="#backups">Backups</a> page if you need to put it back.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#e0f2fe;color:#075985;">content</span></td><td>Page Content was saved. The entry names the pages and sections you changed — see the note below.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#fef3c7;color:#92400e;">restore</span></td><td>A backup was restored from the <a href="#backups">Backups</a> page.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#f3e8ff;color:#6b21a8;">password</span></td><td>The admin password was changed. The password itself is never recorded.</td></tr>
          <!-- A-9.B2-02 — the three sign-in actions. The dropdown has always
               offered them and this table has never explained them, while the
               sentence above it says the dropdown lists every action in the
               table below. sign-in-failed is the one that matters most: a run
               of them from an address you do not recognise is the only warning
               of someone guessing the password. -->
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#dcfce7;color:#166534;">sign-in</span></td><td>Someone signed in successfully, from the address shown.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#e5e7eb;color:#374151;">sign-out</span></td><td>Someone signed out.</td></tr>
          <tr><td><span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:#fee2e2;color:#991b1b;">sign-in-failed</span></td><td>A wrong password was entered. One or two is usually a typo. <strong>A run of them from an address you don't recognise is worth telling your developer about</strong> — it is what someone guessing the password looks like.</td></tr>
        </table>
        <div class="callout callout-tip">
          <b>Page Content saves say what you actually edited</b>
          The Page Content form covers the whole site at once, so a save used to be logged as "Homepage content updated" whatever you had been working on — which made the history useless for the one question it exists to answer. Entries now name it: <em>"Updated: Privacy page — banner"</em>, or <em>"Updated: Search Engine Text (SEO), Privacy page — banner"</em> when you changed two things. If you save without changing anything, it says so rather than pretending a change happened.
        </div>
        <div class="visual-note"><span class="vn-icon">🔍</span>Handy for questions like "did someone change this product's price recently?" or "who deleted that part last week?" — check here first before assuming something is a bug.</div>
        <div class="callout callout-tip">
          <b>What the audit log can (and can't) tell you</b>
          Because everyone signs in with the same shared password (see <a href="#signing-in">Signing in &amp; out</a>), the log identifies changes by IP address and timestamp, not by employee name. That's usually enough to tell "this came from the office" versus "this came from somewhere else," and it always shows exactly what changed and when — just not automatically which person was at the keyboard.
        </div>
      </section>

      <section class="help-section" id="health">
        <div class="eyebrow eyebrow-advanced">Advanced</div>
        <h2>🩺 If the dashboard warns you about the server</h2>
        <p>Several things can go wrong on the server itself in a way that is completely silent — the dashboard keeps saying "saved", and nothing actually is. So the <strong>Products</strong> page checks for all of them every time you open it, and shows a red box at the top headed <strong>"Server setup problem — please send this to your developer"</strong> if it finds one. The box names every problem it found; the table below explains each one.</p>
        <p><strong>If you never see that box, there is nothing to do here.</strong> If you do, it is a permissions problem on the hosting account, not something you did wrong, and the box tells you exactly which folder to fix over FTP.</p>
        <table class="field-ref">
          <tr><td>The <code>admin</code> folder is not writable</td><td>The most serious one. <strong>Sales leads from the contact form are being discarded</strong>, the change history cannot record anything, and the Password page cannot save. Set <code>admin/</code> to 755 (or 775) over FTP. If the warning stays, ask your host to run PHP as your account user (777 also works, as a stop-gap only).</td></tr>
          <tr><td>The <code>data</code> folder is not writable</td><td>Nothing you edit on any page can be saved at all. Set <code>data/</code> to 755 (or 775) over FTP. If the warning stays, ask your host to run PHP as your account user (777 also works, as a stop-gap only).</td></tr>
          <tr><td>The <code>uploads/images</code> folder is missing or not writable</td><td>Product photo uploads will fail. Create <code>public_html/uploads/images/</code> over FTP and set it to 755. <strong>Check that the file <code>public_html/uploads/.htaccess</code> is there too</strong> — it comes with the website files, and it is what stops anyone running a program from the photos folder. If it is missing, ask your developer to put it back before any more photos go up. <!-- NEW-N3-3 --></td></tr>
          <!-- A-9.B2-03 — the four rows the dashboard could raise and this
               table never listed. The section said "three things" over four
               rows while the Products page checks nine. The missing four are
               exactly the ones an owner is most likely to meet and least able
               to guess: a data sheet upload that fails, a rate limit that has
               quietly stopped counting, leads that are arriving and not being
               written down, and photos that are never resized. -->
          <tr><td>The <code>pdfs</code> folder is missing or not writable</td><td>Data sheet uploads will fail. Set <code>public_html/pdfs/</code> to 755 (or 775) over FTP. If the warning stays, ask your host to run PHP as your account user (777 also works, as a stop-gap only).</td></tr>
          <tr><td>The server's temporary folder is not writable</td><td>The contact form still works and still records every lead, but its spam rate limit is not counting, and confirmation emails to senders are held back as a precaution. Ask the host to fix permissions on it.</td></tr>
          <tr><td><strong>Quote requests are arriving but cannot be recorded</strong></td><td>The most urgent one after <code>admin</code>. The notification emails are still being sent, so nothing is lost yet — but <strong>Inquiries</strong> is not recording anything, so a lead that is missed in email is gone. Same fix as the <code>admin</code> row.</td></tr>
          <tr><td>This server cannot resize images (<code>gd</code> is missing)</td><td>Photo uploads still work, but a large photo is saved at its original size, and that product page will be slow on a phone. Ask the host to enable the PHP <code>gd</code> extension, or resize photos to about <?= (int)IMG_MAX_WIDTH ?> pixels wide before uploading them.</td></tr>
          <tr><td>The password-reset window is OPEN</td><td>While a file called <code>ALLOW-PASSWORD-RESET</code> sits in your admin folder, <strong>anyone on the internet</strong> who opens your admin address is shown a "Set Admin Password" form and can lock you out. It closes by itself an hour after the file was uploaded, and the warning carries a <strong>Close It Now</strong> button so you can shut it immediately. See <a href="#password">Your admin password</a>.</td></tr>
        </table>
        <div class="callout callout-warning">
          <b>Why this page exists at all</b>
          On some hosting setups the account you use for FTP and the account the website runs as are two different users. When that happens the website can read your files but not write them — and the failure is invisible, because the part that would have told you is the part that cannot write. The warning box is there so a dropped sales lead is something you find out about in a day, not in a quarter.
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
          <summary>I got "A product with this SKU already exists" (or "… is too close to the existing SKU …").</summary>
          <p>Every SKU (part number) must be unique across your whole catalog — and two SKUs that differ only in capitals, spaces or punctuation count as the same one, because the website and the uploaded file names ignore those. Search the dashboard for that SKU to see the existing product, or choose a different SKU for the new one.</p>
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
          <summary>I can't sign in — it says my password is incorrect.</summary>
          <p>Double-check Caps Lock and any extra spaces. After <?= (int)LOGIN_FREE_ATTEMPTS + 1 ?> wrong passwords in a row, the page asks you to wait before it will check another one — <?= (int)LOGIN_COOLOFF_BASE ?> seconds at first, doubling with each further wrong password up to <?= (int)round(LOGIN_COOLOFF_MAX / 60) ?> minutes. This is a normal anti-guessing safeguard, not a lockout. Wait the time the page shows and try again; trying early does not make the wait longer. See <a href="#signing-in">Signing in &amp; out</a>.</p>
        </details>

        <details class="faq">
          <summary>I was signed out in the middle of editing ("Your sign-in session expired").</summary>
          <!-- ADM-2 — the order matters. Admin pages are not cached, so pressing
               Back while signed out reloads the page, finds no session and
               lands on the sign-in page with the typing gone. Signing in first,
               in another tab, is what lets Back bring the typing back. -->
          <p>Your typing can still be recovered, but <strong>the order matters</strong>:</p>
          <ol class="steps">
            <li>Leave that tab exactly as it is. Open your admin address in a <strong>new tab</strong> and sign in there.</li>
            <li>Go back to the original tab and press the browser's <strong>Back</strong> button (or <strong>Back to My Unsaved Page</strong>). Your typing reappears.</li>
            <li>Click Save again.</li>
          </ol>
          <p>If you press Back <em>before</em> signing in, the dashboard sends that tab to the sign-in page and what you typed is lost. If a red <strong>"You have been signed out"</strong> bar appears at the top of a page before you have saved, the same rule applies: sign in again in a new tab before you do anything else in this one.</p>
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
          <p><strong>Yes, and you can do it yourself.</strong> A backup of the whole catalog is written immediately before every deletion. Go to <strong>Backups</strong>, find the most recent <em>Product Catalog</em> entry — the one whose product count is one higher than now — and click <strong>Restore This Version</strong>. See <a href="#backups">Backups &amp; undo</a>. Do it before making other changes, since only the <?= (int)BACKUP_KEEP ?> most recent backups are kept.</p>
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
          <tr><td>PDF data sheet</td><td>The downloadable data sheet document customers can get for a product — see <a href="#pdfs">Managing PDF data sheets</a>.</td></tr>
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
          <li>Any wording marked <strong>Fixed</strong> in <a href="#sitemap">Where each part of the site is edited</a> — e.g. the name beside the logo, the footer paragraph, the Product Index heading</li>
          <li>Changing the overall look, layout, or features of the public website beyond what <a href="#business">Business Details</a> and <a href="#pagecontent">Page Content</a> cover</li>
          <li>Anything in <a href="#server-limits">What your server allows</a> reading a value you were told it shouldn't</li>
        </ul>
        <p>For anything covered on this page that isn't behaving the way it's described, that's worth flagging to your developer too — it may be worth a second look.</p>
      </section>

      <section class="help-section" id="server-limits">
        <div class="eyebrow eyebrow-reference">Reference</div>
        <h2>🖥️ What your server allows</h2>
        <p>These are read live from the server right now, not typed into the page. If an upload is rejected as "too large", compare the file against the first two numbers.</p>
        <!-- NEW-N3-1 — .user.ini is only read when PHP runs as CGI/FastCGI/
             PHP-FPM. Under mod_php it is ignored, and a php.ini dropped into
             public_html is ignored too (and was publicly served until
             public/.htaccess started blocking it). The only fix that works everywhere is the host's own
             setting, so that is what this tells the owner to ask for. -->
        <p><strong>These limits are set by your hosting, not by this dashboard.</strong> The website ships with a small settings file, <code>.user.ini</code>, that raises them. It works on the usual shared-hosting setup (PHP running as "FastCGI" or "PHP-FPM"), but some hosts ignore it. If the first three rows below still read PHP's out-of-the-box <code>2M</code>, <code>8M</code> and <code>1000</code>, ask your host to raise <code>upload_max_filesize</code>, <code>post_max_size</code> and <code>max_input_vars</code> for your account. <strong>Do not upload a <code>php.ini</code> file into the website folder</strong> to fix it: on a host that ignores <code>.user.ini</code> it is ignored too, so it only looks like a fix.</p>
        <table class="field-ref">
          <tr><th>Largest single file the server accepts</th><td><code><?= h(ini_get('upload_max_filesize') ?: 'unknown') ?></code></td></tr>
          <tr><th>Largest whole form submission</th><td><code><?= h(ini_get('post_max_size') ?: 'unknown') ?></code></td></tr>
          <tr><th>Max form fields per save</th><td><code><?= h((string)(ini_get('max_input_vars') ?: 'unknown')) ?></code> (the Page Content form currently posts about 450)</td></tr>
          <?php /* SEC-3 — this read session.gc_maxlifetime, which is garbage collection, not a limit; the real limits are the two constants. */ ?>
          <tr><th>Signed-out after inactivity</th><td><code><?= (int)(ADMIN_IDLE_LIMIT / 3600) ?> hours</code> without opening or saving a page; <code><?= (int)(ADMIN_ABSOLUTE_LIMIT / 3600) ?> hours</code> after signing in at most</td></tr>
          <tr><th>PHP version</th><td><code><?= h(PHP_VERSION) ?></code></td></tr>
          <tr><th><code>admin</code> folder writable</th><td><?= admin_writable() ? 'Yes' : '<strong style="color:#dc2626">NO &mdash; sales leads are being discarded</strong>' ?></td></tr>
          <tr><th><code>data</code> folder writable</th><td><?= data_writable() ? 'Yes' : '<strong style="color:#dc2626">NO &mdash; nothing you edit can be saved</strong>' ?></td></tr>
          <tr><th><code>uploads/images</code> writable</th><td><?= (is_dir(IMG_DIR) && is_writable(IMG_DIR)) ? 'Yes' : '<strong style="color:#dc2626">NO &mdash; photo uploads will fail</strong>' ?></td></tr>
          <?php /* NEW-N3-9 — the three other checks the Products-page banner
                   makes (admin/index.php), with the same tests, so this table
                   and the banner cannot disagree about the same server. */
                $helpTmpDir = sys_get_temp_dir(); ?>
          <tr><th><code>pdfs</code> folder writable</th><td><?= (is_dir(PDF_DIR) && is_writable(PDF_DIR)) ? 'Yes' : '<strong style="color:#dc2626">NO &mdash; data sheet uploads will fail</strong>' ?></td></tr>
          <tr><th>Server temporary folder writable</th><td><?= (is_dir($helpTmpDir) && is_writable($helpTmpDir)) ? 'Yes' : '<strong style="color:#dc2626">NO &mdash; the contact form&rsquo;s spam limit is not counting</strong> (<code>' . h($helpTmpDir) . '</code>)' ?></td></tr>
          <tr><th>Photo resizing (<code>gd</code>)</th><td><?= (extension_loaded('gd') && function_exists('imagescale')) ? 'Yes' : '<strong style="color:#dc2626">NO &mdash; large photos are saved at full size</strong>' ?></td></tr>
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
