import React, { useState, useEffect, useRef } from "react";
import ProductSidebar from "../components/ProductSidebar";
import ProductDetail from "../components/ProductDetail";
import { useSearchParam, setSearchParam } from "../lib/routing";

/**
 * IPC Product page — dark page header + sidebar + detail view.
 * Sticky RFQ bar appears after scrolling past the product header.
 */
function ProductPage({ products }) {
  const [selectedId, setSelectedId] = useSearchParam("productId");
  // C4 fix: exact match first, then compound-SKU fuzzy match for navigation links
  // that use partial IDs (e.g. "IP71NS" from IndustriesPage → "IP71NS - IP72PS - IP73PP")
  const product = selectedId
    ? products.find((p) => p.id === selectedId || p.sku === selectedId) ||
      products.find(
        (p) =>
          (p.sku || "").includes(selectedId) ||
          selectedId.includes(p.sku || ""),
      ) ||
      products[0]
    : products[0];
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [pulseSkuBadge, setPulseSkuBadge] = useState(false);
  const prevShowRef = useRef(false);
  const headerRef = useRef(null);
  const detailRef = useRef(null);

  // Fix 3: use headerRef for dynamic threshold — adapts if page header height changes
  useEffect(() => {
    const handleScroll = () => {
      const threshold = (headerRef.current?.offsetHeight ?? 220) + 40;
      const nowVisible = window.scrollY > threshold;
      setShowStickyBar(nowVisible);
      // Pulse the SKU badge the moment the bar first slides into view
      if (nowVisible && !prevShowRef.current) {
        setPulseSkuBadge(true);
        setTimeout(() => setPulseSkuBadge(false), 900);
      }
      prevShowRef.current = nowVisible;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!product) {
    return (
      <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
        <div className="ipc-page-header">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h1
              className="text-4xl font-extrabold"
              style={{ color: "#ffffff" }}
            >
              Product Catalog
            </h1>
          </div>
        </div>
        <div
          className="max-w-7xl mx-auto px-6 py-16 text-center"
          style={{ color: "#6b7280" }}
        >
          No products found in catalog.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh", paddingBottom: showStickyBar ? 72 : 0, transition: 'padding-bottom 0.3s ease' }}>
      {/* Page header */}
      <div
        ref={headerRef}
        className="ipc-page-header"
        style={{ borderBottom: "none" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "#119ec8" }}
          >
            Products
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            Product Catalog
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Select a product to view full specifications, data sheet, and
            request a quote.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col lg:flex-row gap-8 items-start">
        <ProductSidebar
          products={products}
          selectedId={product.id}
          onSelect={(id) => {
            setSelectedId(id);
            setShowStickyBar(false);
            if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
              detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        />
        <div ref={detailRef} className="flex-1 min-w-0">
          <ProductDetail product={product} allProducts={products} />
        </div>
      </div>

      {/* Sticky RFQ bar — spring slide-in with slight overshoot */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: "#0d2d52",
          borderTop: "2px solid #00bef2",
          transform: showStickyBar ? "translateY(0)" : "translateY(110%)",
          /* Spring cubic-bezier: overshoots slightly then settles — more personality than ease */
          transition: showStickyBar
            ? "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)"
            : "transform 0.25s ease-in",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.35)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: current product name */}
          <div className="min-w-0 hidden sm:block">
            {/* SKU badge — pulses cyan on first appearance to draw the eye */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 1,
                color: pulseSkuBadge ? "#141414" : "#119ec8",
                background: pulseSkuBadge ? "#00bef2" : "transparent",
                padding: pulseSkuBadge ? "1px 6px" : "1px 0",
                borderRadius: 4,
                transition: "all 0.3s ease",
                display: "inline-block",
              }}
            >
              {product.sku}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#ffffff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 400,
              }}
            >
              {product.name}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            {product.pdfUrl ? (
              <a
                href={product.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ipc-tap"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 16px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.2)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.18)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
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
                Data Sheet
              </a>
            ) : null}
            <button
              onClick={() => setSearchParam("page", "contact")}
              className="ipc-tap"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 20px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                background: "#005da3",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#004e8c")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#005da3")
              }
            >
              Request a Quote →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductPage;
