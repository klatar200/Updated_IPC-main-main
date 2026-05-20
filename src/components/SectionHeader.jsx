import React from "react";

/**
 * Reusable section header — consistent eyebrow + h2 + optional subtitle across all pages.
 * eyebrow: small all-caps label in #005da3
 * title: bold h2 in #141414
 * subtitle: optional muted paragraph
 * action: optional { label, onClick } for a right-aligned CTA button
 */
function SectionHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
      <div>
        {eyebrow && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#005da3",
              marginBottom: 8,
            }}
          >
            {eyebrow}
          </div>
        )}
        <h2
          style={{
            fontSize: "clamp(1.6rem, 3vw, 2rem)",
            fontWeight: 800,
            color: "#141414",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              marginTop: 10,
              fontSize: 14,
              color: "#6b7280",
              maxWidth: 520,
              lineHeight: 1.6,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="transition-colors duration-150 hover:bg-blue-700"
          style={{
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            background: "#005da3",
            border: "none",
            cursor: "pointer",
            padding: "10px 20px",
            borderRadius: 6,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default SectionHeader;
