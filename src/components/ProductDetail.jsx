import React, { useMemo, useEffect } from "react";
import SpecTable1 from "./SpecTable1";
import SpecTable2 from "./SpecTable2";
import { extractComplianceBadges } from "../lib/extractComplianceBadges";
import { NON_RELATABLE_TYPES } from "../lib/constants";
import { setSearchParam } from "../lib/routing";

/**
 * IPC Product detail view — authority layout matching catalog format.
 * Dark header bar, two-column body, compliance badge row, dual spec tables,
 * related products footer, PDF + quote CTAs.
 */
function ProductDetail({ product, allProducts }) {
  // product.pdfUrl is set by the PHP admin (upload-pdf.php → "/pdfs/<sku>.pdf").
  // When it's missing we render a "Request Data Sheet" button that routes to
  // the contact form instead — there is no external printable-page fallback.
  const hasPdfFile = Boolean(product.pdfUrl);
  const complianceBadges = extractComplianceBadges(product);

  // 2.4 — Related products: same partType, excluding current, up to 4
  // I3 fix + Fix 12: NON_RELATABLE_TYPES at module level — see const above ProductDetail
  const related = useMemo(() => {
    if (!allProducts || NON_RELATABLE_TYPES.has(product.partType || ""))
      return [];
    return allProducts
      .filter((p) => p.id !== product.id && p.partType === product.partType)
      .slice(0, 4);
  }, [product.id, product.partType, allProducts]);

  useEffect(() => {
    const el = document.createElement("script");
    el.id = "product-ld";
    el.type = "application/ld+json";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "sku": product.partNumber || product.id,
      "description": product.description || product.name,
      "brand": { "@type": "Brand", "name": "Insulation Products Corporation" },
      "manufacturer": { "@type": "Organization", "name": "Insulation Products Corporation", "url": "https://www.insulationproducts.com" },
    });
    document.head.appendChild(el);
    return () => { document.getElementById("product-ld")?.remove(); };
  }, [product.id, product.name, product.partNumber, product.description]);

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        border: "1px solid #e5e9ee",
        boxShadow: "0 4px 24px rgba(0,93,163,0.07)",
      }}
    >
      {/* Header — deep navy with product name, SKU, and action buttons */}
      <div
        style={{
          background: "linear-gradient(135deg, #0a2a52 0%, #005da3 100%)",
        }}
      >
        <div className="px-8 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div
              className="text-xs font-bold tracking-widest uppercase mb-1"
              style={{ color: "#119ec8" }}
            >
              Product Detail
            </div>
            <h2 className="text-xl font-extrabold text-white uppercase leading-tight">
              {product.name}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span
              className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide"
              style={{ background: "#005da3", color: "#ffffff" }}
            >
              {product.sku}
            </span>
            {hasPdfFile ? (
              <a
                href={product.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
                style={{
                  background: "#00bef2",
                  color: "#141414",
                  textDecoration: "none",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <polyline points="9 15 12 18 15 15" />
                </svg>
                Download PDF
              </a>
            ) : (
              <button
                onClick={() => setSearchParam("page", "contact")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
                style={{
                  background: "#00bef2",
                  color: "#141414",
                  border: "none",
                  cursor: "pointer",
                }}
                title="Data sheet not yet uploaded — contact us to request one"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
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
                Request Data Sheet
              </button>
            )}
            <button
              onClick={() => setSearchParam("page", "contact")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 hover:brightness-110"
              style={{
                background: "#005da3",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Request Quote
            </button>
          </div>
        </div>

        {/* 2.3 — Compliance badge chips row */}
        {complianceBadges.length > 0 && (
          <div className="px-8 pb-4">
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
              }}
            >
              Certifications &amp; Standards
            </div>
            <div className="flex flex-wrap gap-2">
              {complianceBadges.map((badge) => (
                <span
                  key={badge}
                  className="text-xs font-semibold px-2.5 py-1 rounded"
                  style={{
                    background: "rgba(0,190,242,0.15)",
                    color: "#00bef2",
                    border: "1px solid rgba(0,190,242,0.3)",
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Body — photo + badges/description */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-0"
        style={{ borderBottom: "1px solid #e5e9ee" }}
      >
        {/* Left — photo */}
        <div className="p-5 sm:p-8 border-b border-gray-200 md:border-b-0 md:border-r md:border-gray-200">
          {/* Product image — show real photo if available, branded placeholder if placehold.co */}
          {product.photoUrl && !product.photoUrl.includes("placehold.co") ? (
            <img
              src={product.photoUrl}
              alt={product.name}
              loading="lazy"
              className="w-full rounded-lg object-cover"
              style={{ border: "1px solid #e5e9ee", maxHeight: 260 }}
            />
          ) : (
            <div
              className="w-full rounded-lg flex flex-col items-center justify-center gap-4"
              style={{
                height: 220,
                background: "#0a2240",
                border: "1px solid #1a3a5c",
              }}
            >
              <img src="/logo.svg" alt="IPC logo" width={72} height={72} />
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#00bef2",
                    letterSpacing: "0.08em",
                  }}
                >
                  {product.sku}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 4,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Product Image Coming Soon
                </div>
              </div>
            </div>
          )}
          {product.caption && (
            <p
              className="mt-3 text-xs font-semibold"
              style={{ color: "#005da3" }}
            >
              {product.caption}
            </p>
          )}
        </div>

        {/* Right — feature badges + description */}
        <div className="p-5 sm:p-8">
          {product.badges && product.badges.length > 0 && (
            <div className="mb-5">
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#9ca3af",
                  marginBottom: 8,
                }}
              >
                Product Features
              </div>
              <div className="flex flex-wrap gap-2">
                {product.badges.map((b) => (
                  <span
                    key={b}
                    className="px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wide"
                    style={{
                      background: "rgba(0,93,163,0.08)",
                      color: "#005da3",
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            {(product.description || []).map((para, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed"
                style={{ color: "#4b5563" }}
              >
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Spec tables — two column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        <div className="p-5 sm:p-8 border-b border-gray-200 md:border-b-0 md:border-r md:border-gray-200">
          <SpecTable1 table={product.specTable1} />
        </div>
        <div className="p-5 sm:p-8">
          <SpecTable2 table={product.specTable2} />
        </div>
      </div>

      {/* 2.4 — Related Products */}
      {related.length > 0 && (
        <div
          className="p-8"
          style={{ borderTop: "1px solid #e5e9ee", background: "#f8fafc" }}
        >
          <div
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "#005da3" }}
          >
            Related Products — {product.partType}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {related.map((rp) => (
              <button
                key={rp.id}
                onClick={() => setSearchParam("productId", rp.id)}
                className="group text-left rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e9ee",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#005da3";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e9ee";
                }}
              >
                <div
                  className="text-xs font-bold uppercase mb-1 transition-colors duration-200 group-hover:text-blue-700"
                  style={{ color: "#005da3" }}
                >
                  {rp.sku}
                </div>
                <div
                  className="text-xs font-semibold leading-snug transition-colors duration-200 group-hover:text-blue-900"
                  style={{ color: "#141414" }}
                >
                  {rp.name && rp.name.length > 45
                    ? rp.name.slice(0, 45) + "…"
                    : rp.name || rp.sku}
                </div>
                <div
                  className="mt-2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-0.5"
                  style={{ color: "#00bef2" }}
                >
                  View{" "}
                  <span
                    style={{
                      display: "inline-block",
                      transition: "transform 0.2s ease",
                      transform: "translateX(0)",
                    }}
                    ref={(el) => {
                      if (el) {
                        el.closest("button")?.addEventListener(
                          "mouseenter",
                          () => (el.style.transform = "translateX(4px)"),
                        );
                        el.closest("button")?.addEventListener(
                          "mouseleave",
                          () => (el.style.transform = "translateX(0)"),
                        );
                      }
                    }}
                  >
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetail;
