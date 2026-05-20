import React from "react";
import { setSearchParam } from "../lib/routing";

/**
 * IPC Footer — SVG logo mark + SVG contact icons + verified contact data.
 */
function Footer() {
  // Reusable tiny SVG icons for contact items
  const PhoneIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.54 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
  const FaxIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <polyline points="22 17 17 17 17 22" />
      <polyline points="2 7 7 7 7 2" />
      <path d="M2 17l5 5L22 7" />
      <line x1="7" y1="7" x2="7" y2="17" />
      <line x1="17" y1="7" x2="17" y2="17" />
    </svg>
  );
  const MailIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
  const PinIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
  const ClockIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005da3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );

  return (
    <footer style={{ background: "#0a2240", borderTop: "3px solid #00bef2" }}>
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand column — SVG logo mark */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/logo.svg"
                alt="IPC logo"
                width={44}
                height={44}
                style={{ flexShrink: 0, display: "block" }}
              />
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 13,
                    color: "#ffffff",
                    letterSpacing: "0.01em",
                  }}
                >
                  INSULATION PRODUCTS CORPORATION
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "#119ec8", letterSpacing: "0.08em" }}
                >
                  ESTABLISHED 1974 · ISO 9001 · RoHS COMPLIANT
                </div>
              </div>
            </div>
            <p
              className="text-xs leading-relaxed max-w-xs"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              A spec-grade stocking distributor of heat-shrinkable &amp;
              extruded tubing, electrical sleeving, and industrial adhesives.
              $50 minimum order. Quick, accurate, courteous service — the
              customer is always number one.
            </p>
          </div>

          {/* Contact column — SVG icons */}
          <div>
            <div
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "#119ec8" }}
            >
              Contact
            </div>
            <div
              className="space-y-2.5 text-xs"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              <div className="flex items-center gap-2">
                <PhoneIcon />
                <a href="tel:+16307710700" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>630.771.0700</a>
              </div>
              <div className="flex items-center gap-2">
                <FaxIcon />
                <a href="tel:+16307710701" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>630.771.0701 (Fax)</a>
              </div>
              <div className="flex items-center gap-2">
                <MailIcon />
                <a href="mailto:sales@insulationproducts.com" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>sales@insulationproducts.com</a>
              </div>
              <div className="flex items-start gap-2">
                <PinIcon />{" "}
                <span>
                  250 Gibraltar Dr
                  <br />
                  Bolingbrook, IL 60440
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon /> Mon–Fri, 8am–5pm CT
              </div>
            </div>
          </div>

          {/* Quick links — 2 columns of 4 inside, occupies 1 grid column on desktop */}
          <div>
            <div
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "#119ec8" }}
            >
              Quick Links
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px 24px",
              }}
            >
              {[
                { label: "Product Catalog", page: "products" },
                { label: "About IPC", page: "about" },
                { label: "Product Index", page: "dashboard" },
                { label: "Resources / FAQ", page: "faq" },
                { label: "Industries", page: "industries" },
                { label: "Contact", page: "contact" },
                { label: "Services", page: "services" },
                { label: "Privacy Policy", page: "privacy" },
              ].map((link) => (
                <div key={link.label}>
                  <button
                    onClick={() => setSearchParam("page", link.page)}
                    className="text-xs transition-colors duration-150 ipc-tap"
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "8px 0",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "#00bef2")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "rgba(255,255,255,0.45)")
                    }
                  >
                    {link.label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex flex-col md:flex-row items-center justify-between gap-2 pt-6"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            © 1974–{new Date().getFullYear()} Insulation Products Corporation.
            All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            insulationproducts.com · Bolingbrook, IL 60440
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
