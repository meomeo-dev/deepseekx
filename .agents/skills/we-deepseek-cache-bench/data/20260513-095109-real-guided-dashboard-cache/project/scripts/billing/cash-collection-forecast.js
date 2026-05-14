// Cash-collection forecast — predicts collection timing and amounts for outstanding invoices.

const NOW = Date.now();
const DAY = 86400000;

export function forecastCollections(agedAccounts, accounts, paymentHistory) {
  const forecast = {
    next_7_days: { count: 0, amount: 0 },
    next_30_days: { count: 0, amount: 0 },
    next_60_days: { count: 0, amount: 0 },
    next_90_days: { count: 0, amount: 0 },
    at_risk: { count: 0, amount: 0 },
    total_outstanding: 0,
    expected_recovery_pct: 0,
  };

  const details = [];

  for (const entry of agedAccounts) {
    const account = accounts.find(a => a.id === entry.account_id);
    const history = paymentHistory[entry.account_id] || {};

    // Estimate collection probability and timeline
    const lateRatio = history.total_invoices > 0 ? (history.late_payments || 0) / history.total_invoices : 0;
    const hasContact = !!(history.billing_contact);

    // Base collection probability
    let collectProb = 0.98;
    if (entry.max_days > 90) collectProb -= 0.25;
    else if (entry.max_days > 60) collectProb -= 0.10;
    else if (entry.max_days > 30) collectProb -= 0.03;

    if (lateRatio > 0.5) collectProb -= 0.10;
    if (!hasContact) collectProb -= 0.05;

    // Estimate when they'll pay
    let estDays;
    if (entry.max_days <= 30) estDays = Math.round(entry.max_days + 7);
    else if (entry.max_days <= 60) estDays = Math.round(entry.max_days + 14);
    else estDays = Math.round(entry.max_days + 30);

    const expectedAmount = Math.round(entry.total * collectProb);

    // Bucket into forecast periods
    if (estDays <= 7) {
      forecast.next_7_days.count += 1;
      forecast.next_7_days.amount += expectedAmount;
    } else if (estDays <= 30) {
      forecast.next_30_days.count += 1;
      forecast.next_30_days.amount += expectedAmount;
    } else if (estDays <= 60) {
      forecast.next_60_days.count += 1;
      forecast.next_60_days.amount += expectedAmount;
    } else {
      forecast.next_90_days.count += 1;
      forecast.next_90_days.amount += expectedAmount;
    }

    if (collectProb < 0.75) {
      forecast.at_risk.count += 1;
      forecast.at_risk.amount += expectedAmount;
    }

    forecast.total_outstanding += entry.total;

    details.push({
      account_id: entry.account_id,
      account_name: entry.account_name,
      amount_due: entry.total,
      max_days: entry.max_days,
      collection_probability: parseFloat(collectProb.toFixed(2)),
      estimated_payment_days: estDays,
      expected_collection: expectedAmount,
    });
  }

  forecast.details = details.sort((a, b) => b.amount_due - a.amount_due);
  forecast.expected_recovery_pct = forecast.total_outstanding > 0
    ? parseFloat(((forecast.next_7_days.amount + forecast.next_30_days.amount + forecast.next_60_days.amount + forecast.next_90_days.amount) / forecast.total_outstanding * 100).toFixed(1))
    : 0;

  return forecast;
}

export function collectionForecastSummary(forecast) {
  return {
    total_outstanding: forecast.total_outstanding,
    expected_7d: forecast.next_7_days.amount,
    expected_30d: forecast.next_7_days.amount + forecast.next_30_days.amount,
    expected_recovery_pct: forecast.expected_recovery_pct,
    at_risk_amount: forecast.at_risk.amount,
    at_risk_count: forecast.at_risk.count,
    top_collections: forecast.details.filter(d => d.collection_probability >= 0.9).slice(0, 5),
  };
}
