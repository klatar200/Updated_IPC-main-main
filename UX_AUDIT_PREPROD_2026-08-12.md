# UX Usability Audit Report — Insulation Products Corporation (Dev)

**Date:** 2026-08-12
**Environment:**
- `npm install` + `npm run dev` → Vite 5.4.21 on `http://localhost:5173` (Node v22.22.2, npm 10.9.7)
- `npm run build` → `dist/`, mirrored with `admin/ data/ pdfs/ uploads/` into a `public_html` tree and served by `php -S 127.0.0.1:8080` (PHP 8.4.19) behind a small router emulating `public/.htaccess` (SPA catch-all + `/sitemap.xml` → `sitemap.php`). This second stand-up was required because `contact.php` is PHP and the Vite dev server answers it with `index.html`.
- Browser: Chromium 1194 via Playwright, desktop 1280×900 and mobile 390×844.

**Personas tested:** Customer, Vendor
**Method:** Manual organic walkthrough (nav / CTAs / in-page links only), then a UI-driven coverage sweep, then a code-side route enumeration used *only* to check for orphan pages.
**Limitation:** Findings are limited to pages and flows actually reached in this session. Areas I could not exercise are listed under *Untested / blocked areas* and are not implied to be audited.

---

## Executive summary

**Overall readiness: Ready with fixes.**

The site is in good shape. The customer's primary goal — find a product, read its specs, download a datasheet, submit a quote request — completes end to end, and the supporting details are unusually well done: graceful 404 and bad-part fallbacks, a complete datasheet library with every link resolving, an auto-acknowledgement email to the sender, and a mail-failure error that hands the user a phone number. No console errors, no failed requests, no broken images, no horizontal scroll on mobile, and no orphan routes.

What holds it back is **product findability on desktop** and one **broken form on the contact page**.

### Top 5 user-blocking issues

1. **(High)** The desktop product catalog cannot be filtered — the sidebar looks like a filter but only expands jump-lists; the mobile version of the same page filters correctly. — F1
2. **(High)** `/products`, the destination of every "Browse Products" CTA on the site, has no search box; the only product search lives on `/dashboard`, buried in a dropdown. — F2
3. **(High)** On the "Send a Message" tab, four field labels focus the *Subject* box, and four inputs have no accessible label at all. — F3
4. **(High, vendor)** There is no vendor/supplier path anywhere on the site — no page, link, or copy. The vendor persona's goal is unreachable as such. — F16
5. **(Medium)** The "Electronics & Lab" industry card on the home page dead-ends on a page that has no Electronics & Lab section. — F4

### Biggest dead ends

- **Electronics & Lab → `/industries`** — lands at the top of a page covering five *other* industries (F4).
- **Desktop catalog category click → nothing filters** — the user's only remaining option is to eyeball 42 cards (F1).
- **Vendor arriving at the site → no route at all** — the only usable surface is a general contact form whose primary tab demands a part number and quantity (F16).

---

## Environment & setup notes

| Step | Command | Result |
|---|---|---|
| Install | `npm install` | 135 packages, no blocking errors |
| Dev server | `npm run dev` | Ready in 340 ms on `:5173`. Benign noise: `xdg-open ENOENT` (no browser in container), a PostCSS module-type warning, and a Babel note that `src/App.jsx` exceeds 500 KB. |
| Build | `npm run build` | Clean; 368 KB JS / 23 KB CSS |
| PHP stand-up | `php -S 127.0.0.1:8080` over a `public_html` mirror | `/`, `/products`, `/sitemap.xml`, `/pdfs/*.pdf` all 200 |

**Auth used:** none. The public site requires no account, and no signup exists. The `admin/` back office is not linked from any public page and was treated as out of scope for both personas.

**Blockers encountered:** none — the site stood up on both servers.

**One environment caveat worth stating plainly:** `mail()` has no MTA in this container. My first quote submission therefore failed, and I reran it with a capturing `sendmail_path` to reach the success path. Both the failure and success states below are real UI states; neither is a defect of the site.

---

## Persona journeys

### Customer — outcome: **SUCCESS**

**Goal attempted:** understand what IPC sells, find a specific heat-shrink product, verify its specs, and request a quote.

**Key path:** `/` → *Browse Products* → `/products` → sidebar *Polyolefin Heat Shrink* → product card → `/products?productId=IP33PO` → *Download PDF* → *Request Quote* → `/contact?part=IP33PO` → submit → confirmation.

