import React, { useState, useEffect, useMemo } from "react";
import { SIDEBAR_EXCLUDED, DASHBOARD_COLS } from "../lib/constants";
import { useSearchParam, setSearchParams } from "../lib/routing";

/**
 * IPC Product Dashboard — dark header, authority table with search, sort, and "View Product" CTA.
 * Accepts the live products array as a prop; derives table rows dynamically.
 */
function DashboardPage({ products }) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("partId");
  const [sortDir, setSortDir] = useState("asc");

  // Read ?family= URL param so clicking a category in the navbar pre-selects the filter pill.
  // Clear the param from the URL after reading so it doesn't persist on manual filter changes.
  const [familyParam, setFamilyParam] = useSearchParam("family");
  const [activeFamily, setActiveFamily] = useState(() => familyParam || "All");
  // Re-run whenever familyParam changes so navbar category clicks work on subsequent navigations
  useEffect(() => {
    if (familyParam) {
      setActiveFamily(familyParam);
      setFamilyParam(null); // clean up URL param after reading
    }
  }, [familyParam]);

  // HOISTING FIX: tableRows must be defined BEFORE families useMemo.
  // C3 fix: memoized. P7 fix: reuses SIDEBAR_EXCLUDED (module-level) — single source of truth.
  // SIDEBAR_EXCLUDED is defined at module level above ProductSidebar.
  const tableRows = useMemo(
    () =>
      products
        .filter((p) => !SIDEBAR_EXCLUDED.has(p.sku || ""))
        .map((p) => {
          const descFull = Array.isArray(p.description)
            ? p.description.join(" ")
            : String(p.description || "");
          const descShort =
            descFull.length > 110 ? descFull.slice(0, 110) + "…" : descFull;
          return {
            name: p.name || "",
            partId: p.sku || p.id || "",
            partType: p.partType || "",
            descShort,
            descFull,
            operatingTemp: p.operatingTemp || "",
            specs: p.specificationsSummary || "",
            productId: p.id || p.sku || "",
          };
        }),
    [products],
  ); // only recompute when the catalog changes

  // Build unique family list — now correctly reads tableRows (already defined above)
  const families = useMemo(() => {
    const counts = {};
    for (const row of tableRows) {
      const f = row.partType || "Other";
      counts[f] = (counts[f] || 0) + 1;
    }
    return [
      { label: "All", count: tableRows.length },
      ...Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count })),
    ];
  }, [tableRows]); // tableRows is already memoized on products — no double-dependency

  const filtered = tableRows
    .filter((row) => {
      if (activeFamily !== "All" && row.partType !== activeFamily) return false;
      const q = search.toLowerCase();
      return (
        row.partId.toLowerCase().includes(q) ||
        row.partType.toLowerCase().includes(q) ||
        row.descFull.toLowerCase().includes(q) ||
        row.operatingTemp.toLowerCase().includes(q) ||
        row.specs.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const key =
        sortCol === "description"
          ? "descFull"
          : sortCol === "specifications"
            ? "specs"
            : sortCol;
      // Strip parenthetical suffixes from name before comparing so compound products sort naturally
      const normalize = (v) =>
        key === "name" ? v.replace(/\s*\(.*$/, "").trim() : v;
      const av = normalize(a[key] || ""),
        bv = normalize(b[key] || "");
      return sortDir === "asc"
        ? av.localeCompare(bv, undefined, { sensitivity: "base" })
        : bv.localeCompare(av, undefined, { sensitivity: "base" });
    });

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const handleViewProduct = (productId) => {
    setSearchParams({ productId, page: "products" });
  };

  // Fix 8: cols references DASHBOARD_COLS (module-level) — not recreated on every keystroke
  const cols = DASHBOARD_COLS;

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div className="ipc-page-header">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Product Index
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#ffffff" }}>
            Product Index
          </h1>
          <p
            className="mt-3 max-w-2xl text-base"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Browse all {tableRows.length} products with key specifications.
            Click <strong className="text-white">View Product</strong> for full
            data sheets and quote requests.
          </p>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1280,
          marginLeft: "auto",
          marginRight: "auto",
          padding: "2.5rem 24px",
        }}
      >
        {/* Category filter — dropdown on mobile, pill strip on desktop */}

        {/* Mobile: collapsible filters panel */}
        <details className="sm:hidden mb-5">
          <summary
            style={{
              cursor: 'pointer',
              padding: '12px 14px',
              background: '#ffffff',
              border: '1px solid #d1d9e0',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#141414',
              listStyle: 'none',
            }}
          >
            Filters{activeFamily !== 'All' ? ` · ${activeFamily}` : ''}
            {search ? ` · "${search}"` : ''}
          </summary>
          <div style={{ marginTop: 12 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#6b7280",
                marginBottom: 6,
              }}
            >
              Filter by Category
            </label>
            <div style={{ position: "relative" }}>
              <select
                value={activeFamily}
                onChange={(e) => {
                  setActiveFamily(e.target.value);
                  setSearch("");
                }}
                style={{
                  width: "100%",
                  appearance: "none",
                  WebkitAppearance: "none",
                  padding: "11px 40px 11px 14px",
                  borderRadius: 8,
                  border:
                    activeFamily !== "All"
                      ? "2px solid #005da3"
                      : "1px solid #d1d9e0",
                  background: "#ffffff",
                  color: "#141414",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {families.map(({ label, count }) => (
                  <option key={label} value={label}>
                    {label === "All"
                      ? `All Products (${count})`
                      : `${label} (${count})`}
                  </option>
                ))}
              </select>
              {/* Custom chevron */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#005da3"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {activeFamily !== "All" && (
              <button
                onClick={() => setActiveFamily("All")}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#005da3",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ✕ Clear filter
              </button>
            )}
            {/* Mobile search input — inside the collapsible panel */}
            <div style={{ position: "relative", marginTop: 12 }}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: "absolute",
                  left: 13,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  flexShrink: 0,
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by part ID, type, or description…"
                aria-label="Search products"
                className="w-full rounded-lg outline-none transition-all duration-200"
                style={{
                  border: "1px solid #d1d9e0",
                  background: "#ffffff",
                  color: "#141414",
                  padding: "10px 16px 10px 40px",
                  fontSize: 16,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#005da3";
                  e.target.style.boxShadow = "0 0 0 3px rgba(0,93,163,0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#d1d9e0";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>
        </details>

        {/* Desktop (sm+): wrapping pill strip */}
        <div
          className="hidden sm:flex mb-6"
          style={{
            flexWrap: "wrap",
            gap: 8,
            paddingBottom: 12,
            borderBottom: "1px solid #e5e9ee",
          }}
        >
          {families.map(({ label, count }) => {
            const active = activeFamily === label;
            return (
              <button
                key={label}
                onClick={() => {
                  setActiveFamily(label);
                  setSearch("");
                }}
                className="ipc-tap"
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: active ? "2px solid #005da3" : "1px solid #d1d9e0",
                  background: active ? "#005da3" : "#ffffff",
                  color: active ? "#ffffff" : "#4b5563",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "#005da3";
                    e.currentTarget.style.color = "#005da3";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "#d1d9e0";
                    e.currentTarget.style.color = "#4b5563";
                  }
                }}
              >
                {label}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 10,
                    background: active
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(0,93,163,0.08)",
                    color: active ? "#ffffff" : "#005da3",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-semibold"
              style={{ color: "#141414" }}
            >
              {filtered.length} of {tableRows.length} products
            </span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: "rgba(0,93,163,0.1)",
                  color: "#005da3",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                filtered ✕
              </button>
            )}
          </div>
          <div className="hidden sm:block relative sm:w-80">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: "absolute",
                left: 13,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                flexShrink: 0,
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by part ID, type, or description…"
              aria-label="Search products"
              className="w-full rounded-lg outline-none transition-all duration-200"
              style={{
                border: "1px solid #d1d9e0",
                background: "#ffffff",
                color: "#141414",
                padding: "10px 16px 10px 40px",
                fontSize: 16,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#005da3";
                e.target.style.boxShadow = "0 0 0 3px rgba(0,93,163,0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d1d9e0";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
        </div>

        {/* Mobile-only card list — replaces the table below 640px */}
        <div className="sm:hidden space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
              {tableRows.length === 0
                ? 'Loading catalog…'
                : `No results${search ? ` for "${search}"` : ''}${activeFamily !== 'All' ? ` in ${activeFamily}` : ''}.`}
            </div>
          ) : (
            filtered.map((row) => (
              <div
                key={row.productId}
                style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  border: '1px solid #e5e9ee',
                  padding: 16,
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#005da3', letterSpacing: '0.04em' }}>
                      {row.partId}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#141414', marginTop: 2, lineHeight: 1.3 }}>
                      {row.name}
                    </div>
                  </div>
                  {row.partType && (
                    <span
                      style={{
                        flexShrink: 0,
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: 'rgba(17,158,200,0.1)',
                        color: '#119ec8',
                      }}
                    >
                      {row.partType}
                    </span>
                  )}
                </div>
                {row.descShort && (
                  <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5, marginBottom: 10 }}>
                    {row.descShort}
                  </div>
                )}
                {row.operatingTemp && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
                    Operating temp: <span style={{ color: '#141414', fontWeight: 500 }}>{row.operatingTemp}</span>
                  </div>
                )}
                <button
                  onClick={() => handleViewProduct(row.productId)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    background: '#005da3',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  View Product →
                </button>
              </div>
            ))
          )}
        </div>

        {/* Table */}
        <div
          className="hidden sm:block rounded-xl overflow-hidden"
          style={{
            border: "1px solid #e5e9ee",
            boxShadow: "0 2px 12px rgba(0,93,163,0.07)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: "#0d2d52" }}>
                  {cols.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: "13px 18px",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color:
                          sortCol === col.key
                            ? "#00bef2"
                            : "rgba(255,255,255,0.65)",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        userSelect: "none",
                        width: col.width || undefined,
                        borderBottom: "2px solid #005da3",
                      }}
                    >
                      {col.label}{" "}
                      <span style={{ fontSize: 9 }}>
                        {sortCol === col.key
                          ? sortDir === "asc"
                            ? "▲"
                            : "▼"
                          : "⇅"}
                      </span>
                    </th>
                  ))}
                  <th
                    style={{
                      padding: "13px 18px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "rgba(255,255,255,0.65)",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      borderBottom: "2px solid #005da3",
                      width: 130,
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ padding: "56px 24px", background: "#ffffff" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 12,
                          maxWidth: 320,
                          margin: "0 auto",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 12,
                            background: "rgba(0,93,163,0.07)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="26"
                            height="26"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#005da3"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#141414",
                          }}
                        >
                          {tableRows.length === 0
                            ? "Loading catalog…"
                            : "No products found"}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#6b7280",
                            lineHeight: 1.5,
                          }}
                        >
                          {tableRows.length === 0
                            ? "Please wait while the product catalog loads."
                            : `No results${search ? ` for "${search}"` : ""}${activeFamily !== "All" ? ` in ${activeFamily}` : ""}. Try a different search term or clear the category filter.`}
                        </div>
                        {(search || activeFamily !== "All") && (
                          <button
                            onClick={() => {
                              setSearch("");
                              setActiveFamily("All");
                            }}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#005da3",
                              background: "rgba(0,93,163,0.07)",
                              border: "1px solid rgba(0,93,163,0.2)",
                              cursor: "pointer",
                              padding: "7px 16px",
                              borderRadius: 6,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "rgba(0,93,163,0.12)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                "rgba(0,93,163,0.07)";
                            }}
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, ri) => (
                    <tr
                      key={row.productId}
                      style={{
                        background: ri % 2 === 0 ? "#ffffff" : "#fafbfc",
                        borderBottom: "1px solid #e5e9ee",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,93,163,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          ri % 2 === 0 ? "#ffffff" : "#fafbfc";
                      }}
                    >
                      {/* Product Name */}
                      <td
                        style={{
                          padding: "13px 18px",
                          maxWidth: 260,
                          lineHeight: 1.4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#141414",
                          }}
                        >
                          {row.name}
                        </span>
                      </td>
                      {/* Part ID */}
                      <td
                        style={{ padding: "13px 18px", whiteSpace: "nowrap" }}
                      >
                        <span style={{ fontWeight: 700, color: "#005da3" }}>
                          {row.partId}
                        </span>
                      </td>
                      {/* Part Type */}
                      <td
                        style={{ padding: "13px 18px", whiteSpace: "nowrap" }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            background: "rgba(17,158,200,0.1)",
                            color: "#119ec8",
                          }}
                        >
                          {row.partType || "—"}
                        </span>
                      </td>
                      {/* Description — truncated to 110 chars, full text on hover */}
                      <td
                        style={{
                          padding: "13px 18px",
                          color: "#4b5563",
                          lineHeight: 1.5,
                          maxWidth: 280,
                        }}
                      >
                        <span title={row.descFull}>{row.descShort || "—"}</span>
                      </td>
                      {/* Operating Temp */}
                      <td
                        style={{
                          padding: "13px 18px",
                          color: "#141414",
                          fontWeight: 500,
                          maxWidth: 110,
                          lineHeight: 1.4,
                        }}
                      >
                        {row.operatingTemp || "—"}
                      </td>
                      {/* Specifications */}
                      <td
                        style={{
                          padding: "13px 18px",
                          color: "#6b7280",
                          fontSize: 12,
                          lineHeight: 1.5,
                          maxWidth: 240,
                        }}
                      >
                        {row.specs
                          ? row.specs.length > 90
                            ? row.specs.slice(0, 90) + "…"
                            : row.specs
                          : "—"}
                      </td>
                      {/* Action button */}
                      <td
                        style={{
                          padding: "13px 18px",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <button
                          onClick={() => handleViewProduct(row.productId)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "7px 16px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#005da3",
                            color: "#ffffff",
                            border: "none",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#004e8c";
                            const a =
                              e.currentTarget.querySelector(".ipc-btn-arrow");
                            if (a) a.style.transform = "translateX(4px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#005da3";
                            const a =
                              e.currentTarget.querySelector(".ipc-btn-arrow");
                            if (a) a.style.transform = "translateX(0)";
                          }}
                        >
                          View Product{" "}
                          <span
                            className="ipc-btn-arrow"
                            style={{
                              display: "inline-block",
                              transition: "transform 0.2s ease",
                            }}
                          >
                            →
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            textAlign: "right",
            fontSize: 11,
            color: "#9ca3af",
          }}
        >
          Showing {filtered.length} of {tableRows.length} products
          {search ? ` · filtered by "${search}"` : ""}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
