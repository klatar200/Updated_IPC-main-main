import React from "react";

/** IPC Left spec table — dark header, clean row list */
function SpecTable1({ table }) {
  // #1 fix: guard against null/undefined rows — PHP admin may produce empty specTable1
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  const title = table?.title ?? "Specifications:";
  return (
    <div
      className="rounded-xl overflow-hidden h-full"
      style={{ border: "1px solid #e5e9ee" }}
    >
      <div
        className="px-4 py-3 text-center text-sm font-bold text-white uppercase tracking-wide"
        style={{ background: "#0d2d52", borderBottom: "2px solid #00bef2" }}
      >
        {title}
      </div>
      <div className="bg-white divide-y" style={{ borderColor: "#e5e9ee" }}>
        {rows.map((row, i) => (
          <div key={i} className="px-4 py-3 text-sm">
            {row.label && (
              <span className="font-semibold" style={{ color: "#005da3" }}>
                {row.label}{" "}
              </span>
            )}
            <span
              className="whitespace-pre-line"
              style={{ color: "#4b5563", fontSize: 12.5 }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SpecTable1;