| # | URL | Action | Expectation | Result | Friction |
|---|---|---|---|---|---|
| C1 | `/` | Land, orient 60 s | Learn what this is | Immediately clear: "spec-grade stocking distributor of heat-shrinkable & extruded tubing…", $50 minimum, 25M ft in stock, ISO 9001 | none |
| C2 | `/` | Open *Products ▼* | See product areas | 3 primary links + 10 family shortcuts | none |
| C3 | `/` | Click *Browse Products →* | Filterable catalog | `/products`, 42 cards, no search field | **major** (F2) |
| C4 | `/products` | Click sidebar *POLYOLEFIN HEAT SHRINK (12)* | Grid filters to 12 | Grid unchanged — all 42 still shown, still starting at Accessories (CC, CC90, CCS). Accordion expanded to 12 jump-links; product links went 84 → 96 | **major** (F1) |
| C5 | `/products` | Click *IP33PO* in the expanded list | Product detail | Full detail card: description, approvals, 18-row size table, related products | none |
| C6 | `/products?productId=IP33PO` | Read the page heading | Product name as H1 | H1 reads "Product Catalog"; subtitle says "Select another product from the list…" though a product is displayed | **minor** (F6) |
| C7 | same | Click *Download PDF* | Datasheet | `/pdfs/IP33PO.pdf` → 200, `application/pdf`, 56.9 KB | none |
| C8 | same | Click *Request Quote* | Form knowing my part | `/contact?part=IP33PO`, **PART NUMBER pre-filled with `IP33PO`** | none — strength |
| C9 | `/contact?part=IP33PO` | Submit empty | Told what's missing | Native HTML5 validation blocks submit; no POST fired | none |
| C10 | same | Fill all fields, submit (no MTA) | Confirmation | Inline red error: *"The mail server could not send your message. Please call 630.771.0700 or email sales@insulationproducts.com directly."* All typed data preserved. Inquiry still written to `admin/inquiries.jsonl` with `"sent":false` | none — strength |
| C11 | same | Resubmit with mail capture working | Confirmation | `POST /contact.php → 200 {"ok":true}`; URL → `?sent=1`; success screen "Quote Request Received / Thank you!" with reply-time expectation, phone/fax/email, and *Submit Another* / *Browse Products* | none — strength |
| C12 | `/contact?part=IP33PO&sent=1` | Reload the URL | Form, or a stale-state notice | Success screen re-renders — a confirmation for a request that was never sent | **minor** (F5) |

### Vendor — outcome: **ABANDONED (goal not supported)**

**Goal attempted:** find out how to become a supplier/partner to IPC and start that conversation.

**Key path:** `/` → *Company ▼* → `/about` → `/services` → `/faq` → footer sweep → `/careers` (guessed) → `/contact` → *Send a Message*.

| # | URL | Action | Expectation | Result | Friction |
|---|---|---|---|---|---|
| V1 | `/` | Scan nav + footer for a vendor entry | "Suppliers", "Partners", "Careers" | Nav is Home / Products / Company / Request a Quote. Footer quick-links: Catalog, About, Product Index, FAQ, Industries, Contact, Services, Privacy. **Nothing vendor-facing** | **major** (F16) |
| V2 | `/about` | Read for supplier info | Procurement or partnership mention | Company history, certifications, team, timeline — all customer-facing | major |
| V3 | `/faq` | Expand all 18 questions | A supplier question | 4 categories (Products, Custom Fabrication, Ordering & Minimums, Support & Documentation) — all customer-side | major |
| V4 | all 10 pages | Text scan for *vendor / supplier / partner / distributor / reseller / line card / careers / terms of sale* | Any vendor route | Every hit is IPC describing **itself** as a distributor, or IPC supporting its automotive **customers'** supplier requirements (PPAP/IMDS). Zero vendor-facing content | **dead end** (F16) |
| V5 | `/careers` | Type the URL directly | Careers page | "ERROR 404 / Page not found" with three recovery links and a phone number — a good 404, but confirms no such route | dead end |
| V6 | `/contact` | Inspect *Request a Quote* tab | Usable for a supplier pitch | Requires **QUANTITY REQUIRED**; asks part number, material, delivery date — structurally a buyer's RFQ | major |
| V7 | `/contact` | Switch to *Send a Message* | A general-purpose form | Name / Email / Phone / Company / Subject / Message — usable | none |
| V8 | same | Click the *FULL NAME* label | Focus the name field | **Focus lands in the Subject field.** Same for EMAIL, PHONE and COMPANY. Clicking *SUBJECT* focuses nothing | **major** (F3) |
| V9 | same | Fill via the boxes directly and send | Delivery + routing to purchasing | `200 {"ok":true}`; "Message Received / Thank you!"; auto-acknowledgement emailed to the sender. But it says *"Our sales team will respond"* — a supplier pitch is routed to `sales@` with no indication anyone owns it | **minor** (F16) |

**Outcome:** a vendor *can* get a message through, but only by abandoning the persona's actual goal — nothing on the site tells them this is the right path, and the destination is the sales inbox. Per the brief, this ambiguity is itself the finding.

---

## Findings (ordered by severity)

