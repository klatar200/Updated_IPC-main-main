import React, { Component } from "react";

// ── Error boundary ────────────────────────────────────────────
// Catches render-time exceptions so a broken product record or bad JSON
// in specTable never blanks the entire site. Shows contact info instead.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { caught: false };
  }
  static getDerivedStateFromError() {
    return { caught: true };
  }
  render() {
    if (this.state.caught) {
      return (
        <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", background: "#f5f7fa" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#141414", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 400, marginBottom: 24 }}>
            An unexpected error occurred. Please refresh the page, or contact us directly.
          </p>
          <div style={{ fontSize: 14, color: "#005da3" }}>
            <a href="tel:+16307710700" style={{ color: "#005da3", display: "block", marginBottom: 6 }}>📞 630.771.0700</a>
            <a href="mailto:sales@insulationproducts.com" style={{ color: "#005da3" }}>📧 sales@insulationproducts.com</a>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 24, padding: "10px 24px", background: "#005da3", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
