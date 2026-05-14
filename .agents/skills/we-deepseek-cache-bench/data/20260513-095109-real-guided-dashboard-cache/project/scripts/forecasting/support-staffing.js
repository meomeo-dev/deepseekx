// Support staffing forecast — projects ticket volume and needed headcount.

const DAY = 86400000;

export function projectSupportLoad(tickets, accounts, assumptions) {
  const now = Date.now();
  const monthlyTickets = {};
  for (const t of tickets) {
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyTickets[key]) monthlyTickets[key] = 0;
    monthlyTickets[key]++;
  }

  const months = Object.entries(monthlyTickets).sort((a, b) => a[0].localeCompare(b[0]));
  const recent = months.slice(-6);
  const avgTickets = recent.reduce((s, [, c]) => s + c, 0) / (recent.length || 1);

  const accountGrowthRate = assumptions?.account_growth_rate || 0.015;
  const ticketsPerAccount = assumptions?.tickets_per_account || avgTickets / (accounts.filter(a => a.health !== "churned").length || 1);

  const forecast = [];
  let activeAccounts = accounts.filter(a => a.health !== "churned").length;
  let totalTickets = 0;

  for (let m = 0; m < 12; m++) {
    activeAccounts = Math.round(activeAccounts * (1 + accountGrowthRate));
    const projectedTickets = Math.round(activeAccounts * ticketsPerAccount);
    totalTickets += projectedTickets;

    // Staffing: 1 agent handles ~150 tickets/month
    const agentsNeeded = Math.ceil(projectedTickets / 150);
    const currentAgents = assumptions?.current_agents || Math.ceil(avgTickets / 150);
    const hiringNeeded = Math.max(0, agentsNeeded - currentAgents);

    forecast.push({
      month: m + 1,
      date: new Date(now + m * 30 * DAY).toISOString().slice(0, 7),
      projected_tickets: projectedTickets,
      active_accounts: activeAccounts,
      agents_needed: agentsNeeded,
      current_agents: currentAgents,
      hiring_needed: hiringNeeded,
    });
  }

  return {
    monthly: forecast,
    total_12m_tickets: totalTickets,
    avg_monthly_tickets: Math.round(totalTickets / 12),
    peak_agents_needed: Math.max(...forecast.map(f => f.agents_needed)),
    total_hiring_needed: Math.max(0, Math.max(...forecast.map(f => f.agents_needed)) - (assumptions?.current_agents || 0)),
  };
}

export function supportLoadByPriority(tickets) {
  const now = Date.now();
  const recent = tickets.filter(t => t.created_at > now - 90 * DAY);
  const byPriority = {};
  for (const t of recent) {
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
  }
  const total = recent.length || 1;
  return Object.entries(byPriority).map(([priority, count]) => ({
    priority,
    count,
    pct: parseFloat((count / total * 100).toFixed(1)),
  }));
}