### [F1] Desktop catalog category clicks don't filter anything — but the mobile version of the same page does
- **Severity:** High
- **Persona(s):** Customer, Vendor
- **Where:** `/products`, left sidebar ("PRODUCT CATALOG / 42 products" + per-category counts)
- **What happened:** Clicking *POLYOLEFIN HEAT SHRINK (12)* expanded an accordion of 12 product jump-links. The 42-card grid did not change — same cards, same order, still led by Accessories (CC, CC90, CCS, CT…). Measured: product links on page went **84 → 96** (i.e. 12 added, none removed). At 390 px the identical categories render as chips and clicking *Polyolefin Heat Shrink (12)* took product links **84 → 54** — a real filter, plus a clean 2-column result list.
- **Why it fails UX:** Counts next to category names are the universal signature of a filter. The user forms a filtering expectation, acts on it, and the page appears not to respond — the grid is unchanged and the new links appear off to the side. A visitor who wants heat shrink still has to scan 42 cards that open with conduit couplings. Desktop, the primary B2B browsing context, is strictly worse than mobile at the catalog's core job.
- **Evidence:** Journey C4, M3. Shots `05_sidebar_polyolefin_expanded.png`, `m_products_filtered.png`.
- **Dead end?** Partial — the user can still reach products via the jump-links, but cannot narrow the catalog.
- **Recommendation:** Make the desktop sidebar filter the grid, matching the mobile chips.
- **How to change:** Bind the desktop category button to the same state the mobile chips already set, so the grid renders only that family; keep the accordion jump-links as a secondary aid. Add an "All (42)" reset row at the top and reflect the active category in the "42 products" count (e.g. "12 of 42 products"), as `/dashboard` already does.
- **Effort guess:** S — the filtering state and logic already exist for mobile.

### [F2] The page every "Browse Products" CTA points to has no search
- **Severity:** High
- **Persona(s):** Customer
- **Where:** `/products` (vs. `/dashboard`)
- **What happened:** `/products` contains **zero input elements**. The only product search on the site is on `/dashboard` ("Product Index"), placeholder *"Search by part ID, type, or description…"*. Every prominent path leads to `/products`: the hero *Browse Products →*, *View Full Catalog →*, all six product-category cards, the closing CTA, and the footer's *Product Catalog*. `/dashboard` is reachable only as the second item inside the *Products ▼* dropdown or via a footer link labelled "Product Index".
- **Why it fails UX:** In this category buyers arrive with a part number or a spec. The site has a genuinely strong search-and-filter tool and routes almost nobody to it, while funnelling everyone into an unsearchable 42-card grid. The two pages' names ("Product Catalog" vs "Product Index") don't signal which one can find things.
- **Evidence:** Journey C3. Measured inputs per page: `/products` `[]`; `/dashboard` `[{"aria":"Search products"}]`.
- **Dead end?** No — but the fastest route to a part is effectively hidden.
- **Recommendation:** Put a search box on `/products`, and make the relationship between the two pages explicit.
- **How to change:** Add the same search input above the catalog grid on `/products`, filtering the cards as you type. At minimum, place a visible link at the top of `/products` — "Looking for a specific part? **Search the Product Index →**" — and retitle the dropdown/footer entry to "Product Index (search & compare specs)".
- **Effort guess:** S–M.

### [F3] "Send a Message" tab: four labels focus the wrong field; four inputs have no label at all
- **Severity:** High
- **Persona(s):** Customer, Vendor
- **Where:** `/contact` → *Send a Message* tab
- **What happened:** Clicking each label and reading `document.activeElement`:

  | Label clicked | Focus lands on |
  |---|---|
  | FULL NAME * | `input name="subject"` |
  | EMAIL * | `input name="subject"` |
  | PHONE | `input name="subject"` |
  | COMPANY | `input name="subject"` |
  | SUBJECT * | *nothing* (falls through to `<main>`) |
  | MESSAGE * | `textarea name="message"` ✓ |

  In the DOM, the `name`, `email`, `phone` and `company` inputs have **no `id`** and **no `aria-label`**; four separate labels all carry `for="rfq-subject"`; the "SUBJECT *" label has no `for` at all. The *Request a Quote* tab is correct — all eleven of its labels map to matching `rfq-*` ids.
- **Why it fails UX:** Clicking a label to focus its field is standard behaviour people rely on without thinking. Here it silently drops the cursor into Subject, so a user types their name into the subject line and only notices later — or doesn't. For screen-reader and voice-control users the four fields are unlabelled, which makes the form the harder of the two paths precisely for the people who need it most. It is also the *only* form a vendor can use (F16).
- **Evidence:** Journey V8; `lblclick.mjs` focus trace above.
- **Dead end?** No — the fields still accept typed input when clicked directly.
- **Recommendation:** Give the four inputs unique ids and point each label at its own field.
- **How to change:** Mirror the RFQ tab's convention — `id="msg-name" / msg-email / msg-phone / msg-company / msg-subject / msg-message`, with each `<label for>` matching. (The subject and message inputs currently carry `rfq-`-prefixed ids on the message form; renaming them to `msg-` also removes the risk of a collision if both forms are ever mounted together.)
- **Effort guess:** S.

