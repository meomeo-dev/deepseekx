// Runbook recommendation — matches incidents to predefined runbooks based on
// service, symptoms, severity, and affected components.

const RUNBOOKS = [
  {
    id: "rb_api_latency",
    name: "API Latency Spike Response",
    description: "Diagnose and mitigate sudden API latency increases.",
    service: "api-gateway",
    triggers: ["latency", "timeout", "slow", "response time"],
    severity: ["sev1", "sev2"],
    steps: [
      "Check API gateway metrics for request rate and latency percentiles",
      "Verify upstream service health in service mesh dashboard",
      "Inspect database connection pool utilization",
      "Check for recent deployments in the last 30 minutes",
      "If connection pool > 90%, increase pool size or restart idle connections",
      "If recent deploy found, evaluate rollback",
      "Escalate to platform team if no obvious cause within 15 minutes",
    ],
  },
  {
    id: "rb_db_connection_pool",
    name: "Database Connection Pool Exhaustion",
    description: "Handle database connection pool saturation and recovery.",
    service: "database",
    triggers: ["connection pool", "connection", "exhaustion", "database"],
    severity: ["sev0", "sev1", "sev2"],
    steps: [
      "Check current connection count vs pool max in RDS/DB dashboard",
      "Identify queries holding connections (pg_stat_activity / SHOW PROCESSLIST)",
      "Kill long-running idle transactions if safe",
      "Temporarily increase pool size if headroom exists",
      "Scale up read replicas if read-heavy workload detected",
      "Investigate recent query changes or schema migrations",
      "Escalate to DBA if not resolved in 20 minutes",
    ],
  },
  {
    id: "rb_cache_invalidation",
    name: "Cache Invalidation / Stale Data",
    description: "Resolve cache invalidation failures causing stale or incorrect data.",
    service: "infrastructure",
    triggers: ["cache", "invalidation", "stale", "cdn"],
    severity: ["sev1", "sev2", "sev3"],
    steps: [
      "Verify cache hit/miss ratio in monitoring dashboard",
      "Check for cache eviction events or memory pressure",
      "Manually invalidate affected cache keys via admin tool",
      "Inspect cache TTL configuration for recent changes",
      "If CDN-related, purge CDN edge cache for affected paths",
      "Monitor recovery and confirm cache population",
    ],
  },
  {
    id: "rb_auth_failure",
    name: "Authentication / SSO Failure",
    description: "Triage and resolve authentication or SSO failures.",
    service: "auth-service",
    triggers: ["sso", "auth", "tls", "certificate", "login"],
    severity: ["sev0", "sev1", "sev2"],
    steps: [
      "Check IdP (identity provider) status page for upstream issues",
      "Verify TLS certificate expiry on auth service endpoints",
      "Inspect auth service logs for error rates by error code",
      "Check for recent SSO configuration changes",
      "Test authentication flow manually with test account",
      "If certificate expired, initiate emergency cert rotation",
      "Escalate to security team if suspicious activity detected",
    ],
  },
  {
    id: "rb_billing_failure",
    name: "Billing / Payment Processing Failure",
    description: "Address billing or payment processing disruptions.",
    service: "billing-worker",
    triggers: ["billing", "payment", "invoice", "charge"],
    severity: ["sev0", "sev1"],
    steps: [
      "Check payment gateway status page for upstream outages",
      "Verify billing worker queue depth and processing rate",
      "Inspect recent invoice generation logs for errors",
      "Confirm database connectivity for billing schema",
      "If queue backlog, temporarily scale billing workers",
      "Notify finance team of any double-charge risk",
      "Prepare customer communication for billing-impacted accounts",
    ],
  },
  {
    id: "rb_deploy_rollback",
    name: "Emergency Deployment Rollback",
    description: "Quickly roll back a problematic deployment.",
    service: "any",
    triggers: ["deploy", "rollback", "release", "version"],
    severity: ["sev0", "sev1", "sev2"],
    steps: [
      "Identify the specific deployment version that caused the incident",
      "Verify rollback plan and database migration reversibility",
      "Execute rollback via deployment pipeline (emergency path)",
      "Monitor service health for 10 minutes post-rollback",
      "Confirm error rates and latency return to baseline",
      "Notify affected teams of rollback completion",
      "Flag deployment for postmortem review",
    ],
  },
  {
    id: "rb_generic_outage",
    name: "Generic Service Outage Response",
    description: "Standard incident response for undefined failure modes.",
    service: "any",
    triggers: [],
    severity: ["sev0", "sev1", "sev2", "sev3"],
    steps: [
      "Acknowledge the incident and declare severity via IM channel",
      "Assign incident commander and communications lead",
      "Check monitoring dashboards for anomaly correlation",
      "Review recent changes (deploys, config, infrastructure)",
      "Start a shared incident document for timeline tracking",
      "Engage subject-matter experts for affected components",
      "Provide status update within SLA timeframe",
    ],
  },
];

const SERVICE_ALIASES = {
  "api-gateway": ["api", "gateway"],
  "database": ["db", "database", "rds", "postgres"],
  "auth-service": ["auth", "sso", "authentication"],
  "billing-worker": ["billing", "payment", "invoice"],
  "reporting-engine": ["report", "export", "pdf"],
  "notification-service": ["webhook", "notification", "email"],
  "background-jobs": ["queue", "job", "worker", "batch"],
  "infrastructure": ["cache", "cdn", "infra", "network"],
  "web-app": ["web", "frontend", "ui", "dashboard"],
};

export function recommendRunbooks(incident) {
  const title = (incident.title || "").toLowerCase();

  const scored = RUNBOOKS.map(rb => {
    let score = 0;

    // Service match
    if (rb.service === "any") score += 3;
    else if (rb.service === inferServiceFromTitle(title)) score += 10;
    else {
      const aliases = SERVICE_ALIASES[rb.service] || [];
      for (const alias of aliases) {
        if (title.includes(alias)) { score += 7; break; }
      }
    }

    // Trigger word match
    for (const trigger of rb.triggers) {
      if (title.includes(trigger)) score += 5;
    }

    // Severity match
    if (rb.severity.includes(incident.severity)) score += 4;

    return { runbook: rb, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Return top matches with score > 0
  const matches = scored.filter(s => s.score > 3).slice(0, 3);
  if (matches.length === 0) {
    // Always return the generic runbook
    const generic = RUNBOOKS.find(rb => rb.id === "rb_generic_outage");
    if (generic) matches.push({ runbook: generic, score: 1 });
  }

  return matches.map(m => ({
    runbook_id: m.runbook.id,
    name: m.runbook.name,
    description: m.runbook.description,
    steps: m.runbook.steps,
    match_score: m.score,
  }));
}

function inferServiceFromTitle(title) {
  if (title.includes("api") || title.includes("gateway")) return "api-gateway";
  if (title.includes("database") || title.includes("connection pool") || title.includes("db ")) return "database";
  if (title.includes("cache") || title.includes("cdn")) return "infrastructure";
  if (title.includes("auth") || title.includes("sso") || title.includes("tls")) return "auth-service";
  if (title.includes("billing") || title.includes("payment")) return "billing-worker";
  if (title.includes("report") || title.includes("export")) return "reporting-engine";
  if (title.includes("webhook") || title.includes("notification")) return "notification-service";
  if (title.includes("queue") || title.includes("job") || title.includes("worker")) return "background-jobs";
  return "web-app";
}
