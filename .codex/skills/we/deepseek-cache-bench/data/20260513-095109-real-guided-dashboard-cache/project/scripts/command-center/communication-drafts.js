// Communication drafts — generates status-page updates and customer emails
// based on incident state, severity, and impacted accounts.

const NOW = Date.now();

export function generateStatusUpdate(incident, timeline, route, blast) {
  const elapsedM = Math.round((NOW - incident.opened_at) / 60000);
  const elapsedStr = elapsedM < 60 ? `${elapsedM}m` : `${Math.floor(elapsedM / 60)}h ${elapsedM % 60}m`;
  const severityLabel = { sev0: "Major Outage", sev1: "Partial Outage", sev2: "Degraded Performance", sev3: "Minor Issue" };

  let update;
  switch (incident.status) {
    case "investigating":
      update = {
        title: `[Investigating] ${severityLabel[incident.severity] || "Incident"}: ${incident.title}`,
        severity: incident.severity,
        body: `We are currently investigating ${incident.severity === "sev0" ? "a major outage" : "an issue"} affecting ${incident.title.toLowerCase()}. ` +
              `${blast ? `Approximately ${blast.impacted_account_count} accounts may be impacted. ` : ""}` +
              `Our ${route ? route.team : "engineering"} team is actively investigating. ` +
              `Next update in ${incident.severity === "sev0" ? "30" : "60"} minutes.`,
        status: "investigating",
      };
      break;
    case "mitigating":
      update = {
        title: `[Mitigating] ${severityLabel[incident.severity] || "Incident"}: ${incident.title}`,
        severity: incident.severity,
        body: `We have identified the root cause and are applying a mitigation. ` +
              `Services are beginning to recover. We expect full resolution within the next hour. ` +
              `We will continue to monitor and provide updates.`,
        status: "mitigating",
      };
      break;
    case "resolved":
    case "closed":
      update = {
        title: `[Resolved] ${severityLabel[incident.severity] || "Incident"}: ${incident.title}`,
        severity: incident.severity,
        body: `This incident has been resolved. Services are fully operational. ` +
              `Duration: ${elapsedStr}. A postmortem will be published within 5 business days.`,
        status: "resolved",
      };
      break;
    default:
      update = {
        title: `[Update] ${incident.title}`,
        severity: incident.severity,
        body: `We continue to work on this incident. Further updates to follow.`,
        status: incident.status,
      };
  }

  update.timestamp = NOW;
  update.elapsed = elapsedStr;

  return update;
}

export function generateCustomerCommunication(incident, account, blast) {
  const isImpacted = blast && blast.top_impacted.some(a => a.id === account.id);
  const severityLabel = { sev0: "critical", sev1: "major", sev2: "minor", sev3: "informational" };

  const templates = {
    sev0: {
      subject: `[URGENT] Service disruption affecting your account — ${account.name}`,
      body: `Dear ${account.name} team,\n\n` +
            `We are experiencing a critical service disruption that may impact your account. ` +
            `Our engineering team is actively working to resolve this as our highest priority.\n\n` +
            `What this means for you: ${incident.title}\n` +
            `Estimated impact: Service may be unavailable or degraded\n\n` +
            `We will send updates every 30 minutes until resolved. You can track progress on our status page.\n\n` +
            `We sincerely apologize for the disruption.`,
    },
    sev1: {
      subject: `Service disruption notice — ${account.name}`,
      body: `Dear ${account.name} team,\n\n` +
            `We wanted to make you aware of a service disruption that may impact your account: ${incident.title}.\n\n` +
            `Our team is working on a resolution and we expect services to recover shortly.\n\n` +
            `We'll follow up with more details once the incident is resolved.`,
    },
    default: {
      subject: `Service update — ${account.name}`,
      body: `Dear ${account.name} team,\n\n` +
            `We are monitoring an incident: ${incident.title}. ` +
            `At this time, impact to your account is expected to be minimal.\n\n` +
            `We'll provide updates if the situation changes.`,
    },
  };

  const template = templates[incident.severity] || templates.default;
  return {
    type: "email",
    account_id: account.id,
    account_name: account.name,
    subject: template.subject,
    body: template.body,
    severity: severityLabel[incident.severity] || "informational",
    should_send: incident.severity === "sev0" || incident.severity === "sev1" || isImpacted,
    reason: incident.severity === "sev0" || incident.severity === "sev1"
      ? `Required for ${incident.severity} severity`
      : isImpacted ? "Account is directly impacted" : null,
  };
}

export function batchGenerateCustomerComms(incident, accounts, blast) {
  const comms = [];
  for (const a of (blast?.top_impacted || [])) {
    const fullAccount = accounts.find(ac => ac.id === a.id);
    if (fullAccount) {
      comms.push(generateCustomerCommunication(incident, fullAccount, blast));
    }
  }
  // Also generate for any account explicitly impacted
  if (blast && blast.top_impacted.length === 0 && incident.affected_accounts > 0) {
    // Generate a generic one
    const sampleAccount = accounts[0];
    if (sampleAccount) {
      const generic = generateCustomerCommunication(incident, sampleAccount, blast);
      generic.account_name = "Affected accounts";
      generic.account_id = null;
      generic.body = generic.body.replace(sampleAccount.name, "Valued customer");
      comms.push(generic);
    }
  }
  return comms;
}
