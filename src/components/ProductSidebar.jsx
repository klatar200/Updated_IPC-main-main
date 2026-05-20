import React, { useState, useMemo } from "react";
import { SIDEBAR_EXCLUDED, FAMILY_ORDER } from "../lib/constants";

/**
 * IPC Product selector sidebar — grouped by product family, collapsible sections.
 * Mobile: compact horizontal scrollable family pill strip + product select pill row.
 * Desktop: full left sidebar with collapsible family groups.
 */
function ProductSidebar({ products, selectedId, onSelect }) {
  const families = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      if (SIDEBAR_EXCLUDED.has(p.sku || "")) continue;
      const fam = p.partType || "Other";
      if (!map.has(fam)) map.set(fam, []);
      map.get(fam).push(p);
    }
    const ordered = new Map();
    for (const key of FAMILY_ORDER) {
      if (map.has(key)) ordered.set(key, map.get(key));
    }
    for (const [key, val] of map) {
      if (!ordered.has(key)) ordered.set(key, val);
    }
    return ordered;
  }, [products]);

  const [openFamilies, setOpenFamilies] = useState(
    () => new Set(FAMILY_ORDER.concat(["Other"])),
  );
  const [mobileFamily, setMobileFamily] = useState(null); // null = "All"

  const toggleFamily = (fam) => {
    setOpenFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(fam)) next.delete(fam);
      else next.add(fam);
      return next;
    });
  };

  // Products visible in mobile filtered view
  const mobileProducts = useMemo(() => {
    const all = [];
    for (const [fam, items] of families) {
      if (!mobileFamily || fam === mobileFamily) all.push(...items);
    }
    return all;
  }, [families, mobileFamily]);

  const familyList = useMemo(() => Array.from(families.keys()), [families]);

  return (
    <aside className="w-full lg:w-72 flex-shrink-0">
      {/* ── MOBILE VIEW: horizontal pill strip + product grid ── */}
      <div className="lg:hidden mb-4">
        {/* Family filter pills — horizontal scroll */}
        <div
          className="ipc-scroll-sm"
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              paddingBottom: 4,
              minWidth: "max-content",
            }}
          >
            <button
              onClick={() => setMobileFamily(null)}
              className="ipc-tap"
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: !mobileFamily ? "#005da3" : "#ffffff",
                color: !mobileFamily ? "#ffffff" : "#4b5563",
                border: !mobileFamily ? "none" : "1px solid #d1d9e0",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              All (
              {
                products.filter((p) => !SIDEBAR_EXCLUDED.has(p.sku || ""))
                  .length
              }
              )
            </button>
            {familyList.map((fam) => {
              const active = mobileFamily === fam;
              return (
                <button
                  key={fam}
                  onClick={() => setMobileFamily(active ? null : fam)}
                  className="ipc-tap"
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    background: active ? "#005da3" : "#ffffff",
                    color: active ? "#ffffff" : "#4b5563",
                    border: active ? "none" : "1px solid #d1d9e0",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fam} ({families.get(fam)?.length || 0})
                </button>
              );
            })}
          </div>
        </div>

        {/* Product pills — 2-column grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            marginTop: 10,
          }}
        >
          {mobileProducts.map((p, i) => {
            const active = p.id === selectedId;
            return (
              <button
                key={`${p.sku || p.id}-${i}`}
                onClick={() => onSelect(p.id)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  minHeight: 44,
                  borderRadius: 8,
                  background: active ? "#005da3" : "#ffffff",
                  border: active ? "none" : "1px solid #e5e9ee",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: active ? "rgba(255,255,255,0.7)" : "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 2,
                  }}
                >
                  {p.sku}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: active ? "#ffffff" : "#141414",
                    lineHeight: 1.3,
                  }}
                >
                  {p.name && p.name.length > 32
                    ? p.name.slice(0, 32) + "…"
                    : p.name || p.sku}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── DESKTOP VIEW: full left sidebar ── */}
      <div
        className="ipc-scroll-sm hidden lg:block sticky top-20 rounded-xl overflow-hidden"
        style={{
          border: "1px solid #e5e9ee",
          boxShadow: "0 1px 4px rgba(0,93,163,0.06)",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 sticky top-0 z-10"
          style={{ background: "#0d2d52", borderBottom: "2px solid #00bef2" }}
        >
          <div
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "#119ec8" }}
          >
            Product Catalog
          </div>
          <div className="text-sm font-semibold text-white mt-0.5">
            {products.filter((p) => !SIDEBAR_EXCLUDED.has(p.sku || "")).length}{" "}
            products
          </div>
        </div>

        <div className="bg-white">
          {Array.from(families.entries()).map(([family, items]) => {
            const isOpen = openFamilies.has(family);
            const hasActive = items.some((p) => p.id === selectedId);
            return (
              <div key={family}>
                <button
                  onClick={() => toggleFamily(family)}
                  className="w-full flex items-center justify-between px-5 py-2.5 text-left"
                  style={{
                    background: hasActive ? "rgba(0,93,163,0.04)" : "#f8fafc",
                    border: "none",
                    borderBottom: "1px solid #e5e9ee",
                    borderTop: "1px solid #e5e9ee",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: hasActive ? "#005da3" : "#9ca3af" }}
                  >
                    {family}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(0,93,163,0.1)",
                        color: "#005da3",
                      }}
                    >
                      {items.length}
                    </span>
                    <span
                      style={{
                        color: "#9ca3af",
                        fontSize: 10,
                        transform: isOpen ? "rotate(180deg)" : "none",
                        display: "inline-block",
                        transition: "transform 0.15s",
                      }}
                    >
                      ▼
                    </span>
                  </span>
                </button>

                {isOpen &&
                  items.map((p) => {
                    const active = p.id === selectedId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => onSelect(p.id)}
                        className="w-full text-left px-5 py-3 transition-all duration-150 block"
                        style={{
                          background: active
                            ? "rgba(0,93,163,0.05)"
                            : "#ffffff",
                          borderLeft: active
                            ? "3px solid #005da3"
                            : "3px solid transparent",
                          border: "none",
                          borderBottom: "1px solid #f0f3f7",
                          cursor: "pointer",
                          width: "100%",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          if (!active)
                            e.currentTarget.style.background =
                              "rgba(0,93,163,0.02)";
                        }}
                        onMouseLeave={(e) => {
                          if (!active)
                            e.currentTarget.style.background = "#ffffff";
                        }}
                      >
                        <div
                          className="text-xs font-bold mb-0.5 uppercase tracking-wide"
                          style={{ color: active ? "#005da3" : "#c4cbd4" }}
                        >
                          {p.sku}
                        </div>
                        <div
                          className="text-xs font-semibold leading-snug"
                          style={{ color: active ? "#141414" : "#4b5563" }}
                        >
                          {p.name && p.name.length > 38
                            ? p.name.slice(0, 38) + "…"
                            : p.name || p.sku}
                        </div>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export default ProductSidebar;