### [F16] No vendor or supplier path exists anywhere on the site
- **Severity:** High (for the Vendor persona); Medium as a general IA gap
- **Persona(s):** Vendor
- **Where:** Whole site — all 10 pages
- **What happened:** A term sweep across every discoverable page for *vendor, supplier, partner, become a, sell to us, distributor, reseller, line card, careers, jobs, apply, wholesale, terms of sale, credit application, purchasing* returned only two kinds of hit: IPC describing itself ("a spec-grade stocking **distributor**…", "privately held, independent **distributor**") and IPC supporting its automotive **customers'** obligations ("IPC can support automotive **supplier** requirements for PPAP packages and IMDS material data submissions"). `/careers` returns the 404 page. The FAQ's 18 questions are entirely customer-side.
- **Why it fails UX:** A supplier, manufacturer's rep, or job seeker has no entry point and no way to tell whether IPC wants to hear from them. The only usable surface is the general contact form, whose default tab is a buyer's RFQ requiring a quantity. The message they eventually send lands in `sales@` and is answered with "Our sales team will respond" — nothing signals that anyone owns supplier enquiries.
- **Evidence:** Journey V1–V9; `vendor.mjs` term sweep across all 10 routes.
- **Dead end?** **Yes** — the vendor cannot discover, qualify for, or apply to anything. They can only send an unrouted message.
- **Recommendation:** Decide explicitly whether the site serves vendors, then say so in one place.
  - *If yes:* add a short "Suppliers & Partners" section to `/about` (or a `/suppliers` page linked from the Company dropdown and footer) stating what IPC sources, what documentation it requires, and the correct contact address; add a "Supplier / vendor enquiry" option to the *Send a Message* form so it can be routed.
  - *If no:* add one line to the FAQ under a "Working with IPC" heading — e.g. *"Supplier and partnership enquiries: email sales@insulationproducts.com with 'Supplier enquiry' in the subject."* This costs a sentence and removes the dead end.
- **How to change:** Smallest sufficient fix is the FAQ line plus a subject option on the message form.
- **Effort guess:** S (FAQ line) / M (dedicated page).

### [F4] "Electronics & Lab" industry card dead-ends on a page with no such section
- **Severity:** Medium
- **Persona(s):** Customer
- **Where:** `/` → "Industries Served" grid → *Electronics & Lab* card → `/industries`
- **What happened:** The home page shows six industry cards, each with a *Learn More →*. Five link to anchors (`/industries#industry-automotive`, `#industry-aerospace`, `#industry-medical`, `#industry-industrial`, `#industry-marine`) and all five scroll correctly (target lands at 84 px, clear of the sticky header). The sixth, **Electronics & Lab**, links to `/industries` with **no anchor**. The Industries page has exactly five sections — Automotive, Aerospace & Defense, Medical Devices, Industrial & OEM, Marine & Outdoor — and the string "electronic" does not appear anywhere in its content. The user lands at the top of the page (`scrollY=0`) with no explanation.
- **Why it fails UX:** The home page promises a whole named audience segment — "PTFE spaghetti tubing, thin-wall polyolefin, and Mylar high-dielectric for PCB and instrumentation work" — and the follow-through doesn't exist. The visitor sees five unrelated industries and has to work out for themselves that theirs was never there.
- **Evidence:** Journey step (Industries sweep); `elec.mjs` — headings `["Automotive","Aerospace & Defense","Medical Devices","Industrial & OEM","Marine & Outdoor"]`, `/electronic/i` test = `false`.
- **Dead end?** **Yes** — the user cannot reach electronics/lab guidance from the CTA that offered it.
- **Recommendation:** Either add the section or stop advertising it.
- **How to change:** Preferred — add an `id="industry-electronics"` section to `/industries` in the same shape as the other five (applications, IPC products, certifications), listing the products the home card already names (IP17TW-IP18SW-IP19LW, IP33TW, IP48MH), and point the card at `#industry-electronics`. Minimum — remove the sixth card, or drop its *Learn More →* so it reads as descriptive rather than navigational.
- **Effort guess:** M (add section) / S (remove the CTA).

