import React, { useState, useCallback } from "react";
import { setSearchParam } from "../lib/routing";

// Fix 7: ContactPage contact info at module level — SVG elements created once
const CONTACT_CARDS = [
  {
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.54 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
    title: "Phone",
    info: "630.771.0700",
    href: "tel:+16307710700",
    sub: "Mon–Fri, 8am–5pm CT",
  },
  {
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 17 17 17 17 22" />
        <polyline points="2 7 7 7 7 2" />
        <path d="M2 17l5 5L22 7" />
        <line x1="7" y1="7" x2="7" y2="17" />
        <line x1="17" y1="7" x2="17" y2="17" />
      </svg>
    ),
    title: "Fax",
    info: "630.771.0701",
    href: "tel:+16307710701",
    sub: "For POs & documentation",
  },
  {
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    title: "Email",
    info: "sales@insulationproducts.com",
    href: "mailto:sales@insulationproducts.com",
    sub: "Typical reply: same day",
  },
  {
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    title: "Address",
    info: "250 Gibraltar Dr",
    sub: "Bolingbrook, IL 60440",
  },
];

/**
 * IPC Contact page — Phase 5 overhaul.
 * Two-tab conversion architecture:
 *   Tab 1: "Request a Quote" — structured RFQ form (Part #, Material, Qty, Req Date, Specs)
 *   Tab 2: "Send a Message" — general inquiry form
 */
