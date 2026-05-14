// Northstar Ops Console — Deployment risk scoring.
// Weights: change size, time since last deploy, environment, test coverage, rollback readiness.

export function scoreDeployRisk(deployment, recentDeploys, deployChecks) {
  let risk = 0;
  const factors = [];

  // Environment baseline
  const envRisk = { production: 5, canary: 3, staging: 1 };
  const envScore = envRisk[deployment.environment] || 3;
  risk += envScore;
  factors.push({ name: "Environment", score: envScore, detail: deployment.environment });

  // Change frequency (many recent deploys = higher risk of conflict)
  const sameService = recentDeploys.filter(d => d.service === deployment.service && d.id !== deployment.id);
  const recentCount = sameService.filter(d => d.started_at > deployment.started_at - 86400000 * 3).length;
  const freqScore = recentCount >= 5 ? 4 : recentCount >= 3 ? 2 : 0;
  risk += freqScore;
  factors.push({ name: "Recent deploy velocity", score: freqScore, detail: `${recentCount} in 3 days` });

  // Rollback readiness
  const rbScore = deployment.rollback_ready ? 0 : 3;
  risk += rbScore;
  factors.push({ name: "Rollback readiness", score: rbScore, detail: deployment.rollback_ready ? "Ready" : "Not ready" });

  // Deploy checks
  const checksForDeploy = deployChecks[deployment.id] || [];
  const passed = checksForDeploy.filter(c => c.passed !== false).length;
  const failed = checksForDeploy.filter(c => c.passed === false).length;
  const total = checksForDeploy.length;
  let checkScore = 0;
  if (total > 0 && failed > 0) {
    checkScore = Math.min(5, Math.round((failed / total) * 5));
  } else if (total === 0) {
    checkScore = 1; // unknown = mild risk
  }
  risk += checkScore;
  factors.push({ name: "Pre-deploy checks", score: checkScore, detail: `${passed}/${total} passed` });

  // Previous rollback for same service
  const prevRollback = recentDeploys.filter(d => d.service === deployment.service && d.status === "rolled_back").length;
  const rollbackHistoryScore = Math.min(3, prevRollback);
  risk += rollbackHistoryScore;
  factors.push({ name: "Rollback history", score: rollbackHistoryScore, detail: `${prevRollback} prior` });

  risk = Math.min(20, risk);

  // Normalize to 1–10
  const normalized = Math.round((risk / 20) * 9) + 1;

  return {
    score: normalized,
    raw_score: risk,
    level: normalized >= 8 ? "high" : normalized >= 5 ? "medium" : "low",
    factors,
    recommendation: normalized >= 8
      ? "Consider canary deploy or off-peak window"
      : normalized >= 5
        ? "Standard deploy with monitoring"
        : "Safe to deploy",
  };
}

export function aggregateDeployRisk(deployments, deployChecks) {
  const scored = deployments.map(d => ({
    deployment: d,
    risk: scoreDeployRisk(d, deployments, deployChecks),
  }));
  return {
    scored,
    high_risk: scored.filter(s => s.risk.level === "high"),
    avg_risk: scored.length ? scored.reduce((s, x) => s + x.risk.score, 0) / scored.length : 0,
  };
}
