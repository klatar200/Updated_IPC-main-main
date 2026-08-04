/*
 * Live preview for the Business Details page. Reads the form fields and renders
 * a contact-card / footer-style snapshot that updates as you type. External
 * file so it complies with the admin CSP (script-src 'self').
 */
(function () {
  "use strict";
  function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : ""; }
  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var CSS =
    ".sp-name{font-size:16px;font-weight:800;color:#141414;margin:0 0 2px;}" +
    ".sp-slogan{font-size:12px;color:#6b7280;font-style:italic;margin:0 0 14px;}" +
    ".sp-row{display:flex;gap:8px;font-size:12px;color:#374151;padding:5px 0;border-bottom:1px solid #f0f4f8;}" +
    ".sp-row .k{color:#9ca3af;flex:0 0 58px;text-transform:uppercase;font-size:10px;letter-spacing:.05em;padding-top:1px;}" +
    ".sp-row a{color:#005da3;text-decoration:none;}" +
    ".sp-badges{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0;}" +
    ".sp-badge{background:rgba(0,93,163,0.08);color:#005da3;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;}" +
    ".sp-social{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;}" +
    ".sp-social a{font-size:11px;color:#fff;background:#0d2d52;padding:3px 9px;border-radius:5px;text-decoration:none;}" +
    ".sp-foot{margin-top:14px;padding-top:10px;border-top:1px solid #e5e9ee;font-size:11px;color:#9ca3af;}" +
    ".sp-empty{color:#aeb8c4;}";

  function inject() { var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }

  function render(box) {
    var name = v("company_name") || "Company name";
    var slogan = v("company_slogan");
    var phone = v("contact_phone"), dial = v("contact_phoneDial") || phone;
    var fax = v("contact_fax"), email = v("contact_email");
    var street = v("addr_street"), city = v("addr_city"), state = v("addr_state"), zip = v("addr_zip");
    var addrLine = [street, [city, state].filter(Boolean).join(", "), zip].filter(Boolean).join(" · ");
    var hours = v("hours_text");
    var iso = v("cert_iso"), minOrder = v("stats_min"), feet = v("stats_feet"), founded = v("company_foundedYear");

    var rows = "";
    function row(k, inner) { return '<div class="sp-row"><span class="k">' + k + "</span><span>" + inner + "</span></div>"; }
    if (phone) rows += row("Phone", '<a href="tel:' + esc(dial) + '">' + esc(phone) + "</a>");
    if (fax) rows += row("Fax", esc(fax));
    if (email) rows += row("Email", '<a href="mailto:' + esc(email) + '">' + esc(email) + "</a>");
    if (addrLine) rows += row("Address", esc(addrLine));
    if (hours) rows += row("Hours", esc(hours));

    var badges = "";
    if (iso) badges += '<span class="sp-badge">' + esc(iso) + "</span>";
    if (minOrder) badges += '<span class="sp-badge">' + esc(minOrder) + " minimum</span>";
    if (feet) badges += '<span class="sp-badge">' + esc(feet) + " ft in stock</span>";

    var socials = "";
    [["facebook", "Facebook"], ["linkedin", "LinkedIn"], ["twitter", "Twitter"], ["youtube", "YouTube"], ["pinterest", "Pinterest"]]
      .forEach(function (s) { var u = v("social_" + s[0]); if (u) socials += '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + s[1] + "</a>"; });

    var html = '<div class="sp-name">' + esc(name) + "</div>";
    if (slogan) html += '<div class="sp-slogan">' + esc(slogan) + "</div>";
    html += rows || '<div class="sp-row sp-empty">Contact details appear here.</div>';
    if (badges) html += '<div class="sp-badges">' + badges + "</div>";
    if (socials) html += '<div class="sp-social">' + socials + "</div>";
    html += '<div class="sp-foot">© ' + new Date().getFullYear() + " " + esc(name) +
      (founded ? " — serving industry since " + esc(founded) : "") + "</div>";
    box.innerHTML = html;
  }

  function init() {
    var box = document.getElementById("settings-preview");
    var form = document.querySelector("main form");
    if (!box || !form) return;
    inject();
    var rerender = function () { render(box); };
    form.addEventListener("input", rerender);
    form.addEventListener("change", rerender);
    rerender();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
