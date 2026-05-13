// Postmortem action extraction — generates follow-up tasks from resolved incidents.

export function extractPostmortemActions(incident, timelineSummary, runbooks, blast) {
  const actions = [];

  // Standard postmortem tasks
  actions.push({
    id: `pm_${incident.id}_write`,
    type: "documentation",
    title: `Write postmortem for ${incident.id}: ${incident.title}`,
    priority: incident.severity === "sev0" || incident.severity === "sev1" ? "high" : "medium",
    assignee_hint: "incident_commander",
    due_within_days: incident.severity === "sev0" ? 3 : 5,
    description: "Document timeline, root cause, impact, detection method, resolution, and preventative measures.",
  });

  // Action items from the runbook steps that weren't completed
  if (runbooks && runbooks.length > 0) {
    const rb = runbooks[0];
    // Suggest follow-up on steps that may need permanent fixes
    const permanentFixSteps = rb.steps.filter(s =>
      s.toLowerCase().includes("increase") ||
      s.toLowerCase().includes("scale") ||
      s.toLowerCase().includes("restart") ||
      s.toLowerCase().includes("kill") ||
      s.toLowerCase().includes("purge") ||
      s.toLowerCase().includes("rollback")
    );
    for (const step of permanentFixSteps.slice(0, 3)) {
      actions.push({
        id: `pm_${incident.id}_fix_${actions.length}`,
        type: "permanent_fix",
        title: `Permanent fix from runbook: ${step.slice(0, 80)}${step.length > 80 ? "..." : ""}`,
        priority: incident.severity === "sev0" ? "high" : "medium",
        assignee_hint: "engineering",
        due_within_days: 7,
        description: `During ${incident.id}, the runbook step "${step}" was executed as a mitigation. Implement a permanent fix to prevent recurrence.`,
      });
    }
  }

  // Monitoring improvements
  actions.push({
    id: `pm_${incident.id}_monitor`,
    type: "monitoring",
    title: `Add monitoring alert for ${incident.title.slice(0, 60)}`,
    priority: "medium",
    assignee_hint: "platform",
    due_within_days: 14,
    description: `Ensure monitoring can detect this failure mode before customer impact. Add alerting thresholds based on incident characteristics.`,
  });

  // Communication follow-up for impacted customers
  if (blast && blast.impacted_account_count > 0) {
    actions.push({
      id: `pm_${incident.id}_comms`,
      type: "communication",
      title: `Follow up with ${blast.impacted_account_count} impacted accounts`,
      priority: incident.severity === "sev0" ? "high" : "medium",
      assignee_hint: "cs_team",
      due_within_days: 2,
      description: `Send personalized follow-up to impacted accounts explaining resolution and preventative measures taken.`,
    });
  }

  // If there were gaps in the timeline, suggest process improvement
  if (timelineSummary && timelineSummary.has_gaps) {
    actions.push({
      id: `pm_${incident.id}_process`,
      type: "process",
      title: "Review incident communication gaps",
      priority: "low",
      assignee_hint: "incident_commander",
      due_within_days: 14,
      description: `Timeline had ${timelineSummary.gaps ? timelineSummary.gaps.length : 0} gaps exceeding 30 minutes. Review whether communication cadence needs process adjustment.`,
    });
  }

  // SLA remediation if breached
  if (incident.duration_m != null) {
    const slaTargets = { sev0: 60, sev1: 240, sev2: 480, sev3: 1440 };
    const target = slaTargets[incident.severity] || 480;
    if (incident.duration_m > target) {
      actions.push({
        id: `pm_${incident.id}_sla`,
        type: "sla_review",
        title: `SLA breach review: ${incident.severity} incident exceeded ${target}m target`,
        priority: "medium",
        assignee_hint: "engineering_manager",
        due_within_days: 5,
        description: `Incident took ${incident.duration_m}m vs ${target}m SLA target. Review root causes and identify process improvements.`,
      });
    }
  }

  return actions;
}

export function batchExtractActions(incidents, timelineSummaries, runbookMap, blastMap) {
  const allActions = [];
  for (const inc of incidents) {
    if (inc.status !== "resolved" && inc.status !== "closed") continue;
    const actions = extractPostmortemActions(
      inc,
      timelineSummaries[inc.id] || null,
      runbookMap[inc.id] || [],
      blastMap[inc.id] || null
    );
    allActions.push({ incident_id: inc.id, incident_title: inc.title, actions });
  }
  return allActions;
}

export function postmortemSummary(actionResults) {
  const byType = {};
  const byPriority = { high: 0, medium: 0, low: 0 };
  let totalActions = 0;

  for (const result of actionResults) {
    for (const action of result.actions) {
      byType[action.type] = (byType[action.type] || 0) + 1;
      byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
      totalActions++;
    }
  }

  return {
    total_incidents_reviewed: actionResults.length,
    total_actions: totalActions,
    byType,
    byPriority,
    overdue: 0, // computed from due dates if available
  };
}