function ContactPage() {
  const [activeTab, setActiveTab] = useState("rfq");
  const [submitted, setSubmitted] = useState(false);
  const [submittedTab, setSubmittedTab] = useState("rfq");
  const [submitting, setSubmitting] = useState(false); // Animation 8: button loading state

  // H-4 fix: stable handler factory — useCallback prevents new function refs every render
  const makeOnChange = useCallback(
    (setter) => (e) =>
      setter((prev) => ({ ...prev, [e.target.name]: e.target.value })),
    [],
  );

  // General message form state
  const [msgForm, setMsgForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    subject: "",
    message: "",
  });
  const onMsgChange = makeOnChange(setMsgForm);
  const onMsgSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = new FormData(e.target);
      body.append("form_type", "message");
      const res  = await fetch("/contact.php", { method: "POST", body });
      const json = await res.json().catch(() => ({ ok: false, error: "Unexpected server response." }));
      if (json.ok) {
        setSubmittedTab("message");
        setSubmitted(true);
      } else {
        alert(json.error || "Submission failed. Please call 630.771.0700.");
      }
    } catch {
      alert("Network error. Please call 630.771.0700 or email sales@insulationproducts.com directly.");
    } finally {
      setSubmitting(false);
    }
  };

  // RFQ form state
  const [rfqForm, setRfqForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    partNumber: "",
    material: "",
    quantity: "",
    requiredDate: "",
    specialReqs: "",
    additionalNotes: "",
  });
  const onRfqChange = makeOnChange(setRfqForm);
  const onRfqSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = new FormData(e.target);
      body.append("form_type", "rfq");
      const res  = await fetch("/contact.php", { method: "POST", body });
      const json = await res.json().catch(() => ({ ok: false, error: "Unexpected server response." }));
      if (json.ok) {
        setSubmittedTab("rfq");
        setSubmitted(true);
      } else {
        alert(json.error || "Submission failed. Please call 630.771.0700.");
      }
    } catch {
      alert("Network error. Please call 630.771.0700 or email sales@insulationproducts.com directly.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 16,
    border: "1px solid #d1d9e0",
    color: "#141414",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  };
  const focusStyle = (e) => {
    e.target.style.borderColor = "#005da3";
    e.target.style.boxShadow = "0 0 0 3px rgba(0,93,163,0.1)";
  };
  const blurStyle = (e) => {
    e.target.style.borderColor = "#d1d9e0";
    e.target.style.boxShadow = "none";
  };

  // Fix 7: contactCards at module level (CONTACT_CARDS)
  const contactCards = CONTACT_CARDS;

  if (submitted) {
    return (
      <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
        <div className="ipc-page-header">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h1
              className="text-4xl font-extrabold"
              style={{ color: "#ffffff" }}
            >
              {submittedTab === "rfq"
                ? "Quote Request Received"
                : "Message Received"}
            </h1>
          </div>
        </div>
        <div className="ipc-fade-up max-w-lg mx-auto px-6 py-24 text-center">
          <div className="ipc-fade-up text-5xl mb-6">✅</div>
          <h2
            className="ipc-fade-up-1 text-2xl font-bold mb-3"
            style={{ color: "#141414" }}
          >
            Thank you!
          </h2>
          <p
            className="ipc-fade-up-2 text-sm mb-4"
            style={{ color: "#4b5563" }}
          >
            {submittedTab === "rfq"
              ? "Your quote request has been received. Our sales team will review the details and respond within one business day — often the same day for in-stock items."
              : "Your message has been received. Our sales team will respond within one business day."}
          </p>
          <p
            className="ipc-fade-up-2 text-xs mb-8"
            style={{ color: "#9ca3af" }}
          >
            For urgent inquiries:{" "}
            📞 <a href="tel:+16307710700" style={{ color: "#9ca3af" }}>630.771.0700</a>
            {" · "}
            📠 <a href="tel:+16307710701" style={{ color: "#9ca3af" }}>630.771.0701</a>
            {" · "}
            📧 <a href="mailto:sales@insulationproducts.com" style={{ color: "#9ca3af" }}>sales@insulationproducts.com</a>
          </p>
          <div className="ipc-fade-up-3 flex gap-3 justify-center">
            <button
              className="text-sm font-semibold px-5 py-2.5 rounded hover:brightness-110 transition-all"
              style={{
                background: "#005da3",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => {
                setSubmitted(false);
                setRfqForm({
                  name: "",
                  email: "",
                  phone: "",
                  company: "",
                  partNumber: "",
                  material: "",
                  quantity: "",
                  requiredDate: "",
                  specialReqs: "",
                  additionalNotes: "",
                });
                setMsgForm({
                  name: "",
                  email: "",
                  phone: "",
                  company: "",
                  subject: "",
                  message: "",
                });
              }}
            >
              Submit Another
            </button>
            <button
              onClick={() => setSearchParam("page", "products")}
              className="text-sm font-medium px-5 py-2.5 rounded transition-all"
              style={{
                background: "transparent",
                color: "#005da3",
                border: "1px solid #005da3",
                cursor: "pointer",
              }}
            >
              Browse Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Contact
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            Get in Touch
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Ready to order, need a quote, or have a technical question? Our
            sales team responds quickly and accurately.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left sidebar — contact cards + tips */}
        <div className="space-y-4">
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "#005da3" }}
          >
            Direct Contact
          </h2>
          {contactCards.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-xl p-4 flex gap-3 items-start"
              style={{ border: "1px solid #e5e9ee" }}
            >
              <span
                className="flex items-center justify-center rounded-lg text-sm flex-shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: "rgba(0,93,163,0.07)",
                  color: "#005da3",
                }}
              >
                {item.icon}
              </span>
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-wide mb-0.5"
                  style={{ color: "#6b7280" }}
                >
                  {item.title}
                </div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: "#141414" }}
                >
                  {item.href ? (
                    <a href={item.href} style={{ color: "#141414", textDecoration: "none" }}
                       onMouseEnter={e => e.currentTarget.style.color = "#005da3"}
                       onMouseLeave={e => e.currentTarget.style.color = "#141414"}>
                      {item.info}
                    </a>
                  ) : item.info}
                </div>
                <div className="text-xs" style={{ color: "#9ca3af" }}>
                  {item.sub}
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-xl p-5" style={{ background: "#0d2d52" }}>
            <div className="text-xs font-bold text-white mb-3 uppercase tracking-wide">
              For fastest response, include:
            </div>
            <ul className="space-y-1.5">
              {[
                "IPC part number or description",
                "Material type and size needed",
                "Quantity required",
                "Required delivery date",
                "Any special specs or certifications",
              ].map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2 text-xs"
                  style={{ color: "rgba(255,255,255,0.60)" }}
                >
                  <span
                    style={{ color: "#00bef2", marginTop: 1, flexShrink: 0 }}
                  >
                    →
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right — tabbed forms */}
        <div className="lg:col-span-2">
          {/* Tab switcher — clear active/inactive contrast */}
          <div
            className="flex flex-col sm:flex-row mb-6 rounded-xl overflow-hidden"
            style={{
              border: "1px solid #d1d9e0",
              boxShadow: "0 1px 4px rgba(0,93,163,0.06)",
            }}
          >
            {[
              {
                id: "rfq",
                label: "📋  Request a Quote",
                sub: "Structured RFQ — fastest for orders",
              },
              {
                id: "message",
                label: "✉️  Send a Message",
                sub: "General inquiries & questions",
              },
            ].map((tab, i) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={active}
                  className="border-b sm:border-b-0 sm:border-r border-gray-200 last:border-b-0 sm:last:border-r-0"
                  style={{
                    flex: 1,
                    padding: "18px 22px",
                    textAlign: "left",
                    cursor: "pointer",
                    background: active ? "#005da3" : "#f5f7fa",
                    borderTop: active
                      ? "3px solid #00bef2"
                      : "3px solid transparent",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "#eef1f5";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "#f5f7fa";
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: active ? "#ffffff" : "#141414",
                    }}
                  >
                    {tab.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 3,
                      color: active ? "rgba(255,255,255,0.70)" : "#6b7280",
                    }}
                  >
                    {tab.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tab 1 — RFQ form */}
          {activeTab === "rfq" && (
            <form
              onSubmit={onRfqSubmit}
              className="bg-white rounded-2xl p-5 sm:p-8 space-y-5"
              style={{
                border: "1px solid #e5e9ee",
                boxShadow: "0 4px 24px rgba(0,93,163,0.07)",
              }}
            >
              {/* Honeypot — hidden from humans, bots fill it in */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="rfq-website">Website</label>
                <input type="text" id="rfq-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <div>
                <div
                  className="text-base font-bold mb-1"
                  style={{ color: "#141414" }}
                >
                  Request a Quote
                </div>
                <div className="text-xs" style={{ color: "#9ca3af" }}>
                  Fill in as much as you know — our team will clarify anything
                  needed.
                </div>
              </div>

              {/* Contact details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    label: "Full Name *",
                    name: "name",
                    type: "text",
                    placeholder: "Your name",
                    required: true,
                    autoComplete: "name",
                  },
                  {
                    label: "Email *",
                    name: "email",
                    type: "email",
                    placeholder: "you@company.com",
                    required: true,
                    autoComplete: "email",
                  },
                  {
                    label: "Phone",
                    name: "phone",
                    type: "tel",
                    placeholder: "Optional",
                    required: false,
                    autoComplete: "tel",
                  },
                  {
                    label: "Company",
                    name: "company",
                    type: "text",
                    placeholder: "Your organization",
                    required: false,
                    autoComplete: "organization",
                  },
                ].map((f) => (
                  <div key={f.name}>
                    <label
                      className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                      style={{ color: "#6b7280" }}
                    >
                      {f.label}
                    </label>
                    <input
                      type={f.type}
                      name={f.name}
                      value={rfqForm[f.name]}
                      onChange={onRfqChange}
                      required={f.required}
                      placeholder={f.placeholder}
                      autoComplete={f.autoComplete}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "#e5e9ee" }} />

              {/* Product details */}
              <div
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: "#005da3" }}
              >
                Product Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    Part Number / SKU
                  </label>
                  <input
                    type="text"
                    name="partNumber"
                    value={rfqForm.partNumber}
                    onChange={onRfqChange}
                    placeholder="e.g. IP35KY, IP33PO, or description"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    Material / Type
                  </label>
                  <input
                    type="text"
                    name="material"
                    value={rfqForm.material}
                    onChange={onRfqChange}
                    placeholder="e.g. Polyolefin 2:1, PVDF, Fiberglass"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    Quantity Required *
                  </label>
                  <input
                    type="text"
                    name="quantity"
                    value={rfqForm.quantity}
                    onChange={onRfqChange}
                    required
                    placeholder="e.g. 500 ft, 1000 pcs, 10 spools"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                    style={{ color: "#6b7280" }}
                  >
                    Required Delivery Date
                  </label>
                  <input
                    type="text"
                    name="requiredDate"
                    value={rfqForm.requiredDate}
                    onChange={onRfqChange}
                    placeholder="e.g. ASAP, end of month, 6/30/2025"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  Special Requirements
                </label>
                <input
                  type="text"
                  name="specialReqs"
                  value={rfqForm.specialReqs}
                  onChange={onRfqChange}
                  placeholder="e.g. C of C required, PPAP, custom marking, specific color, certifications needed"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  Additional Notes
                </label>
                <textarea
                  name="additionalNotes"
                  value={rfqForm.additionalNotes}
                  onChange={onRfqChange}
                  rows={3}
                  placeholder="Any other details that will help us respond accurately…"
                  style={{ ...inputStyle, resize: "none" }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-lg font-semibold text-sm text-white transition-all hover:brightness-110"
                style={{
                  background: "#005da3",
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.85 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <span className="ipc-btn-spinner" />
                    Sending…
                  </>
                ) : (
                  "Submit Quote Request →"
                )}
              </button>
            </form>
          )}

          {/* Tab 2 — General message form */}
          {activeTab === "message" && (
            <form
              onSubmit={onMsgSubmit}
              className="bg-white rounded-2xl p-5 sm:p-8 space-y-5"
              style={{
                border: "1px solid #e5e9ee",
                boxShadow: "0 4px 24px rgba(0,93,163,0.07)",
              }}
            >
              {/* Honeypot — hidden from humans, bots fill it in */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="msg-website">Website</label>
                <input type="text" id="msg-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <div>
                <div
                  className="text-base font-bold mb-1"
                  style={{ color: "#141414" }}
                >
                  Send a Message
                </div>
                <div className="text-xs" style={{ color: "#9ca3af" }}>
                  For general questions, technical guidance, or anything that
                  doesn't fit the RFQ form.
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    label: "Full Name *",
                    name: "name",
                    type: "text",
                    placeholder: "Your name",
                    required: true,
                    autoComplete: "name",
                  },
                  {
                    label: "Email *",
                    name: "email",
                    type: "email",
                    placeholder: "you@company.com",
                    required: true,
                    autoComplete: "email",
                  },
                  {
                    label: "Phone",
                    name: "phone",
                    type: "tel",
                    placeholder: "Optional",
                    required: false,
                    autoComplete: "tel",
                  },
                  {
                    label: "Company",
                    name: "company",
                    type: "text",
                    placeholder: "Your organization",
                    required: false,
                    autoComplete: "organization",
                  },
                ].map((f) => (
                  <div key={f.name}>
                    <label
                      className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                      style={{ color: "#6b7280" }}
                    >
                      {f.label}
                    </label>
                    <input
                      type={f.type}
                      name={f.name}
                      value={msgForm[f.name]}
                      onChange={onMsgChange}
                      required={f.required}
                      placeholder={f.placeholder}
                      autoComplete={f.autoComplete}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  Subject *
                </label>
                <input
                  type="text"
                  name="subject"
                  value={msgForm.subject}
                  onChange={onMsgChange}
                  required
                  placeholder="What's this about?"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  Message *
                </label>
                <textarea
                  name="message"
                  value={msgForm.message}
                  onChange={onMsgChange}
                  required
                  rows={5}
                  placeholder="Include any relevant details — product type, application, quantities, certifications needed…"
                  style={{ ...inputStyle, resize: "none" }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-lg font-semibold text-sm text-white transition-all hover:brightness-110"
                style={{
                  background: "#005da3",
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.85 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <span className="ipc-btn-spinner" />
                    Sending…
                  </>
                ) : (
                  "Send Message →"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContactPage;
