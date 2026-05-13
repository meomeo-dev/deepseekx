// Feature adoption scoring — measures depth and breadth of feature usage per account.

export function scoreFeatureAdoption(account, featureAdoption, featureCatalog) {
  const ad = featureAdoption[account.id] || {};
  const features = featureCatalog || [];

  if (features.length === 0) {
    return {
      account_id: account.id,
      account_name: account.name,
      plan: account.plan,
      overall_score: 50,
      depth_score: 0,
      breadth_score: 0,
      level: "unknown",
      adopted: [],
      unused: [],
      recommendations: [],
    };
  }

  // Plan-appropriate features
  const planFeatureCounts = { Starter: 3, Growth: 5, Business: 7, Enterprise: 9 };
  const maxFeatures = planFeatureCounts[account.plan] || features.length;
  const relevantFeatures = features.slice(0, maxFeatures);

  // Breadth: how many features adopted
  const adopted = relevantFeatures.filter(f => ad.adopted_features?.includes(f.id));
  const unused = relevantFeatures.filter(f => !ad.adopted_features?.includes(f.id));
  const breadthScore = relevantFeatures.length > 0
    ? Math.round((adopted.length / relevantFeatures.length) * 100)
    : 0;

  // Depth: usage intensity (from usage events per feature)
  const depthByFeature = {};
  let totalDepth = 0;
  for (const f of adopted) {
    const depth = ad.feature_depth?.[f.id] || 50;
    depthByFeature[f.id] = depth;
    totalDepth += depth;
  }
  const depthScore = adopted.length > 0
    ? Math.round(totalDepth / adopted.length)
    : 0;

  const overallScore = Math.round((breadthScore * 0.4) + (depthScore * 0.6));

  // Level
  let level;
  if (overallScore >= 80) level = "power_user";
  else if (overallScore >= 55) level = "engaged";
  else if (overallScore >= 30) level = "light";
  else level = "minimal";

  // Recommendations
  const recommendations = [];
  if (unused.length > 0) {
    const topUnused = unused.slice(0, 2);
    for (const f of topUnused) {
      recommendations.push({
        feature_id: f.id,
        feature_name: f.name,
        action: "adopt",
        reason: `High-value unused feature for ${account.plan} plan`,
      });
    }
  }
  for (const f of adopted) {
    const d = depthByFeature[f.id] || 50;
    if (d < 40) {
      recommendations.push({
        feature_id: f.id,
        feature_name: f.name,
        action: "deepen",
        reason: `Low depth usage (${d}/100) — training recommended`,
      });
    }
  }

  return {
    account_id: account.id,
    account_name: account.name,
    plan: account.plan,
    overall_score: overallScore,
    breadth_score: breadthScore,
    depth_score: depthScore,
    level,
    adopted_count: adopted.length,
    unused_count: unused.length,
    total_relevant: relevantFeatures.length,
    adopted: adopted.map(f => ({ id: f.id, name: f.name, depth: depthByFeature[f.id] || 50 })),
    unused: unused.map(f => ({ id: f.id, name: f.name })),
    recommendations: recommendations.slice(0, 3),
  };
}

export function batchScoreAdoption(accounts, featureAdoption, featureCatalog) {
  return accounts
    .filter(a => a.health !== "churned")
    .map(a => scoreFeatureAdoption(a, featureAdoption, featureCatalog))
    .sort((a, b) => b.overall_score - a.overall_score);
}

export function adoptionSummary(scored) {
  const byLevel = {};
  let totalScore = 0;
  for (const s of scored) {
    byLevel[s.level] = (byLevel[s.level] || 0) + 1;
    totalScore += s.overall_score;
  }
  return {
    total_accounts: scored.length,
    avg_score: scored.length ? Math.round(totalScore / scored.length) : 0,
    byLevel,
    power_users: byLevel.power_user || 0,
    minimal_users: byLevel.minimal || 0,
    adoption_gap: scored.filter(s => s.level === "minimal" || s.level === "light").length,
  };
}
