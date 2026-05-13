// Time-series bucketing — groups events into weekly/monthly/quarterly buckets.

const DAY = 86400000;

export function bucketByMonth(events, tsField, valueField) {
  const months = {};
  for (const e of events) {
    const d = new Date(e[tsField]);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!months[key]) months[key] = [];
    months[key].push(e[valueField]);
  }
  return Object.entries(months)
    .map(([month, vals]) => ({ month, count: vals.length, sum: vals.reduce((s, v) => s + v, 0), avg: vals.reduce((s, v) => s + v, 0) / vals.length }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function bucketByWeek(events, tsField, valueField, weeks = 12) {
  const now = Date.now();
  const buckets = [];
  for (let w = 0; w < weeks; w++) {
    const start = now - (w + 1) * 7 * DAY;
    const end = now - w * 7 * DAY;
    const inRange = events.filter(e => e[tsField] >= start && e[tsField] < end);
    const vals = inRange.map(e => e[valueField]);
    buckets.push({
      week: w,
      label: `W-${w}`,
      count: vals.length,
      sum: vals.reduce((s, v) => s + v, 0),
      avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0,
    });
  }
  return buckets.reverse();
}

export function linearTrend(buckets, valueKey) {
  const n = buckets.length;
  if (n < 2) return { slope: 0, intercept: buckets[0]?.[valueKey] || 0, direction: "flat" };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += buckets[i][valueKey] || 0;
    sumXY += i * (buckets[i][valueKey] || 0);
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return {
    slope: parseFloat(slope.toFixed(4)),
    intercept: parseFloat(intercept.toFixed(2)),
    direction: slope > 0.01 ? "up" : slope < -0.01 ? "down" : "flat",
    nextPeriod: parseFloat((intercept + slope * n).toFixed(2)),
    r2: computeR2(buckets, valueKey, slope, intercept),
  };
}

function computeR2(buckets, valueKey, slope, intercept) {
  const n = buckets.length;
  const mean = buckets.reduce((s, b) => s + (b[valueKey] || 0), 0) / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const y = buckets[i][valueKey] || 0;
    const pred = intercept + slope * i;
    ssRes += (y - pred) ** 2;
    ssTot += (y - mean) ** 2;
  }
  return ssTot > 0 ? parseFloat((1 - ssRes / ssTot).toFixed(4)) : 0;
}

export function seasonalityFactors(monthlyBuckets, valueKey) {
  const byCalendarMonth = {};
  for (const b of monthlyBuckets) {
    const m = b.month.slice(5);
    if (!byCalendarMonth[m]) byCalendarMonth[m] = [];
    byCalendarMonth[m].push(b[valueKey] || 0);
  }
  const overallAvg = monthlyBuckets.reduce((s, b) => s + (b[valueKey] || 0), 0) / monthlyBuckets.length;
  const factors = {};
  for (const [m, vals] of Object.entries(byCalendarMonth)) {
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    factors[m] = parseFloat((avg / (overallAvg || 1)).toFixed(3));
  }
  return factors;
}
