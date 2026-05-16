// Revenue Command Center — Utilities

const Utils = {
  fmtCurrency(n) {
    if (n == null) return '$0';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n.toLocaleString('en-US');
  },

  fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  fmtDaysAgo(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return '1d ago';
    return days + 'd ago';
  },

  scoreClass(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  },

  riskLabel(level) {
    const map = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
    return map[level] || level;
  },

  domainLabel(domain) {
    const map = { renewals: 'Renewals', billing: 'Billing', support: 'Support', usage: 'Usage', incidents: 'Incidents' };
    return map[domain] || domain;
  },

  filterAccounts(riskProfiles, accounts, opts) {
    const { search, riskFilter, domainFilter } = opts;
    let filtered = riskProfiles.slice();

    if (riskFilter && riskFilter !== 'all') {
      filtered = filtered.filter(p => p.riskLevel === riskFilter);
    }
    if (domainFilter && domainFilter !== 'all') {
      filtered = filtered.filter(p => p.domains[domainFilter] > 0);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(p => {
        const acct = accounts.find(a => a.id === p.accountId);
        return acct && (acct.name.toLowerCase().includes(q) || acct.id.includes(q) || acct.csm.toLowerCase().includes(q));
      });
    }
    return filtered;
  },

  // Simulate an async data load (useful for demonstrating loading state)
  async simulateLoad(ms = 0) {
    if (ms > 0) await new Promise(r => setTimeout(r, ms));
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Utils };
}
