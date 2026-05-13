// Dunning prioritization — ranks overdue accounts for collection outreach.
// Weights: amount due, days overdue, account health, payment history, account MRR.

const NOW = Date.now();
const DAY = 86400000;

export function prioritizeDunning(agedAccounts, accounts, paymentHistory, billingContacts) {
  const queue = [];

  for (const entry of agedAccounts) {
    const account = accounts.find(a => a.id === entry.account_id);
    if (!account) continue;

    const history = paymentHistory[entry.account_id] || {};
    const contact = billingContacts[entry.account_id] || null;

    // Base score from amount and age
    let score = entry.total / 100;
    score += entry.max_days * 2;

    // Health penalty — at-risk accounts get higher priority (they might churn)
    if (account.health === "at_risk") score += 30;

    // Payment history — late payers get escalated
    const lateRatio = history.total_invoices > 0
      ? (history.late_payments || 0) / history.total_invoices
      : 0;
    score += lateRatio * 25;

    // MRR magnitude — larger accounts get attention
    score += account.mrr / 500;

    // Has billing contact — lower score (easier to resolve)
    if (contact) score -= 10;

    // Days since last payment
    if (history.last_payment_date) {
      const daysSinceLast = (NOW - history.last_payment_date) / DAY;
      if (daysSinceLast > 60) score += 20;
    }

    queue.push({
      account_id: entry.account_id,
      account_name: entry.account_name,
      total_due: entry.total,
      max_days_overdue: entry.max_days,
      invoice_count: entry.invoices.length,
      score: Math.round(score),
      health: account.health,
      mrr: account.mrr,
      billing_contact: contact ? contact.name : null,
      contact_email: contact ? contact.email : null,
      late_payment_ratio: parseFloat(lateRatio.toFixed(2)),
    });
  }

  queue.sort((a, b) => b.score - a.score);

  // Assign priority tiers
  for (const item of queue) {
    if (item.score >= 80) item.tier = "urgent";
    else if (item.score >= 45) item.tier = "high";
    else if (item.score >= 20) item.tier = "medium";
    else item.tier = "low";

    item.recommended_action = item.tier === "urgent"
      ? "Immediate call + email — escalate to account manager"
      : item.tier === "high"
        ? "Send formal demand letter + call within 48h"
        : item.tier === "medium"
          ? "Send reminder email with payment link"
          : "Standard dunning email on schedule";
  }

  return queue;
}

export function dunningSummary(queue) {
  const byTier = { urgent: 0, high: 0, medium: 0, low: 0 };
  let totalDue = 0;
  for (const item of queue) {
    byTier[item.tier] = (byTier[item.tier] || 0) + 1;
    totalDue += item.total_due;
  }

  return {
    total_in_dunning: queue.length,
    total_amount_due: totalDue,
    byTier,
    urgent_count: byTier.urgent,
    urgent_amount: queue.filter(q => q.tier === "urgent").reduce((s, q) => s + q.total_due, 0),
    top_5: queue.slice(0, 5),
  };
}
