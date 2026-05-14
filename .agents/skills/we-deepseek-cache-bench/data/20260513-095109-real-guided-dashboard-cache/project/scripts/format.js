// Northstar Ops Console — Formatting helpers

export const FMT = {
  currency(n) {
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  },

  pct(n) {
    if (n == null) return "—";
    return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  },

  pctPlain(n) { return n != null ? `${n.toFixed(1)}%` : "—"; },

  number(n) { return n != null ? n.toLocaleString() : "—"; },

  durationH(h) { return h != null ? `${h.toFixed(1)}h` : "—"; },

  durationM(m) { return m != null ? `${Math.round(m)}m` : "—"; },

  date(ts) { return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }); },

  datetime(ts) { return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); },

  shortDate(ts) { return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }); },

  tagClass(status) {
    const m = {
      healthy: "tag-healthy", at_risk: "tag-at-risk", churned: "tag-churned",
      sev0: "tag-sev0", sev1: "tag-sev1",
      critical: "tag-critical", high: "tag-high",
      running: "tag-running", in_progress: "tag-in-progress", open: "tag-open",
      completed: "tag-completed", resolved: "tag-resolved", closed: "tag-closed",
      rolled_back: "tag-rolled-back",
    };
    return m[status] || "";
  },

  barColor(val, max) {
    const pct = max > 0 ? val / max : 0;
    if (pct > 0.8) return "var(--red)";
    if (pct > 0.5) return "var(--amber)";
    return "var(--accent)";
  },

  riskColor(score) {
    if (score >= 8) return "var(--red)";
    if (score >= 5) return "var(--amber)";
    return "var(--green)";
  },
};
