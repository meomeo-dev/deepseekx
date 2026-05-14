// Failed-payment routing — analyzes payment failures and recommends remediation.

export function analyzeFailedPayments(paymentAttempts, invoices, accounts) {
  const failures = paymentAttempts.filter(p => p.status === "failed");

  const byAccount = {};
  for (const f of failures) {
    const key = f.account_id;
    if (!byAccount[key]) {
      byAccount[key] = { account_id: key, attempts: [], invoices: [], total_attempted: 0 };
    }
    byAccount[key].attempts.push(f);
    byAccount[key].total_attempted += f.amount || 0;
  }

  // Link to invoices
  for (const entry of Object.values(byAccount)) {
    entry.invoices = invoices.filter(inv => inv.account_id === entry.account_id && inv.status !== "paid");
    entry.total_due = entry.invoices.reduce((s, i) => s + i.amount, 0);
  }

  const routed = [];
  for (const entry of Object.values(byAccount)) {
    const account = accounts.find(a => a.id === entry.account_id);
    const failures = entry.attempts;
    const latestFailure = failures.reduce((best, f) => f.timestamp > best.timestamp ? f : best, failures[0]);

    // Determine failure reason
    const reasons = [...new Set(failures.map(f => f.failure_reason))];
    const primaryReason = mostFrequent(failures.map(f => f.failure_reason));

    // Route based on reason
    let route;
    if (primaryReason === "insufficient_funds") {
      route = "Retry in 3 days + notify billing contact";
    } else if (primaryReason === "card_expired") {
      route = "Request updated payment method immediately";
    } else if (primaryReason === "bank_decline" || primaryReason === "fraud_block") {
      route = "Contact account directly — manual payment needed";
    } else if (primaryReason === "gateway_timeout") {
      route = "Auto-retry in 1 hour with exponential backoff";
    } else {
      route = "Manual review required";
    }

    const attemptCount = failures.length;
    const escalating = attemptCount >= 3;

    routed.push({
      account_id: entry.account_id,
      account_name: account ? account.name : "Unknown",
      mrr: account ? account.mrr : 0,
      health: account ? account.health : "unknown",
      failed_attempts: attemptCount,
      total_attempted: entry.total_attempted,
      total_due: entry.total_due,
      failure_reasons: reasons,
      primary_reason: primaryReason,
      route,
      escalating,
      latest_failure: latestFailure.timestamp,
      days_since_first_failure: Math.round((Date.now() - failures[0].timestamp) / 86400000),
    });
  }

  routed.sort((a, b) => b.total_due - a.total_due);
  return routed;
}

function mostFrequent(arr) {
  const counts = {};
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
  }
  let best = null, bestCount = 0;
  for (const [item, count] of Object.entries(counts)) {
    if (count > bestCount) { best = item; bestCount = count; }
  }
  return best;
}

export function failedPaymentSummary(routed) {
  const byReason = {};
  let totalAtRisk = 0;
  for (const r of routed) {
    byReason[r.primary_reason] = (byReason[r.primary_reason] || 0) + 1;
    totalAtRisk += r.total_due;
  }
  return {
    total_accounts: routed.length,
    total_at_risk_amount: totalAtRisk,
    escalating: routed.filter(r => r.escalating).length,
    byReason,
  };
}
