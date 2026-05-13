// Owner workload — computes capacity and renewal load per CSM.

export function computeOwnerWorkload(calendar, ownerCapacity, meetings) {
  // ownerCapacity: { owner_id: { max_accounts, max_renewals_per_month } }
  const workload = {};

  for (const c of calendar) {
    const owner = c.cs_owner || "unassigned";
    if (!workload[owner]) {
      workload[owner] = {
        owner,
        accounts: [],
        total_mrr: 0,
        renewal_count: 0,
        at_risk_count: 0,
        urgent_count: 0, // within 30 days
        capacity: ownerCapacity[owner] || { max_accounts: 40, max_renewals_per_month: 8 },
      };
    }
    const w = workload[owner];
    w.accounts.push(c);
    w.total_mrr += c.mrr;
    w.renewal_count += 1;
    if (c.health === "at_risk") w.at_risk_count += 1;
    if (c.days_until_renewal <= 30) w.urgent_count += 1;
  }

  // Add meeting/QBR counts
  if (meetings) {
    for (const m of meetings) {
      const owner = m.owner || "unassigned";
      if (workload[owner]) {
        workload[owner].meetings = (workload[owner].meetings || 0) + 1;
        if (m.type === "qbr") workload[owner].qbrs = (workload[owner].qbrs || 0) + 1;
      }
    }
  }

  // Compute utilization
  const NOW = Date.now();
  const DAY = 86400000;
  for (const w of Object.values(workload)) {
    const cap = w.capacity;
    w.account_utilization = cap.max_accounts > 0 ? parseFloat((w.accounts.length / cap.max_accounts).toFixed(2)) : 0;
    // Monthly renewal load (renewals in next 30 days)
    const monthlyRenewals = w.accounts.filter(c => c.days_until_renewal <= 30).length;
    w.renewal_utilization = cap.max_renewals_per_month > 0
      ? parseFloat((monthlyRenewals / cap.max_renewals_per_month).toFixed(2))
      : 0;
    w.overloaded = w.account_utilization > 0.85 || w.renewal_utilization > 0.85;
    w.status = w.overloaded ? "overloaded" : w.account_utilization > 0.6 ? "busy" : "ok";
    w.monthly_renewals = monthlyRenewals;
  }

  return workload;
}

export function workloadSummary(workload) {
  const owners = Object.values(workload);
  return {
    total_owners: owners.length,
    overloaded: owners.filter(o => o.overloaded).length,
    total_accounts_managed: owners.reduce((s, o) => s + o.accounts.length, 0),
    total_arr_managed: owners.reduce((s, o) => s + o.total_mrr * 12, 0),
    avg_accounts_per_owner: owners.length ? Math.round(owners.reduce((s, o) => s + o.accounts.length, 0) / owners.length) : 0,
    avg_utilization: owners.length
      ? parseFloat((owners.reduce((s, o) => s + o.account_utilization, 0) / owners.length).toFixed(2))
      : 0,
    by_owner: owners.sort((a, b) => b.account_utilization - a.account_utilization),
  };
}