### [F5] Reloading or sharing `?sent=1` shows a confirmation for a request that was never sent
- **Severity:** Medium
- **Persona(s):** Customer, Vendor
- **Where:** `/contact?part=IP33PO&sent=1`
- **What happened:** After a successful submit the URL becomes `…&sent=1`. Navigating to that URL fresh — reload, bookmark, browser restore, or a pasted link — re-renders the full success screen: "REQUEST SENT / Quote Request Received / Thank you! Your quote request has been received." No request is made.
- **Why it fails UX:** The confirmation is the user's only proof their RFQ went through. Refreshing after a submit is common, and this makes it impossible to distinguish "it worked" from "the page is echoing a query string". Anyone forwarded that link is told their quote was received when nothing was submitted.
- **Evidence:** Journey C12; `vp.mjs` — direct navigation to the `sent=1` URL rendered "Quote Request Received".
- **Dead end?** No — *Submit Another* returns to the form.
- **Recommendation:** Tie the success screen to the submission that produced it rather than to the URL.
- **How to change:** Hold the "sent" state in component state set by the successful POST, and strip the parameter with the existing `{ replace: true }` setter after render — the routing shim already supports exactly this "read the param, then strip it" cleanup. A visitor arriving at `?sent=1` cold then sees the form.
- **Effort guess:** S.

### [F6] The product detail page's dominant heading says "Product Catalog", not the product
- **Severity:** Medium
- **Persona(s):** Customer
- **Where:** `/products?productId=<id>` — page header band
- **CORRECTION (2026-08-12, during the fix pass):** this finding originally said *"the H1 is 'Product Catalog'"*. That was wrong about the mechanism. Measured, the `<h1>` **is** the product name — "Heat Shrinkable Polyolefin Tubing", 20px, at y=388 — and the "Product Catalog" text at 36px, y=171 is a **`div`**, made one deliberately (there is a comment in `App.jsx` explaining the demotion). So the page was already correct semantically and for SEO. The defect is **visual hierarchy only**, and the observation below — the biggest text on screen names the wrong thing — stands as recorded.
- **What happened:** On `/products?productId=IP33PO` the largest text on the page (36px) reads **"Product Catalog"**, and the subtitle beneath it reads *"Select another product from the list to view full specifications, data sheet, and request a quote."* — an instruction to do the thing already done, on a page showing the result. The product's own name renders at 20px, some 200px further down, inside the detail card. The breadcrumb and `<title>` are both correct ("Heat Shrinkable Polyolefin Tubing — IP33PO — …").
- **Why it fails UX:** The largest text on the page describes the wrong thing. This matters most for the visitor arriving cold from a search engine or a shared link, whose first orientation cue contradicts the page they're on — and the subtitle actively suggests they haven't selected anything yet.
- **Evidence:** Journey C6; shot `06_product_detail_IP33PO.png`.
- **Dead end?** No.
- **Recommendation:** When a product is selected, make the page header name the product.
- **How to change:** Point the 36px `div` at the product name and replace the subtitle with the product's `caption` ("Shrink over terminals for insulation and strain relief."), which is already rendered under the image. Leave it a `div` — the product-name `<h1>` in the detail card should stay the only `h1`. Keep "Product Catalog" on the unfiltered `/products` view, where it is a real `h1`.
- **Effort guess:** S.

### [F9] The generic submit-failure message offers no way to recover
- **Severity:** Medium
- **Persona(s):** Customer, Vendor
- **Where:** `/contact`, both tabs — non-JSON response branch
- **What happened:** Submitting against a server that answers the POST with something other than JSON produced the bare inline error **"Unexpected server response."** By contrast, the mail-failure branch returns an excellent message: *"The mail server could not send your message. Please call 630.771.0700 or email sales@insulationproducts.com directly."*
- **Why it fails UX:** Both branches are hit at the same moment in the same flow — a lead has just typed a full RFQ. One hands them a phone number; the other gives them a developer's phrase and no next step. Wording aside, the user is left holding a form that won't go through.
- **Evidence:** Journey C10 vs. the Vite-served run, where `POST /contact.php` returned `200 text/html` and the UI showed "Unexpected server response."
- **Dead end?** Yes, momentarily — no route forward is offered from the error itself.
- **Recommendation:** Give every failure branch the same fallback the mail branch already has.
- **How to change:** Append the existing fallback sentence to the generic error: *"We couldn't submit your request. Please call 630.771.0700 or email sales@insulationproducts.com directly."* One shared string for all non-success branches.
- **Effort guess:** S.

### [F7] The breadcrumb's family link leaves the catalog for a different page
- **Severity:** Low
- **Persona(s):** Customer
- **Where:** `/products?productId=IP33PO` — breadcrumb *Home › Product Catalog › Polyolefin Heat Shrink › Heat Shrinkable Polyolefin Tubing*
- **What happened:** "Product Catalog" → `/products` (same page), but "Polyolefin Heat Shrink" → `/dashboard?family=Polyolefin+Heat+Shrink` — the Product Index table, a different page with a different layout.
- **Why it fails UX:** A breadcrumb reads as a ladder up the page you're on. Here the middle rung switches the user into a different browsing surface mid-climb, which is disorienting on the way "up" from a product.
- **Evidence:** Link dump on `/products?productId=IP33PO`.
- **Dead end?** No.
- **Recommendation:** Point the family crumb at the family within the catalog.
- **How to change:** Once F1 lands and `/products` can filter by family, link the crumb to the filtered catalog view instead of `/dashboard`. These two findings are best fixed together.
- **Effort guess:** S (after F1).

