import React from "react";

/** Right spec table — multi-column with optional colspan header grouping */
function SpecTable2({ table }) {
  const { columnSpans, rows: rawRows } = table;
  // Defensively guard both arrays against null/undefined from malformed catalog data
  const colSpans = Array.isArray(columnSpans) ? columnSpans : [];
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const hasSubHeaders = colSpans.some(
    (c) => c.colspan > 1 && Array.isArray(c.sub),
  );

  return (
    <div
      className="rounded-xl overflow-hidden h-full"
      style={{ border: "1px solid #e0e4e8" }}
    >
      <div style={{ overflowX: "auto" }}>
      <table className="w-full text-sm border-collapse" style={{ minWidth: 240 }}>
        <thead>
          {/* Top header row */}
          <tr>
            {colSpans.map((col, i) => (
              <th
                key={i}
                colSpan={col.colspan > 1 ? col.colspan : 1}
                rowSpan={col.colspan > 1 ? 1 : hasSubHeaders ? 2 : 1}
                className="px-3 py-3 text-center text-white whitespace-pre-line text-xs font-semibold leading-snug align-middle"
                style={{
                  background:
                    i === 0 ? "#005da3" : i % 2 === 0 ? "#119ec8" : "#005da3",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
          {/* Sub-header row — only rendered when colspan groups with sub-labels exist */}
          {hasSubHeaders && (
            <tr>
              {colSpans
                .filter((c) => c.colspan > 1 && Array.isArray(c.sub))
                .flatMap((c, gi) =>
                  c.sub.map((s, si) => (
                    <th
                      key={`${gi}-${si}`}
                      className="px-3 py-2 text-center text-white text-xs font-semibold"
                      style={{
                        background: "#119ec8",
                        border: "1px solid rgba(255,255,255,0.2)",
                      }}
                    >
                      {s}
                    </th>
                  )),
                )}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ background: ri % 2 === 0 ? "#ffffff" : "#f8fafc" }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2.5 text-center"
                  style={{
                    color: "#141414",
                    border: "1px solid #e8edf2",
                    fontWeight: ci === 0 ? 600 : 400,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default SpecTable2;
