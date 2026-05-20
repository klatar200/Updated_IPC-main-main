import React from "react";

/**
 * Reusable Badge component — semantic label chip used across the app.
 * variant: "primary" (blue, default) | "success" (green) | "neutral" (gray)
 * Currently used: ServicesPage lead-time chips (primary).
 * Available for: admin panel status indicators, compliance labels, form feedback.
 */
function Badge({ children, variant = "primary" }) {
  const styles = {
    primary: { background: "rgba(0,93,163,0.09)", color: "#005da3" },
    success: { background: "rgba(22,101,52,0.09)", color: "#166534" },
    neutral: { background: "rgba(107,114,128,0.10)", color: "#6b7280" },
  };
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded"
      style={styles[variant] ?? styles.primary}
    >
      {children}
    </span>
  );
}

export default Badge;
