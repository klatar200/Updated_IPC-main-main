import React from "react";

/**
 * IPC product/service capability card — JS-driven hover for border/shadow transitions.
 * Inline styles take CSS specificity priority over Tailwind, so border and boxShadow
 * are driven by onMouseEnter/Leave handlers. Inner text uses .fc-title class for
 * JS-driven color transition. The icon background uses .fc-icon class similarly.
 */
function FeatureCard({ icon, title, description, onClick }) {
  return (
    <div
      className="flex gap-5 p-6 rounded-xl cursor-pointer transition-all duration-200"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e9ee",
        boxShadow: "0 1px 4px rgba(0,93,163,0.05)",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#005da3";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,93,163,0.12)";
        e.currentTarget.style.transform = "translateY(-2px)";
        const iconEl = e.currentTarget.querySelector(".fc-icon");
        if (iconEl) {
          iconEl.style.background = "rgba(0,93,163,0.12)";
          iconEl.style.borderColor = "#005da3";
        }
        const titleEl = e.currentTarget.querySelector(".fc-title");
        if (titleEl) titleEl.style.color = "#004e8c";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e5e9ee";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,93,163,0.05)";
        e.currentTarget.style.transform = "";
        const iconEl = e.currentTarget.querySelector(".fc-icon");
        if (iconEl) {
          iconEl.style.background = "rgba(0,93,163,0.07)";
          iconEl.style.borderColor = "transparent";
        }
        const titleEl = e.currentTarget.querySelector(".fc-title");
        if (titleEl) titleEl.style.color = "#141414";
      }}
    >
      {/* Icon — JS-driven hover (inline styles win over Tailwind; no group-hover needed) */}
      <div
        className="fc-icon flex-shrink-0 flex items-center justify-center rounded-lg"
        style={{
          width: 48,
          height: 48,
          background: "rgba(0,93,163,0.07)",
          color: "#005da3",
          border: "1px solid transparent",
          transition: "background 0.2s, border-color 0.2s",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h3
          className="fc-title"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#141414",
            marginBottom: 6,
            lineHeight: 1.3,
            transition: "color 0.2s",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "#6b7280",
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

export default FeatureCard;