### [F8] The sticky product bar drops the part number from its quote link
- **Severity:** Low
- **Persona(s):** Customer
- **Where:** `/products?productId=IP33PO` — sticky bottom action bar
- **What happened:** The card's top-right *Request Quote* → `/contact?part=IP33PO` (pre-fills PART NUMBER). The sticky bar's *Request a Quote →* → `/contact` with no parameter, so the field arrives empty.
- **Why it fails UX:** Two controls with the same label on one page produce different results. The sticky bar is the one on screen after the user has scrolled through the spec table — i.e. the one they're most likely to press — and it's the one that loses the context.
- **Evidence:** Link dump: `{"t":"Request Quote","h":"/contact?part=IP33PO"}` vs `{"t":"Request a Quote →","h":"/contact"}`.
- **Dead end?** No — the user can type the part number.
- **Recommendation:** Give the sticky bar the same `?part=` link as the card button. Its *Data Sheet* link already carries product context correctly.
- **Effort guess:** S.

### [F10] Escape doesn't close a nav dropdown once focus is inside it
- **Severity:** Low
- **Persona(s):** Customer, Vendor
- **Where:** Header *Products ▼* / *Company ▼*
- **What happened:** Escape **does** close the menu when focus is still on the trigger (`aria-expanded` true → false), click-outside closes it, and opening the other menu closes the first. But after Tab moves focus into the menu (onto *Browse All Products*), Escape leaves `aria-expanded="true"` and focus unmoved.
- **Why it fails UX:** A keyboard user who opens the menu, tabs in, and decides against it has no way to dismiss it and return to the trigger; they must tab through all 13 items or click.
- **Evidence:** `esc.mjs` / `esc2.mjs` traces.
- **Dead end?** No.
- **Recommendation:** Handle Escape on the menu container, not only the trigger.
- **How to change:** Add a keydown handler on the dropdown wrapper that closes the menu and returns focus to the trigger button on Escape.
- **Effort guess:** S.

### [F11] The datasheet filter's empty state has no way out
- **Severity:** Low
- **Persona(s):** Customer
- **Where:** `/datasheets`
- **What happened:** Filtering for `zzzz` shows *"0 of 42 shown / No datasheets match "zzzz"."* — text only. The equivalent state on `/dashboard` reads *"No products found / No results for "zzzz". Try a different search term or clear the category filter."* plus a **Clear all filters** button.
- **Why it fails UX:** Two search surfaces, two standards. The user has to find and clear the box themselves in the place that gives them the least help.
- **Evidence:** `ds.mjs` empty-state capture.
- **Dead end?** No.
- **Recommendation:** Reuse the Product Index empty state — add a *Clear filter* button and the "try a different term" line.
- **Effort guess:** S.

### [F12] "1 service differs — see below." doesn't say what differs
- **Severity:** Low
- **Persona(s):** Customer
- **Where:** `/services`, lead-time band
- **What happened:** The band reads: *"Standard Lead Time: ≤ 1 week — 1 service differs — see below. All fabrication services listed below. Rush service available — contact sales for details."* Reading all six service blocks (Cut-to-Length, Spooling & Coiling, Hot-Stamp Marking, Kitting & Bagging, Bar Code Printing, Slit & Perforation), none states a different lead time.
- **Why it fails UX:** The sentence tells the buyer one of these has a caveat that matters to their schedule, then never identifies it. It's worse than saying nothing — it introduces a doubt with no resolution, and reads as machine-generated.
- **Evidence:** `/services` page text.
- **Dead end?** No.
- **Recommendation:** Name the exception inline or remove the clause.
- **How to change:** If a service genuinely has a longer lead time, state it in that service's own block ("Lead time: ~2 weeks") and change the band to "Standard lead time ≤ 1 week — see individual services for exceptions." If not, delete "1 service differs — see below."
- **Effort guess:** S.

### [F13] The home page states two different shipping claims within one screen
- **Severity:** Low
- **Persona(s):** Customer
- **Where:** `/` — hero stat tiles and the stat bar directly below
- **What happened:** The hero tiles read **"Same Day / Shipment Available / On in-stock items"**. Roughly 400 px below, the stat bar reads **"≤1 Day / Shipment Available / On most stock items"**. `$50 Minimum Order` and `25M+ Feet in Stock` each appear in both rows with identical wording.
- **Why it fails UX:** Two speed claims and two qualifiers ("in-stock" vs "most stock") sit close enough to be read together. A buyer choosing on lead time can't tell which is the commitment, and the duplication makes the second row read as filler.
- **Evidence:** Home page text and shot `01_home_landing.png`.
- **Dead end?** No.
- **Recommendation:** State one shipping claim with one qualifier, and let the second row carry only what the hero doesn't.
- **How to change:** Keep "Same Day · On in-stock items" in the hero; change the lower bar's four tiles to non-duplicating facts (e.g. 50+ Years in Business, ISO 9001 Registered, Custom Lead Time ≤ 1 week, PPAP/IMDS Available).
- **Effort guess:** S.

