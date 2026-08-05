# PLAN 3 — Lead capture

**Items:** **4.5**, **4.15b**
**Depends on:** nothing. **Effort:** 4.5 medium, 4.15b small. **Risk:** low.
**Read [GUARDRAILS.md](GUARDRAILS.md) first.**

Every defect here costs a sales enquiry. `CLAUDE.md` invariant 11 exists because
rejecting requests with an absent `Referer` "cost real leads" — that is the
standard this plan is held to.

---

## 4.5 — Every contact-form error is a browser `alert()`

### Evidence (confirmed 2026-08-05)

Four call sites in `src/App.jsx`, two per form:

| Line | Case |
|---|---|
| `3388` | `alert(json.error \|\| localizeProse(cf.submitError, site))` |
| `3391` | `alert(localizeProse(cf.networkError, site))` |
| `3423` | `alert(json.error \|\| localizeProse(cf.submitError, site))` |
| `3426` | `alert(localizeProse(cf.networkError, site))` |

No inline error, no `aria-live`, no focus move.

Why this loses leads:

- A native `alert()` on mobile is a system dialog that reads as "this site is
  broken". Dismissing it leaves no trace of what went wrong or which field.
- The server's message is specific — `contact.php` returns things like *"Name, a
  valid email address, and a message are required."* — but `alert()` gives the
  visitor nowhere to look, no field highlighted, and no focus.
- Screen-reader users get nothing announced in the form.
- Some mobile browsers suppress `alert()` during certain interactions entirely,
  so the failure can be **completely silent**.

### The fix

Replace all four with inline, accessible error rendering:

- An error region inside the form, above the submit control, with
  `role="alert"` / `aria-live="polite"` so it is announced.
- Move focus to that region — or to the first invalid field — on failure.
- Keep the server's message verbatim. `contact.php` deliberately does **not**
  HTML-escape (invariant 10: its destinations are a plain-text email and a JSONL
  line) — so escaping happens **here**, at the render boundary. Render as text,
  never as HTML. A quote request containing `<1/4 inch and >2 inch ID` must
  display literally; that exact string is asserted by `invariants.js`.
- Keep `cf.submitError` / `cf.networkError` as the copy source — they are
  owner-editable through `content.php`. Do not hardcode replacements.
- Distinguish network failure from validation failure. "Check your connection"
  and "your email address looks wrong" need different responses.
- Success should use the same region, not an `alert()`, if a success `alert()`
  exists on either form.

Both forms — the quote form and the message form — get identical treatment.

### Acceptance

- **Zero** `alert(` remaining in `src/App.jsx`: `grep -c "alert(" src/App.jsx` → `0`.
- Submitting with an empty required field shows an inline message naming the
  problem; focus lands in the error region or the offending field; the DOM node
  carries `role="alert"`.
- The server's specific message is displayed, not a generic one — assert against
  the real string returned by `contact.php`.
- A message containing `<1/4 inch and >2 inch ID, 1/2" wall` renders **literally**
  in the error region if echoed back, with no HTML injection. Assert on
  `textContent`.
- Simulated offline → network message, distinct from the validation message.
- 375 px and 1440 px screenshots of both forms in the error state.
- `sweep.js 18/18`, `invariants.js 15/15` (INV 10's live round-trip must hold),
  `b3.js 25/25`.

---

## 4.15b — Plus- and dot-addressing defeats the auto-reply cap

### Evidence

`public/contact.php` gates the courtesy auto-reply on `$autoReplyOk`
(set at `438`, cleared at `452`, used at `495`). The per-recipient cap keys on
the address **as submitted**.

Gmail treats `a@gmail.com`, `a+1@gmail.com` and `a.b@gmail.com` as the same
mailbox. A sender cycling `+1`, `+2`, `+3` gets a fresh auto-reply every time —
so the site can be used to send mail to a third party, with IPC's `From:`.

The per-IP rate limiter (B3) still bounds total volume, which is why this is not
a blocker.

### The fix

Normalise the address **for the cap's key only**:

- Lowercase the whole address.
- Strip everything from the first `+` to the `@` in the local part.
- For Gmail-family domains **only** (`gmail.com`, `googlemail.com`), also remove
  `.` from the local part.

**Do not apply dot-stripping to other domains.** Dots are significant almost
everywhere else, and collapsing them would merge genuinely different people onto
one cap — silently denying a real prospect their confirmation.

Critically: **the cap key is the only thing that changes.** The auto-reply is
still *sent* to the address exactly as submitted, and the address is still
*logged* exactly as submitted. Rewriting what gets stored would corrupt Rick's
lead record.

Also confirm the sales notification is unaffected — that one must always go out.
`contact.php:452` already notes the notification "already went out" when the
auto-reply is suppressed. Keep that ordering.

### Acceptance

- `a@gmail.com`, `a+1@gmail.com`, `a+2@gmail.com`, `a.b@gmail.com` collapse to
  one cap key: the first gets an auto-reply, the rest do not.
- `a.b@example.com` and `ab@example.com` remain **distinct** — both get replies.
- The **sales notification fires for every one** of those submissions. This is
  the check that matters most; suppressing a lead to fix a spam nuisance would be
  a strictly worse outcome.
- `inquiries.jsonl` records each address exactly as submitted, dots and plus tags
  intact.
- `b3.js 25/25`.

---

## Scope boundary

`src/App.jsx`'s two contact forms and `public/contact.php`'s auto-reply cap.

You are **not**: changing the guard order (rate limit → referer → honeypot — B3
established it and `b3.js` asserts it), altering `s()` or its length caps,
touching `hdr()` or any mail header path, adding a CAPTCHA or third-party
anti-spam (paid tooling is prohibited; a CAPTCHA is also a lead-loss decision to
escalate, not to implement), or changing the JSONL schema.

`s()` must keep **no** `/u` flag — it returned `null` on non-UTF-8 input and
produced a 500 (NB6). `b3.js` asserts this.

After any edit to `public/contact.php`, re-sync it into `dist/` and confirm
parity — `dist/contact.php` ships, and `cmp public/contact.php dist/contact.php`
must be silent.
