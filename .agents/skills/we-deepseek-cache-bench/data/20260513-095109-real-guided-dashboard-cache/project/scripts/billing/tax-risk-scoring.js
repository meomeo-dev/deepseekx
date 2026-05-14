// Tax-risk scoring — evaluates accounts for tax compliance flags.

export function scoreTaxRisk(account, taxProfile, contractTerms) {
  if (!taxProfile) {
    return {
      account_id: account.id,
      account_name: account.name,
      risk_score: 30,
      risk_level: "unknown",
      flags: [{ type: "missing_profile", detail: "No tax profile on file" }],
      recommendation: "Collect tax registration details",
    };
  }

  let score = 0;
  const flags = [];

  // Flag 1: Tax ID missing
  if (!taxProfile.tax_id) {
    score += 25;
    flags.push({ type: "missing_tax_id", detail: "Tax ID not provided" });
  }

  // Flag 2: Cross-border without proper registration
  if (taxProfile.country !== account.country && !taxProfile.vat_registered) {
    score += 30;
    flags.push({ type: "cross_border_unregistered", detail: `Billing from ${taxProfile.country} to ${account.country || "unknown"} without VAT registration` });
  }

  // Flag 3: Tax-exempt status expiring
  if (taxProfile.tax_exempt && taxProfile.exempt_expiry) {
    const daysUntil = (taxProfile.exempt_expiry - Date.now()) / 86400000;
    if (daysUntil <= 30) {
      score += 20;
      flags.push({ type: "exemption_expiring", detail: `Tax exemption expires in ${Math.round(daysUntil)} days` });
    }
  }

  // Flag 4: Missing nexus documentation for high-MRR accounts
  if (account.mrr > 10000 && !taxProfile.nexus_documentation) {
    score += 15;
    flags.push({ type: "nexus_risk", detail: "High-MRR account without nexus documentation" });
  }

  // Flag 5: Contract terms with unusual tax treatment
  if (contractTerms && contractTerms.payment_terms === "annual" && !taxProfile.annual_filing) {
    score += 10;
    flags.push({ type: "annual_filing_risk", detail: "Annual billing without annual tax filing status" });
  }

  return {
    account_id: account.id,
    account_name: account.name,
    risk_score: Math.min(100, score),
    risk_level: score >= 50 ? "high" : score >= 25 ? "medium" : score > 0 ? "low" : "compliant",
    flags,
    recommendation: score >= 50
      ? "Urgent — engage tax advisor before next billing cycle"
      : score >= 25
        ? "Review and update tax profile within 30 days"
        : "Monitor — no immediate action required",
  };
}

export function batchScoreTaxRisks(accounts, taxProfiles, contractTerms) {
  return accounts
    .filter(a => a.health !== "churned")
    .map(a => {
      const taxProfile = taxProfiles[a.id];
      const terms = contractTerms[a.id];
      return scoreTaxRisk(a, taxProfile, terms);
    })
    .sort((a, b) => b.risk_score - a.risk_score);
}

export function taxRiskSummary(scored) {
  const byLevel = { high: 0, medium: 0, low: 0, compliant: 0, unknown: 0 };
  const flagTypes = {};
  for (const s of scored) {
    byLevel[s.risk_level] = (byLevel[s.risk_level] || 0) + 1;
    for (const f of s.flags) {
      flagTypes[f.type] = (flagTypes[f.type] || 0) + 1;
    }
  }
  return {
    total: scored.length,
    byLevel,
    high_risk: byLevel.high,
    common_flags: Object.entries(flagTypes).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}
