import React from "react";

/** IPC capability card — used on About page. Avatar is an emoji in a styled circle. */
function TeamCard({ name, role, avatar }) {
  return (
    <div
      className="rounded-xl p-6 text-center transition-all duration-200"
      style={{
        border: "1px solid #e5e9ee",
        background: "#ffffff",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#005da3";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,93,163,0.10)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e5e9ee";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "none";
      }}
    >
      {/* Styled icon circle */}
      <div
        className="mx-auto mb-4 flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          background:
            "linear-gradient(135deg, rgba(0,93,163,0.10) 0%, rgba(0,190,242,0.15) 100%)",
          fontSize: 24,
          border: "1px solid rgba(0,93,163,0.15)",
        }}
      >
        {avatar}
      </div>
      <div className="text-sm font-bold mb-1" style={{ color: "#141414" }}>
        {name}
      </div>
      <div className="text-xs font-medium" style={{ color: "#119ec8" }}>
        {role}
      </div>
    </div>
  );
}

export default TeamCard;
