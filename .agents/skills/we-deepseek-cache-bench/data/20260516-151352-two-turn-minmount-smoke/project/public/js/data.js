// Revenue Command Center — Structured Data Layer (Round 1)
// All business data lives here, separated from DOM/rendering concerns.

const DATA = (() => {
  // ---- Accounts ----
  const accounts = [
    { id: 'acct-001', name: 'MegaCorp Industries', tier: 'Enterprise', arr: 1240000, domain: 'Manufacturing', healthScore: 34, csm: 'Alice Chen', joinDate: '2020-03-15' },
    { id: 'acct-002', name: 'FinBridge Capital', tier: 'Enterprise', arr: 890000, domain: 'Financial Services', healthScore: 82, csm: 'Bob Ruiz', joinDate: '2019-07-01' },
    { id: 'acct-003', name: 'CloudNest SaaS', tier: 'Mid-Market', arr: 345000, domain: 'Technology', healthScore: 28, csm: 'Alice Chen', joinDate: '2021-11-10' },
    { id: 'acct-004', name: 'RetailMax Group', tier: 'Enterprise', arr: 750000, domain: 'Retail', healthScore: 55, csm: 'Diana Park', joinDate: '2018-05-22' },
    { id: 'acct-005', name: 'HealthSync Plus', tier: 'Mid-Market', arr: 295000, domain: 'Healthcare', healthScore: 41, csm: 'Bob Ruiz', joinDate: '2022-01-30' },
    { id: 'acct-006', name: 'EduPrime Network', tier: 'SMB', arr: 98000, domain: 'Education', healthScore: 72, csm: 'Diana Park', joinDate: '2023-06-14' },
    { id: 'acct-007', name: 'LogiTrack Global', tier: 'Enterprise', arr: 620000, domain: 'Logistics', healthScore: 18, csm: 'Alice Chen', joinDate: '2020-08-05' },
    { id: 'acct-008', name: 'MediaFusion Co', tier: 'Mid-Market', arr: 210000, domain: 'Media', healthScore: 63, csm: 'Bob Ruiz', joinDate: '2022-09-19' },
    { id: 'acct-009', name: 'SecureVault Systems', tier: 'Enterprise', arr: 1100000, domain: 'Cybersecurity', healthScore: 91, csm: 'Diana Park', joinDate: '2017-02-10' },
    { id: 'acct-010', name: 'GreenField Energy', tier: 'Mid-Market', arr: 275000, domain: 'Energy', healthScore: 22, csm: 'Alice Chen', joinDate: '2023-01-05' },
    { id: 'acct-011', name: 'ApexLegal Partners', tier: 'SMB', arr: 112000, domain: 'Legal', healthScore: 48, csm: 'Bob Ruiz', joinDate: '2023-09-01' },
    { id: 'acct-012', name: 'QuantumLeap AI', tier: 'Mid-Market', arr: 420000, domain: 'Technology', healthScore: 11, csm: 'Diana Park', joinDate: '2024-02-28' },
  ];

  // ---- Renewals ----
  const renewals = [
    { id: 'rnw-001', accountId: 'acct-001', contractEnd: '2026-06-30', status: 'At Risk', amount: 1240000, riskFlags: ['No engagement', 'Champion left'] },
    { id: 'rnw-002', accountId: 'acct-003', contractEnd: '2026-07-15', status: 'At Risk', amount: 345000, riskFlags: ['Usage decline', 'Budget cut'] },
    { id: 'rnw-003', accountId: 'acct-007', contractEnd: '2026-05-30', status: 'Critical', amount: 620000, riskFlags: ['Executive disengaged', 'Competitor eval'] },
    { id: 'rnw-004', accountId: 'acct-010', contractEnd: '2026-06-15', status: 'At Risk', amount: 275000, riskFlags: ['Low adoption', 'Support complaints'] },
    { id: 'rnw-005', accountId: 'acct-012', contractEnd: '2026-05-25', status: 'Critical', amount: 420000, riskFlags: ['No POC contact', 'Silent on outreach'] },
    { id: 'rnw-006', accountId: 'acct-002', contractEnd: '2026-12-01', status: 'Healthy', amount: 890000, riskFlags: [] },
    { id: 'rnw-007', accountId: 'acct-009', contractEnd: '2027-01-15', status: 'Healthy', amount: 1100000, riskFlags: [] },
    { id: 'rnw-008', accountId: 'acct-004', contractEnd: '2026-09-01', status: 'Pending', amount: 750000, riskFlags: ['Negotiating discount'] },
  ];

  // ---- Billing ----
  const invoices = [
    { id: 'inv-001', accountId: 'acct-001', number: 'INV-2026-0501', amount: 103333, dueDate: '2026-05-01', status: 'Overdue', daysOverdue: 15 },
    { id: 'inv-002', accountId: 'acct-007', number: 'INV-2026-0401', amount: 51666, dueDate: '2026-04-01', status: 'Overdue', daysOverdue: 45 },
    { id: 'inv-003', accountId: 'acct-012', number: 'INV-2026-0428', amount: 35000, dueDate: '2026-04-28', status: 'Overdue', daysOverdue: 18 },
    { id: 'inv-004', accountId: 'acct-003', number: 'INV-2026-0510', amount: 28750, dueDate: '2026-05-10', status: 'Pending', daysOverdue: 6 },
    { id: 'inv-005', accountId: 'acct-005', number: 'INV-2026-0505', amount: 24583, dueDate: '2026-05-05', status: 'Overdue', daysOverdue: 11 },
    { id: 'inv-006', accountId: 'acct-002', number: 'INV-2026-0515', amount: 74166, dueDate: '2026-05-15', status: 'Paid', daysOverdue: 0 },
    { id: 'inv-007', accountId: 'acct-009', number: 'INV-2026-0515', amount: 91666, dueDate: '2026-05-15', status: 'Paid', daysOverdue: 0 },
    { id: 'inv-008', accountId: 'acct-010', number: 'INV-2026-0508', amount: 22916, dueDate: '2026-05-08', status: 'Overdue', daysOverdue: 8 },
  ];

  // ---- Support ----
  const tickets = [
    { id: 'tkt-001', accountId: 'acct-001', subject: 'API integration failing on v4.2', severity: 'P1', status: 'Open', created: '2026-05-10', slaDeadline: '2026-05-14', assignee: 'Eng Team' },
    { id: 'tkt-002', accountId: 'acct-007', subject: 'Data export timeout for >100k rows', severity: 'P1', status: 'Open', created: '2026-05-08', slaDeadline: '2026-05-12', assignee: 'Eng Team' },
    { id: 'tkt-003', accountId: 'acct-012', subject: 'SSO configuration broken after upgrade', severity: 'P1', status: 'Open', created: '2026-05-14', slaDeadline: '2026-05-18', assignee: 'Eng Team' },
    { id: 'tkt-004', accountId: 'acct-003', subject: 'Dashboard loading slowly (15s+)', severity: 'P2', status: 'Open', created: '2026-05-12', slaDeadline: '2026-05-19', assignee: 'Support' },
    { id: 'tkt-005', accountId: 'acct-005', subject: 'Billing discrepancy on March invoice', severity: 'P2', status: 'Open', created: '2026-05-09', slaDeadline: '2026-05-16', assignee: 'Billing' },
    { id: 'tkt-006', accountId: 'acct-010', subject: 'Unable to add new team members', severity: 'P2', status: 'Open', created: '2026-05-11', slaDeadline: '2026-05-18', assignee: 'Support' },
    { id: 'tkt-007', accountId: 'acct-004', subject: 'Feature request: bulk edit', severity: 'P3', status: 'Open', created: '2026-04-28', slaDeadline: '2026-05-12', assignee: 'Product' },
    { id: 'tkt-008', accountId: 'acct-012', subject: 'Two users locked out after password reset', severity: 'P2', status: 'In Progress', created: '2026-05-13', slaDeadline: '2026-05-20', assignee: 'Support' },
    { id: 'tkt-009', accountId: 'acct-001', subject: 'Webhook delivery failures intermittent', severity: 'P2', status: 'In Progress', created: '2026-05-06', slaDeadline: '2026-05-13', assignee: 'Eng Team' },
    { id: 'tkt-010', accountId: 'acct-002', subject: 'Minor UI glitch on reports page', severity: 'P3', status: 'Resolved', created: '2026-05-01', slaDeadline: '2026-05-08', assignee: 'Support' },
  ];

  // ---- Usage ----
  const usage = [
    { id: 'use-001', accountId: 'acct-001', product: 'Core Platform', activeUsers: 142, prevActiveUsers: 210, trend: 'down', lastActive: '2026-05-15' },
    { id: 'use-002', accountId: 'acct-007', product: 'Core Platform', activeUsers: 18, prevActiveUsers: 95, trend: 'down', lastActive: '2026-05-08' },
    { id: 'use-003', accountId: 'acct-012', product: 'Analytics Suite', activeUsers: 5, prevActiveUsers: 48, trend: 'down', lastActive: '2026-04-30' },
    { id: 'use-004', accountId: 'acct-003', product: 'Core Platform', activeUsers: 67, prevActiveUsers: 112, trend: 'down', lastActive: '2026-05-14' },
    { id: 'use-005', accountId: 'acct-010', product: 'Core Platform', activeUsers: 29, prevActiveUsers: 55, trend: 'down', lastActive: '2026-05-09' },
    { id: 'use-006', accountId: 'acct-002', product: 'Core Platform', activeUsers: 340, prevActiveUsers: 325, trend: 'up', lastActive: '2026-05-15' },
    { id: 'use-007', accountId: 'acct-009', product: 'Core Platform', activeUsers: 445, prevActiveUsers: 430, trend: 'up', lastActive: '2026-05-15' },
    { id: 'use-008', accountId: 'acct-004', product: 'Core Platform', activeUsers: 198, prevActiveUsers: 205, trend: 'flat', lastActive: '2026-05-14' },
  ];

  // ---- Incidents ----
  const incidents = [
    { id: 'inc-001', accountId: 'acct-001', title: 'API latency spike — 2.3s avg', severity: 'P2', status: 'Investigating', started: '2026-05-15T14:30:00Z', services: ['API Gateway', 'Auth'] },
    { id: 'inc-002', accountId: 'acct-007', title: 'Database replica lag — 45 min behind', severity: 'P1', status: 'Open', started: '2026-05-14T09:00:00Z', services: ['Database', 'Reporting'] },
    { id: 'inc-003', accountId: 'acct-012', title: 'File storage degraded — uploads failing 15%', severity: 'P1', status: 'Open', started: '2026-05-15T08:00:00Z', services: ['Storage', 'CDN'] },
    { id: 'inc-004', accountId: 'acct-003', title: 'Email delivery delay — 20 min queue', severity: 'P3', status: 'Monitoring', started: '2026-05-13T11:00:00Z', services: ['Email Service'] },
    { id: 'inc-005', accountId: 'acct-009', title: 'Scheduled maintenance window', severity: 'P4', status: 'Scheduled', started: '2026-05-20T02:00:00Z', services: ['Core Platform'] },
  ];

  // ---- Derived: per-account risk profile ----
  function buildAccountRiskProfile(acct) {
    const acctRenewals = renewals.filter(r => r.accountId === acct.id);
    const acctInvoices = invoices.filter(i => i.accountId === acct.id);
    const acctTickets  = tickets.filter(t => t.accountId === acct.id);
    const acctUsage    = usage.filter(u => u.accountId === acct.id);
    const acctIncidents = incidents.filter(i => i.accountId === acct.id);

    const renewalRisk = acctRenewals.filter(r => r.status === 'At Risk' || r.status === 'Critical').length;
    const billingRisk = acctInvoices.filter(i => i.status === 'Overdue').length;
    const supportRisk = acctTickets.filter(t => (t.severity === 'P1' || t.severity === 'P2') && t.status !== 'Resolved').length;
    const usageRisk   = acctUsage.filter(u => u.trend === 'down').length;
    const incidentRisk = acctIncidents.filter(i => i.status !== 'Resolved' && i.status !== 'Scheduled').length;

    const totalRisks = renewalRisk + billingRisk + supportRisk + usageRisk + incidentRisk;
    const riskLevel = totalRisks >= 4 ? 'critical' : totalRisks >= 2 ? 'high' : totalRisks >= 1 ? 'medium' : 'low';

    return {
      accountId: acct.id,
      riskLevel,
      totalRisks,
      domains: {
        renewals: renewalRisk,
        billing:  billingRisk,
        support:  supportRisk,
        usage:    usageRisk,
        incidents: incidentRisk,
      },
      openRenewals: acctRenewals,
      unpaidInvoices: acctInvoices.filter(i => i.status !== 'Paid'),
      openTickets: acctTickets.filter(t => t.status !== 'Resolved'),
      usageRecords: acctUsage,
      activeIncidents: acctIncidents.filter(i => i.status !== 'Resolved'),
    };
  }

  const riskProfiles = accounts.map(buildAccountRiskProfile);

  // ---- Top-level metrics ----
  function computeMetrics() {
    const totalARR = accounts.reduce((s, a) => s + a.arr, 0);
    const atRiskARR = renewals
      .filter(r => r.status === 'At Risk' || r.status === 'Critical')
      .reduce((s, r) => s + r.amount, 0);
    const overdueCount = invoices.filter(i => i.status === 'Overdue').length;
    const overdueAmount = invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0);
    const openTicketsCount = tickets.filter(t => t.status !== 'Resolved').length;
    const openP1Tickets = tickets.filter(t => t.severity === 'P1' && t.status !== 'Resolved').length;
    const activeIncidentsCount = incidents.filter(i => i.status !== 'Resolved' && i.status !== 'Scheduled').length;
    const accountsAtRisk = riskProfiles.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length;
    const healthyAccounts = riskProfiles.filter(p => p.riskLevel === 'low').length;
    const renewalCount = renewals.filter(r => r.status === 'At Risk' || r.status === 'Critical').length;

    return {
      totalARR,
      atRiskARR,
      overdueCount,
      overdueAmount,
      openTicketsCount,
      openP1Tickets,
      activeIncidentsCount,
      accountsAtRisk,
      healthyAccounts,
      renewalCount,
      totalAccounts: accounts.length,
    };
  }

  // ---- Playbooks: risk-pattern response guides ----
  const playbooks = [
    { id: "pb-001", domain: "renewals", riskPattern: "renewal_critical", title: "Executive Save Play",
      steps: ["Schedule exec-to-exec call within 48h", "Prepare retention offer with 10-15% discount", "Escalate to VP Customer Success", "Draft mutual success plan"],
      impactLabel: "Revenue at risk" },
    { id: "pb-002", domain: "renewals", riskPattern: "renewal_at_risk", title: "Engagement Recovery",
      steps: ["Reach out to champion within 5 business days", "Schedule product health review", "Identify adoption gaps and propose training", "Offer quarterly business review"],
      impactLabel: "Revenue at risk" },
    { id: "pb-003", domain: "billing", riskPattern: "invoice_overdue", title: "Payment Recovery",
      steps: ["Send payment reminder with invoice copy", "Call finance contact within 3 days", "Offer payment plan if >30d overdue", "Flag for collections review at 60d"],
      impactLabel: "Outstanding amount" },
    { id: "pb-004", domain: "support", riskPattern: "support_p1", title: "P1 Escalation Protocol",
      steps: ["Acknowledge within SLA window", "Assign dedicated engineer", "Post hourly status updates to customer", "Root cause analysis within 48h of resolution"],
      impactLabel: "SLA status" },
    { id: "pb-005", domain: "usage", riskPattern: "usage_decline", title: "Adoption Rescue",
      steps: ["Analyze feature usage drop-off points", "Schedule training session for key users", "Identify champion and re-engage", "Set 30-day usage recovery target"],
      impactLabel: "Active users" },
    { id: "pb-006", domain: "incidents", riskPattern: "incident_active", title: "Incident Response",
      steps: ["Confirm incident severity and scope", "Post public status update within 30 min", "Engage on-call engineering lead", "Provide post-mortem within 5 business days"],
      impactLabel: "Services affected" },
  ];

  // ---- Actions Queue: derived concrete tasks ----
  function buildActions() {
    const actions = [];
    let seq = 1;

    // Renewal actions
    renewals.forEach(r => {
      if (r.status === "Critical" || r.status === "At Risk") {
        const acct = accounts.find(a => a.id === r.accountId);
        actions.push({
          id: "act-" + String(seq++).padStart(3, "0"),
          accountId: r.accountId,
          accountName: acct ? acct.name : "",
          domain: "renewals",
          title: "Save renewal for " + (acct ? acct.name : r.accountId),
          description: "Contract ends " + r.contractEnd + ". Status: " + r.status + ". " + r.riskFlags.join("; ") + ".",
          owner: acct ? acct.csm : "Unassigned",
          dueDate: r.contractEnd,
          impact: r.amount,
          status: "pending",
          sourceId: r.id,
          playbookId: r.status === "Critical" ? "pb-001" : "pb-002",
        });
      }
    });

    // Billing actions
    invoices.forEach(inv => {
      if (inv.status === "Overdue") {
        const acct = accounts.find(a => a.id === inv.accountId);
        actions.push({
          id: "act-" + String(seq++).padStart(3, "0"),
          accountId: inv.accountId,
          accountName: acct ? acct.name : "",
          domain: "billing",
          title: "Collect overdue invoice " + inv.number,
          description: inv.daysOverdue + " days overdue. Amount: " + Utils.fmtCurrency(inv.amount) + ".",
          owner: acct ? acct.csm : "Unassigned",
          dueDate: inv.dueDate,
          impact: inv.amount,
          status: "pending",
          sourceId: inv.id,
          playbookId: "pb-003",
        });
      }
    });

    // Support actions — P1 only
    tickets.forEach(t => {
      if (t.severity === "P1" && t.status !== "Resolved") {
        const acct = accounts.find(a => a.id === t.accountId);
        actions.push({
          id: "act-" + String(seq++).padStart(3, "0"),
          accountId: t.accountId,
          accountName: acct ? acct.name : "",
          domain: "support",
          title: "Escalate P1 ticket: " + t.subject,
          description: "SLA deadline: " + t.slaDeadline + ". Current status: " + t.status + ". Assignee: " + t.assignee + ".",
          owner: t.assignee,
          dueDate: t.slaDeadline,
          impact: 0,
          status: "pending",
          sourceId: t.id,
          playbookId: "pb-004",
        });
      }
    });

    // Usage actions
    usage.forEach(u => {
      if (u.trend === "down") {
        const acct = accounts.find(a => a.id === u.accountId);
        const pctDrop = u.prevActiveUsers > 0 ? Math.round((1 - u.activeUsers / u.prevActiveUsers) * 100) : 0;
        actions.push({
          id: "act-" + String(seq++).padStart(3, "0"),
          accountId: u.accountId,
          accountName: acct ? acct.name : "",
          domain: "usage",
          title: "Address usage drop in " + u.product,
          description: "Active users dropped " + pctDrop + "% (" + u.prevActiveUsers + " → " + u.activeUsers + "). Last active: " + u.lastActive + ".",
          owner: acct ? acct.csm : "Unassigned",
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          impact: acct ? acct.arr : 0,
          status: "pending",
          sourceId: u.id,
          playbookId: "pb-005",
        });
      }
    });

    // Incident actions
    incidents.forEach(inc => {
      if (inc.status !== "Resolved" && inc.status !== "Scheduled") {
        const acct = accounts.find(a => a.id === inc.accountId);
        actions.push({
          id: "act-" + String(seq++).padStart(3, "0"),
          accountId: inc.accountId,
          accountName: acct ? acct.name : "",
          domain: "incidents",
          title: "Resolve incident: " + inc.title,
          description: "Severity: " + inc.severity + ". Status: " + inc.status + ". Affected: " + inc.services.join(", ") + ".",
          owner: "Eng Team",
          dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
          impact: 0,
          status: "pending",
          sourceId: inc.id,
          playbookId: "pb-006",
        });
      }
    });

    return actions;
  }

  let _actionsCache = null;
  function getActions() {
    if (!_actionsCache) _actionsCache = buildActions();
    return _actionsCache;
  }

  function updateActionStatus(actionId, newStatus) {
    const actions = getActions();
    const act = actions.find(a => a.id === actionId);
    if (act) act.status = newStatus;
  }

  function getPlaybook(id) {
    return playbooks.find(p => p.id === id);
  }

  function getPlaybooksForAccount(acctId) {
    const profile = riskProfiles.find(p => p.accountId === acctId);
    if (!profile) return [];
    const pbs = [];
    if (profile.domains.renewals > 0) pbs.push(playbooks.find(p => p.id === "pb-001") || playbooks.find(p => p.id === "pb-002"));
    if (profile.domains.billing > 0) pbs.push(playbooks.find(p => p.id === "pb-003"));
    if (profile.domains.support > 0) pbs.push(playbooks.find(p => p.id === "pb-004"));
    if (profile.domains.usage > 0) pbs.push(playbooks.find(p => p.id === "pb-005"));
    if (profile.domains.incidents > 0) pbs.push(playbooks.find(p => p.id === "pb-006"));
    return pbs.filter(Boolean);
  }


  return {
    accounts,
    renewals,
    invoices,
    tickets,
    usage,
    incidents,
    riskProfiles,
    getMetrics: computeMetrics,
    getAccountById: (id) => accounts.find(a => a.id === id),
    getRiskProfile: (id) => riskProfiles.find(p => p.accountId === id),
    getActions,
    updateActionStatus,
    getPlaybook,
    getPlaybooks: playbooks,
    getPlaybooksForAccount,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DATA };
}
