// Revenue-leakage detection — finds billing gaps, underpricing, entitlement mismatches.

export function detectLeakage(accounts, invoices, contracts, entitlementMismatches) {
  const leaks = [];

  for (const a of accounts) {
    if (a.health === "churned") continue;
    const contract = contracts[a.id];
    const accountInvoices = invoices.filter(inv => inv.account_id === a.id);
    const mismatches = (entitlementMismatches || []).filter(m => m.account_id === a.id);
    const leakItems = [];

    // 1. Entitlement mismatches — using features not paid for
    for (const mis of mismatches) {
      if (mis.status === "active") {
        const estValue = mis.estimated_monthly_value || Math.round(a.mrr * 0.15);
        leakItems.push({
          type: "entitlement_gap",
          description: `Using ${mis.feature} without entitlement`,
          monthly_value: estValue,
          annual_value: estValue * 12,
        });
      }
    }

    // 2. No recent invoices but account is active (billing gap)
    const recentPaid = accountInvoices.filter(inv => inv.status === "paid" && inv.paid_date > Date.now() - 60 * 86400000);
    if (recentPaid.length === 0 && accountInvoices.length > 0) {
      const lastPaid = accountInvoices.filter(inv => inv.status === "paid").sort((a, b) => (b.paid_date || 0) - (a.paid_date || 0))[0];
      const gapDays = lastPaid ? Math.round((Date.now() - lastPaid.paid_date) / 86400000) : 90;
      leakItems.push({
        type: "billing_gap",
        description: `No payment in ${gapDays} days — possible silent churn`,
        monthly_value: a.mrr,
        annual_value: a.mrr * 12,
      });
    }

    // 3. Discount abuse — discount still applied after term
    if (contract && contract.discount_pct > 0) {
      const contractAgeDays = (Date.now() - contract.start_date) / 86400000;
      const termDays = contract.term_months * 30;
      if (contractAgeDays > termDays && contract.auto_renew) {
        leakItems.push({
          type: "discount_legacy",
          description: `${contract.discount_pct}% discount beyond ${contract.term_months}mo term`,
          monthly_value: Math.round(a.mrr * (contract.discount_pct / 100)),
          annual_value: Math.round(a.mrr * 12 * (contract.discount_pct / 100)),
        });
      }
    }

    if (leakItems.length > 0) {
      leaks.push({
        account_id: a.id,
        account_name: a.name,
        mrr: a.mrr,
        plan: a.plan,
        health: a.health,
        total_monthly_leakage: leakItems.reduce((s, l) => s + l.monthly_value, 0),
        total_annual_leakage: leakItems.reduce((s, l) => s + l.annual_value, 0),
        items: leakItems,
        leak_count: leakItems.length,
      });
    }
  }

  leaks.sort((a, b) => b.total_annual_leakage - a.total_annual_leakage);
  return leaks;
}

export function leakageSummary(leaks) {
  const byType = {};
  let totalMonthly = 0, totalAnnual = 0;

  for (const leak of leaks) {
    totalMonthly += leak.total_monthly_leakage;
    totalAnnual += leak.total_annual_leakage;
    for (const item of leak.items) {
      byType[item.type] = (byType[item.type] || 0) + 1;
    }
  }

  return {
    total_accounts_with_leaks: leaks.length,
    total_monthly_leakage: totalMonthly,
    total_annual_leakage: totalAnnual,
    byType,
    high_impact: leaks.filter(l => l.total_annual_leakage > 5000).length,
    top_leaks: leaks.slice(0, 10),
  };
}