### [F15] Size searches return nothing in the Product Index
- **Severity:** Low
- **Persona(s):** Customer
- **Where:** `/dashboard` search
- **What happened:** `3:1` → 2 of 42; `kynar` → 1 of 42; **`1/2 inch` → 0 of 42**, despite `1/2"` appearing in the size table of IP33PO and many others.
- **Why it fails UX:** Size is one of the two things a buyer knows (with material). The search's placeholder — *"Search by part ID, type, or description…"* — is honest about its scope, so this is a capability gap rather than a broken promise, and the empty state recovers well. But a plausible first query returns nothing.
- **Evidence:** `dsrch.mjs` result counts.
- **Dead end?** No — the empty state offers *Clear all filters*.
- **Recommendation:** Either include size data in the search index, or set expectations at the point of failure.
- **How to change:** Cheapest fix: extend the empty-state copy to "No results for "1/2 inch". Search covers part ID, type and description — sizes are listed on each product page." Better: include each product's size table values in the searchable text.
- **Effort guess:** S (copy) / M (index sizes).

### [F14] An unlabelled photo band sits between two home-page sections
- **Severity:** Nice-to-have
- **Persona(s):** Customer
- **Where:** `/`, between the "Talk to Our Sales Team" band and "Industries Served"
- **What happened:** Two photographs (staff group shot, building exterior) render full-width with no heading, caption, or link. Their `alt` text is good — "The Insulation Products Corporation team outside the Bolingbrook facility" and "The IPC facility at 250 Gibraltar Drive, Bolingbrook, Illinois" — but nothing is shown on screen.
- **Why it fails UX:** These are trust assets — a real team, a real building, for a 50-year-old firm — presented without the sentence that would make them work. A sighted visitor sees two uncaptioned photos; a screen-reader user gets the better experience.
- **Evidence:** Shot `01_home_landing.png`; `esc2.mjs` image dump.
- **Dead end?** No.
- **Recommendation:** Add a short heading and caption, and link the band to `/about`.
- **How to change:** e.g. "**Made in Bolingbrook since 1974**" with a one-line caption and a *More about IPC →* link.
- **Effort guess:** S.

### [F17] Missing space in the privacy-page footer line
- **Severity:** Nice-to-have
- **Persona(s):** Customer
- **Where:** `/privacy`, closing line
- **What happened:** Renders as `© 1974–2026 Insulation Products Corporation ·250 Gibraltar Dr, Bolingbrook, IL 60440` — no space after the separator.
- **Evidence:** `/privacy` page text.
- **Recommendation:** Add the space after `·`.
- **Effort guess:** S.

---

## Dead-end inventory

| # | Location | Trigger | What the user wanted | What blocked them | Recommended fix |
|---|---|---|---|---|---|
| 1 | `/` → *Electronics & Lab* → `/industries` | Click *Learn More →* | Electronics/lab products & certs | Page has 5 sections, none about electronics; no anchor, no explanation | Add `#industry-electronics` section, or drop the CTA (F4) |
| 2 | `/products` sidebar | Click a category with a count | Narrow 42 products to 12 | Grid doesn't filter on desktop; mobile does | Wire the desktop sidebar to the existing mobile filter state (F1) |
| 3 | Whole site (Vendor) | Look for a supplier/partner route | Qualify and apply as a supplier | No page, link, or copy exists; `/careers` 404s | Add a "Suppliers & Partners" FAQ entry or page + a subject option on the message form (F16) |
| 4 | `/contact` submit failure (generic branch) | Submit an RFQ | Send the request | "Unexpected server response." with no phone/email fallback | Reuse the mail-branch fallback string across all failure branches (F9) |
| 5 | Header dropdown (keyboard) | Tab into menu, press Escape | Dismiss and move on | Menu stays open, focus unmoved | Handle Escape on the menu container (F10) |

---

## Recommended change backlog (prioritized)

### 1. Must-fix before production
1. **F3** — Fix label/`id` associations on the *Send a Message* tab. Four labels currently focus the Subject box; four inputs are unlabelled. (S)
2. **F1** — Make the desktop catalog sidebar filter the grid, as the mobile chips already do. (S)
3. **F2** — Add search to `/products`, or link prominently to the Product Index from it. (S–M)
4. **F16** — Add one authoritative line about supplier/partner enquiries and a routing option on the message form. (S)
5. **F4** — Add the Electronics & Lab section to `/industries`, or remove its *Learn More →*. (S–M)
6. **F9** — Give every submit-failure branch the phone/email fallback the mail branch already has. (S)

