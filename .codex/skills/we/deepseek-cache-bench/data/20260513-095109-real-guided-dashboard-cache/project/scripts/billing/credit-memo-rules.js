// Credit-memo approval rules — evaluates credit memo requests against policy.

export function evaluateCreditMemo(request, account, invoices, paymentHistory) {
  const rules = [];
  let approvalScore = 0;
  let decision = "pending";

  // Rule 1: Amount vs MRR
  const mrrRatio = account.mrr > 0 ? request.amount / account.mrr : 999;
  if (mrrRatio <= 0.5) {
    approvalScore += 30;
    rules.push({ rule: "amount_vs_mrr", result: "pass", detail: `Credit ≤ 50% MRR (${(mrrRatio * 100).toFixed(0)}%)` });
  } else if (mrrRatio <= 1.0) {
    approvalScore += 15;
    rules.push({ rule: "amount_vs_mrr", result: "warn", detail: `Credit 50-100% MRR (${(mrrRatio * 100).toFixed(0)}%)` });
  } else {
    rules.push({ rule: "amount_vs_mrr", result: "fail", detail: `Credit > 100% MRR (${(mrrRatio * 100).toFixed(0)}%)` });
  }

  // Rule 2: Reason category
  const validReasons = ["service_outage", "billing_error", "sla_breach", "goodwill", "customer_satisfaction"];
  if (validReasons.includes(request.reason_category)) {
    approvalScore += 25;
    rules.push({ rule: "valid_reason", result: "pass", detail: `Reason: ${request.reason_category}` });
  } else {
    approvalScore += 5;
    rules.push({ rule: "valid_reason", result: "warn", detail: `Reason: ${request.reason_category || "unspecified"}` });
  }

  // Rule 3: Account health — at-risk accounts get more lenient treatment
  if (account.health === "at_risk") {
    approvalScore += 15;
    rules.push({ rule: "account_health", result: "pass", detail: "At-risk account — retention priority" });
  } else if (account.health === "churned") {
    approvalScore -= 10;
    rules.push({ rule: "account_health", result: "warn", detail: "Churned account — verify necessity" });
  }

  // Rule 4: Payment history — good payers get faster approval
  const history = paymentHistory[account.id] || {};
  const lateRatio = history.total_invoices > 0 ? (history.late_payments || 0) / history.total_invoices : 0;
  if (lateRatio < 0.2 && history.total_invoices >= 3) {
    approvalScore += 20;
    rules.push({ rule: "payment_history", result: "pass", detail: "Good payment history" });
  } else if (lateRatio > 0.5) {
    approvalScore -= 5;
    rules.push({ rule: "payment_history", result: "warn", detail: "Poor payment history" });
  }

  // Rule 5: Supporting incident/ticket link
  if (request.linked_incident_id || request.linked_ticket_id) {
    approvalScore += 10;
    rules.push({ rule: "linked_evidence", result: "pass", detail: "Linked to incident or ticket" });
  }

  // Decision
  if (approvalScore >= 60) {
    decision = request.amount <= account.mrr * 0.5 ? "auto_approve" : "approve_with_review";
  } else if (approvalScore >= 35) {
    decision = "manager_review";
  } else {
    decision = "deny";
  }

  const requiresApproval = decision !== "auto_approve";
  const approverLevel = decision === "auto_approve" ? "none" : decision === "approve_with_review" ? "team_lead" : decision === "manager_review" ? "manager" : "director";

  return {
    request_id: request.id,
    account_name: account.name,
    amount: request.amount,
    decision,
    approval_score: approvalScore,
    requires_approval: requiresApproval,
    approver_level: approverLevel,
    rules,
    recommendation: decision === "auto_approve"
      ? "Auto-approved — within policy thresholds"
      : decision === "deny"
        ? "Denied — does not meet policy requirements"
        : `Requires ${approverLevel} approval`,
  };
}

export function batchEvaluate(requests, accounts, invoices, paymentHistory) {
  return requests.map(req => {
    const account = accounts.find(a => a.id === req.account_id);
    if (!account) return null;
    return evaluateCreditMemo(req, account, invoices, paymentHistory);
  }).filter(Boolean);
}

export function creditMemoSummary(evaluations) {
  const byDecision = {};
  let totalAmount = 0;
  for (const ev of evaluations) {
    byDecision[ev.decision] = (byDecision[ev.decision] || 0) + 1;
    totalAmount += ev.amount;
  }
  return {
    total_requests: evaluations.length,
    total_amount: totalAmount,
    byDecision,
    auto_approved: byDecision.auto_approve || 0,
    needs_review: (byDecision.approve_with_review || 0) + (byDecision.manager_review || 0),
    denied: byDecision.deny || 0,
  };
}
