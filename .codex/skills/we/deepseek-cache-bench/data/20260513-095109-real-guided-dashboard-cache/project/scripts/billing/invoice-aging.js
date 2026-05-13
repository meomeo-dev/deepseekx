// Invoice-aging buckets — categorizes unpaid invoices by overdue duration.

const NOW = Date.now();
const DAY = 86400000;

export function ageInvoices(invoices) {
  const buckets = {
    current: [],
    aging_1_30: [],
    aging_31_60: [],
    aging_61_90: [],
    aging_90_plus: [],
    paid: [],
  };

  for (const inv of invoices) {
    if (inv.status === "paid") {
      buckets.paid.push(inv);
      continue;
    }
    const daysOverdue = Math.round((NOW - inv.due_date) / DAY);
    if (daysOverdue <= 0) {
      buckets.current.push({ ...inv, days_overdue: 0 });
    } else if (daysOverdue <= 30) {
      buckets.aging_1_30.push({ ...inv, days_overdue: daysOverdue });
    } else if (daysOverdue <= 60) {
      buckets.aging_31_60.push({ ...inv, days_overdue: daysOverdue });
    } else if (daysOverdue <= 90) {
      buckets.aging_61_90.push({ ...inv, days_overdue: daysOverdue });
    } else {
      buckets.aging_90_plus.push({ ...inv, days_overdue: daysOverdue });
    }
  }

  return buckets;
}

export function agingSummary(buckets) {
  const totalOutstanding = (arr) => arr.reduce((s, inv) => s + inv.amount, 0);

  return {
    current: { count: buckets.current.length, amount: totalOutstanding(buckets.current) },
    aging_1_30: { count: buckets.aging_1_30.length, amount: totalOutstanding(buckets.aging_1_30) },
    aging_31_60: { count: buckets.aging_31_60.length, amount: totalOutstanding(buckets.aging_31_60) },
    aging_61_90: { count: buckets.aging_61_90.length, amount: totalOutstanding(buckets.aging_61_90) },
    aging_90_plus: { count: buckets.aging_90_plus.length, amount: totalOutstanding(buckets.aging_90_plus) },
    paid: { count: buckets.paid.length, amount: totalOutstanding(buckets.paid) },
    total_outstanding: totalOutstanding(buckets.current) + totalOutstanding(buckets.aging_1_30) +
      totalOutstanding(buckets.aging_31_60) + totalOutstanding(buckets.aging_61_90) +
      totalOutstanding(buckets.aging_90_plus),
    total_overdue: totalOutstanding(buckets.aging_1_30) + totalOutstanding(buckets.aging_31_60) +
      totalOutstanding(buckets.aging_61_90) + totalOutstanding(buckets.aging_90_plus),
  };
}

export function atRiskAccounts(buckets) {
  const risky = [...buckets.aging_61_90, ...buckets.aging_90_plus];
  const byAccount = {};
  for (const inv of risky) {
    if (!byAccount[inv.account_id]) {
      byAccount[inv.account_id] = { account_id: inv.account_id, account_name: inv.account_name, invoices: [], total: 0, max_days: 0 };
    }
    byAccount[inv.account_id].invoices.push(inv);
    byAccount[inv.account_id].total += inv.amount;
    byAccount[inv.account_id].max_days = Math.max(byAccount[inv.account_id].max_days, inv.days_overdue || 0);
  }
  return Object.values(byAccount).sort((a, b) => b.total - a.total);
}
