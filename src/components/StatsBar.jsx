import React from "react";
import { STATS_ICONS } from "./icons/StatsIcons";
import { STATS_DATA } from "../lib/constants";

/**
 * IPC Trust & Proof rail — verified company stats with SVG icons.
 * Borders: right border via inline style per cell; bottom border via ipc-stat-bottom-border CSS class.
 * Fix 13: dead divide-x divide-gray-200 Tailwind classes removed (don't work on CSS grid, borders handled separately).
 */
function StatsBar() {
  return (
    <section className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4">
        {STATS_DATA.map((s, i) => (
          <div
            key={s.label}
            className={`py-5 px-4 md:py-7 md:px-6 flex items-center gap-4
              ${i < 2 ? "ipc-stat-bottom-border" : ""}
              ${i % 2 === 0 ? "border-r border-gray-200" : ""}
              ${i === 1 ? "md:border-r md:border-gray-200" : ""}
              ${i === 3 ? "border-r-0" : ""}
            `}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-lg bg-blue-50"
              style={{ width: 44, height: 44 }}
            >
              {STATS_ICONS[s.iconKey]}
            </div>
            <div>
              <div
                className="font-extrabold leading-tight"
                style={{ fontSize: 20, color: "#005da3" }}
              >
                {s.value}
              </div>
              <div
                className="text-xs font-semibold mt-0.5"
                style={{ color: "#141414" }}
              >
                {s.label}
              </div>
              <div className="text-xs mt-0.5 text-gray-400">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StatsBar;