### 2. Should-fix soon after
7. **F5** — Stop `?sent=1` from re-rendering a confirmation on reload. (S)
8. **F6** — Make the product detail H1 the product, not "Product Catalog". (S)
9. **F8** — Carry `?part=` on the sticky bar's quote link. (S)
10. **F12** — Say which service differs on lead time, or delete the clause. (S)
11. **F13** — Reconcile "Same Day" vs "≤1 Day" and de-duplicate the home stats. (S)

### 3. Later / polish
12. **F7** — Point the breadcrumb family crumb at the filtered catalog (after F1). (S)
13. **F10** — Escape closes the dropdown from inside the menu. (S)
14. **F11** — Add *Clear filter* to the datasheets empty state. (S)
15. **F15** — Index sizes, or explain the search's scope in the empty state. (S–M)
16. **F14** — Caption and link the home photo band. (S)
17. **F17** — Fix the `·250` spacing on `/privacy`. (S)

---

## What worked well

Evidence-based, all observed this session:

- **The quote flow works end to end and keeps context.** *Request Quote* on a product carries `?part=IP33PO` and the form arrives pre-filled — the single best interaction on the site (C8).
- **Failure states are unusually well handled.** When `mail()` failed, the user got *"The mail server could not send your message. Please call 630.771.0700 or email sales@insulationproducts.com directly."*, every typed field was preserved, and the inquiry was still written to `admin/inquiries.jsonl` with `"sent":false` — the lead is not lost (C10).
- **A confirmation email is sent to the person who wrote in**, with reply-time expectations and direct contact details — a real trust signal (V9).
- **The 404 page is a genuine recovery page**, offering *Browse the product catalog*, *Search the product index*, *Request a quote*, and "Or call 630.771.0700 and we will point you at the right part."
- **Unknown part numbers degrade gracefully.** `?productId=NOPE123` → *"We couldn't find part "NOPE123". It may have been renamed or discontinued. Showing the catalog instead…"* with the full catalog beneath.
- **The Product Index (`/dashboard`) is excellent** — search, category filters, 12 approval filters (UL, CSA, MIL-SPEC, RoHS, FDA, USP Class VI…), sortable columns, live "42 of 42 products" count, and an empty state with a *Clear all filters* action.
- **The datasheet library is complete and honest.** 42 of 42 products have a datasheet; **all 42 PDF links returned 200** when checked individually; the page states "Download directly — no form, no email address."
- **Industry anchors work.** All five `#industry-*` targets scroll to 84 px, clear of the sticky header.
- **Mobile is solid.** No horizontal overflow at 390 px on `/`, `/products`, `/dashboard` or `/contact`; the catalog genuinely filters; the drawer menu is clean.
- **Accessibility fundamentals are present** outside F3: a working "Skip to main content" link as the first tab stop, visible focus outlines throughout, correct `aria-expanded` on both dropdowns, dropdowns dismissed by click-outside and by Escape-on-trigger, and descriptive `alt` text on every image checked.
- **Technically clean.** Zero console errors, zero page errors, zero 4xx/5xx responses, and zero broken images across every page visited. (The blank tiles in my first catalog capture were lazy-loading, not breakage — all 39 images reported `naturalWidth > 0` after scrolling.)
- **No orphan pages.** All ten routes — home, products, dashboard, datasheets, about, industries, services, faq, contact, privacy — are reachable from the header or footer.

---

## Untested / blocked areas

Not audited; listed so they aren't mistaken for passes.

- **Apache `.htaccess` enforcement.** `php -S` ignores `.htaccess`, so the `admin/` and `data/` file-blocking rules and the real rewrite behaviour were never exercised. My router only *emulates* the SPA catch-all and the sitemap rewrite.
- **Real email delivery.** No MTA exists in this container. I observed the failure path natively and reached the success path via a capturing `sendmail_path`. Actual deliverability, formatting in a mail client, and inbox placement are untested.
- **The `admin/` back office.** Not linked from any public page and outside both personas' goals. No admin screen was opened, and no admin credentials were used.
- **Cross-browser and real devices.** Chromium only, at two viewport sizes. No Safari, Firefox, or physical hardware.
- **Assistive technology.** F3 was established by inspecting label/`id` associations and focus behaviour programmatically. No screen reader (NVDA/JAWS/VoiceOver) was run, so the lived severity of the unlabelled fields may be worse than described, not better.
- **Contrast and typography ratios.** Not measured; no colour-contrast tooling was run, so no accessibility claim is made about the palette.
- **Load, performance, and SEO.** Out of scope per the brief; no measurements taken.
- **The `sitemap.php` output.** Confirmed only that `/sitemap.xml` returns `200 application/xml`; its contents were not validated against the catalog.
- **Print and email rendering of product spec tables.** Not attempted.
