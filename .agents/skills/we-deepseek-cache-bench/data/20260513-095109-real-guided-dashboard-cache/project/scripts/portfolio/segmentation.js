// Portfolio segmentation — slice accounts by health, plan, CSM, industry, renewal urgency.

const DAY = 86400000;
const NOW = Date.now();

export function segmentAccounts(accounts, fixtures) {
  const contracts = fixtures.contracts || {};
  const segData = fixtures.segments || {};

  const segments = {
    by_health: { healthy: [], at_risk: [], churned: [] },
    by_plan: {},
    by_csm: { unassigned: [] },
    by_industry: {},
    by_renewal_urgency: { imminent: [], this_quarter: [], next_quarter: [], distant: [] },
    by_segment: {},
  };

  for (const a of accounts) {
    // Health
    segments.by_health[a.health] = segments.by_health[a.health] || [];
    segments.by_health[a.health].push(a);

    // Plan
    segments.by_plan[a.plan] = segments.by_plan[a.plan] || [];
    segments.by_plan[a.plan].push(a);

    // CSM
    const contract = contracts[a.id];
    const csm = contract?.cs_owner || null;
    const csmKey = csm || "unassigned";
    segments.by_csm[csmKey] = segments.by_csm[csmKey] || [];
    segments.by_csm[csmKey].push(a);

    // Industry
    const ind = a.industry || "Unknown";
    segments.by_industry[ind] = segments.by_industry[ind] || [];
    segments.by_industry[ind].push(a);

    // Renewal urgency
    if (contract?.renewal_date && a.health !== "churned") {
      const daysLeft = (contract.renewal_date - NOW) / DAY;
      if (daysLeft <= 30) segments.by_renewal_urgency.imminent.push(a);
      else if (daysLeft <= 90) segments.by_renewal_urgency.this_quarter.push(a);
      else if (daysLeft <= 180) segments.by_renewal_urgency.next_quarter.push(a);
      else segments.by_renewal_urgency.distant.push(a);
    }

    // Biz segment
    const bizSeg = segData.byAccount ? segData.byAccount[a.id] : null;
    if (bizSeg) {
      segments.by_segment[bizSeg] = segments.by_segment[bizSeg] || [];
      segments.by_segment[bizSeg].push(a);
    }
  }

  return segments;
}

export function segmentSummary(segments) {
  return {
    total: Object.values(segments.by_health).reduce((s, arr) => s + arr.length, 0),
    healthy: segments.by_health.healthy.length,
    at_risk: segments.by_health.at_risk.length,
    churned: segments.by_health.churned.length,
    plans: Object.fromEntries(Object.entries(segments.by_plan).map(([k, v]) => [k, v.length])),
    csms: Object.fromEntries(Object.entries(segments.by_csm).map(([k, v]) => [k, v.length])),
    renewal_imminent: segments.by_renewal_urgency.imminent.length,
    renewal_this_q: segments.by_renewal_urgency.this_quarter.length,
  };
}

export function getActiveSegments(segments) {
  return Object.keys(segments).filter(k => {
    const val = segments[k];
    if (Array.isArray(val)) return val.length > 0;
    return Object.values(val).some(arr => Array.isArray(arr) && arr.length > 0);
  });
}
