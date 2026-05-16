// Revenue Command Center — UI Components

const Components = (() => {
  function renderMetric(label, value, sub, cls) {
    const clsAttr = cls ? ` class="${cls}"` : '';
    const valCls = cls && (cls === 'warn' || cls === 'danger') ? ` class="${cls}"` : '';
    return `
      <div class="metric-card${clsAttr}">
        <div class="metric-label">${label}</div>
        <div class="metric-value${valCls}">${value}</div>
        ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
      </div>`;
  }

  function renderMetricsRow(metrics) {
    return `
      ${renderMetric('Total ARR', Utils.fmtCurrency(metrics.totalARR), metrics.totalAccounts + ' accounts')}
      ${renderMetric('At-Risk ARR', Utils.fmtCurrency(metrics.atRiskARR), metrics.renewalCount + ' renewals at risk', 'warn')}
      ${renderMetric('Overdue Invoices', metrics.overdueCount, Utils.fmtCurrency(metrics.overdueAmount), metrics.overdueCount > 0 ? 'danger' : '')}
      ${renderMetric('Open Tickets', metrics.openTicketsCount, metrics.openP1Tickets + ' P1', metrics.openP1Tickets > 0 ? 'danger' : '')}
      ${renderMetric('Active Incidents', metrics.activeIncidentsCount, '', metrics.activeIncidentsCount > 0 ? 'danger' : '')}
      ${renderMetric('Accounts at Risk', metrics.accountsAtRisk, metrics.healthyAccounts + ' healthy', metrics.accountsAtRisk > 5 ? 'warn' : '')}
    `;
  }

  function renderRiskPills(profile) {
    if (profile.totalRisks === 0) {
      return '<span style="font-size:11px;color:var(--green)">No active risks</span>';
    }
    return Object.entries(profile.domains)
      .filter(([, count]) => count > 0)
      .map(([domain, count]) => `<span class="risk-pill ${domain}">${Utils.domainLabel(domain)} ${count}</span>`)
      .join('');
  }

  function renderAccountRow(acct, profile, expanded) {
    const scoreClass = Utils.scoreClass(acct.healthScore);
    const expClass = expanded ? ' expanded' : '';
    return `
      <div class="account-row${expClass}" data-account-id="${acct.id}">
        <div class="account-summary" data-action="toggle">
          <div>
            <div class="acct-name">${acct.name}</div>
            <div class="acct-tier">${acct.tier} · ${acct.domain} · CSM: ${acct.csm}</div>
          </div>
          <div class="acct-arr">${Utils.fmtCurrency(acct.arr)}</div>
          <div class="acct-score">
            <div class="health-bar-wrap"><div class="health-bar-fill ${scoreClass}" style="width:${acct.healthScore}%"></div></div>
            <span class="score-val">${acct.healthScore}</span>
          </div>
          <div style="text-align:center">
            <span class="risk-badge ${profile.riskLevel}">${Utils.riskLabel(profile.riskLevel)}</span>
          </div>
          <div class="risk-pills">${renderRiskPills(profile)}</div>
        </div>
        <div class="account-detail" data-panel="${acct.id}"></div>
      </div>`;
  }

  function renderAccountDetail(acct, profile) {
    const header = `
      <div class="detail-header">
        <h3>${acct.name} · ${acct.tier} · ${Utils.fmtCurrency(acct.arr)} ARR</h3>
        <div>
          <span class="risk-badge ${profile.riskLevel}">${Utils.riskLabel(profile.riskLevel)} Risk</span>
        </div>
      </div>`;

    // Renewals domain
    const renewalsHTML = profile.openRenewals.length === 0
      ? '<div class="empty-domain">No active renewals</div>'
      : profile.openRenewals.map(r => `
        <div class="domain-item">
          <span>Ends ${Utils.fmtDate(r.contractEnd)} · ${Utils.fmtCurrency(r.amount)}</span>
          <span class="status-tag ${r.status === 'Critical' ? 'critical' : r.status === 'At Risk' ? 'at-risk' : r.status.toLowerCase()}">${r.status}</span>
        </div>
        ${r.riskFlags.length ? `<div class="domain-item" style="font-size:10px;color:var(--text-muted)">⚠ ${r.riskFlags.join(' · ')}</div>` : ''}
      `).join('');

    // Billing domain
    const billingHTML = profile.unpaidInvoices.length === 0
      ? '<div class="empty-domain">All invoices paid</div>'
      : profile.unpaidInvoices.map(i => `
        <div class="domain-item">
          <span>${i.number} · ${Utils.fmtCurrency(i.amount)}</span>
          <span class="status-tag ${i.status.toLowerCase()}">${i.status} ${i.daysOverdue > 0 ? '(' + i.daysOverdue + 'd)' : ''}</span>
        </div>
      `).join('');

    // Support domain
    const supportHTML = profile.openTickets.length === 0
      ? '<div class="empty-domain">No open tickets</div>'
      : profile.openTickets.map(t => `
        <div class="domain-item">
          <span>${t.subject}</span>
          <span class="status-tag ${t.status === 'Open' ? 'open' : t.status.toLowerCase().replace(/\s+/g, '-')}">${t.severity} · ${t.status}</span>
        </div>
        <div class="domain-item" style="font-size:10px;color:var(--text-muted)">SLA ${Utils.fmtDate(t.slaDeadline)} · ${t.assignee}</div>
      `).join('');

    // Usage domain
    const usageHTML = profile.usageRecords.length === 0
      ? '<div class="empty-domain">No usage data</div>'
      : profile.usageRecords.map(u => {
          const change = u.activeUsers - u.prevActiveUsers;
          const changeStr = change >= 0 ? '+' + change : '' + change;
          const changeCls = u.trend === 'up' ? 'color:var(--green)' : u.trend === 'down' ? 'color:var(--red)' : 'color:var(--text-muted)';
          return `
          <div class="domain-item">
            <span>${u.product}</span>
            <span style="${changeCls};font-size:11px;">${changeStr} users</span>
          </div>
          <div class="domain-item" style="font-size:10px;color:var(--text-muted)">${u.activeUsers} active · last ${Utils.fmtDaysAgo(u.lastActive)}</div>
        `;
      }).join('');

    // Incidents domain
    const incidentsHTML = profile.activeIncidents.length === 0
      ? '<div class="empty-domain">No active incidents</div>'
      : profile.activeIncidents.map(i => `
        <div class="domain-item">
          <span>${i.title}</span>
          <span class="status-tag ${i.status.toLowerCase()}">${i.severity}</span>
        </div>
        <div class="domain-item" style="font-size:10px;color:var(--text-muted)">Started ${Utils.fmtDaysAgo(i.started)} · ${i.services.join(', ')}</div>
      `).join('');

    return header + `
      <div class="domain-grid">
        <div class="domain-card">
          <h4>📋 Renewals</h4>
          ${renewalsHTML}
        </div>
        <div class="domain-card">
          <h4>💳 Billing</h4>
          ${billingHTML}
        </div>
        <div class="domain-card">
          <h4>🎫 Support</h4>
          ${supportHTML}
        </div>
        <div class="domain-card">
          <h4>📊 Usage</h4>
          ${usageHTML}
        </div>
        <div class="domain-card">
          <h4>🚨 Incidents</h4>
          ${incidentsHTML}
        </div>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;">
        <button class="btn" data-action="close-detail" data-id="${acct.id}">Close</button>
      </div>`;
  }

  function renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>No accounts match your filters</p>
        <p class="empty-hint">Try adjusting the search term or removing filters.</p>
      </div>`;
  }

  function renderErrorState(message) {
    return `
      <div class="error-banner">
        <div class="error-title">⚠ Unable to load data</div>
        ${message}
      </div>`;
  }


  // ---- Actions Table ----
  function renderActionsTable(actions, opts) {
    if (!actions || actions.length === 0) {
      return '<div class="empty-state"><div class="empty-icon">✅</div><p>No actions match your filters</p><p class="empty-hint">Try changing the status or owner filter.</p></div>';
    }
    const rows = actions.map(a => {
      const domainLabel = Utils.domainLabel(a.domain);
      const impactStr = a.impact > 0 ? Utils.fmtCurrency(a.impact) : '—';
      const statusClass = a.status === 'completed' ? 'completed' : a.status === 'deferred' ? 'deferred' : 'pending';
      const statusLabel = a.status.charAt(0).toUpperCase() + a.status.slice(1);
      const dueDateStr = Utils.fmtDate(a.dueDate);
      const dueOverdue = a.status === 'pending' && a.dueDate < new Date().toISOString().slice(0,10) ? ' overdue' : '';
      return '<tr class="action-row" data-action-id="' + a.id + '">' +
        '<td class="act-domain"><span class="domain-dot ' + a.domain + '"></span>' + domainLabel + '</td>' +
        '<td class="act-title"><div class="act-title-text">' + a.title + '</div><div class="act-desc">' + a.description + '</div></td>' +
        '<td class="act-account">' + a.accountName + '</td>' +
        '<td class="act-owner">' + a.owner + '</td>' +
        '<td class="act-due' + dueOverdue + '">' + dueDateStr + '</td>' +
        '<td class="act-impact">' + impactStr + '</td>' +
        '<td><span class="action-status ' + statusClass + '">' + statusLabel + '</span></td>' +
        '<td class="act-btns">' + (a.status === 'pending' ?
          '<button class="btn-sm complete" data-action="complete-action" data-id="' + a.id + '">✓ Done</button>' +
          '<button class="btn-sm defer" data-action="defer-action" data-id="' + a.id + '">⏸ Defer</button>' :
          '<button class="btn-sm undo" data-action="undo-action" data-id="' + a.id + '">↩ Undo</button>') + '</td>' +
        '</tr>';
    }).join('');

    return '<div class="action-table-wrapper"><table class="action-table"><thead><tr>' +
      '<th>Domain</th><th>Action</th><th>Account</th><th>Owner</th><th>Due</th><th>Impact</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  // ---- Playbook Cards ----
  function renderPlaybookCards(accounts, profiles, playbooks, selectedAccountId) {
    var highRisk = profiles.filter(function(p) { return p.riskLevel === 'high' || p.riskLevel === 'critical'; });
    if (highRisk.length === 0) {
      return '<div class="empty-state"><div class="empty-icon">🎉</div><p>No high-risk accounts — all clear</p></div>';
    }

    return highRisk.map(function(p) {
      var acct = accounts.find(function(a) { return a.id === p.accountId; });
      if (!acct) return '';
      if (selectedAccountId && selectedAccountId !== 'all' && acct.id !== selectedAccountId) return '';

      var acctPlaybooks = DATA.getPlaybooksForAccount(acct.id);
      var actions = DATA.getActions().filter(function(a) { return a.accountId === acct.id && a.status === 'pending'; });
      var totalImpact = actions.reduce(function(s, a) { return s + a.impact; }, 0);

      return '<div class="playbook-card">' +
        '<div class="playbook-card-header">' +
          '<div><h3>' + acct.name + '</h3><div class="playbook-meta">' + acct.tier + ' · ' + Utils.fmtCurrency(acct.arr) + ' · CSM: ' + acct.csm + '</div></div>' +
          '<span class="risk-badge ' + p.riskLevel + '">' + Utils.riskLabel(p.riskLevel) + ' Risk</span>' +
        '</div>' +
        '<div class="playbook-body">' +
          '<div class="playbook-section"><h4>📋 Risk Summary</h4>' +
            '<div class="playbook-risk-grid">' +
              Object.entries(p.domains).filter(function(e) { return e[1] > 0; }).map(function(e) { return '<span class="risk-pill ' + e[0] + '">' + Utils.domainLabel(e[0]) + ': ' + e[1] + '</span>'; }).join('') +
            '</div></div>' +
          '<div class="playbook-section"><h4>🎯 Recommended Playbooks</h4>' +
            (acctPlaybooks.length === 0 ? '<p class="empty-domain">No relevant playbooks</p>' :
              acctPlaybooks.map(function(pb) {
                return '<div class="playbook-step-list"><div class="playbook-step-title">' + pb.title + '</div>' +
                  '<ol>' + pb.steps.map(function(s) { return '<li>' + s + '</li>'; }).join('') + '</ol></div>';
              }).join('')) +
          '</div>' +
          '<div class="playbook-section"><h4>📌 Open Actions (' + actions.length + ')</h4>' +
            (actions.length === 0 ? '<p class="empty-domain">All actions completed</p>' :
              actions.map(function(a) {
                return '<div class="playbook-action-item"><span class="domain-dot ' + a.domain + '"></span>' +
                  '<span>' + a.title + '</span>' +
                  '<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">' + Utils.fmtDate(a.dueDate) + ' · ' + a.owner + '</span></div>';
              }).join('')) +
          '</div>' +
          (totalImpact > 0 ? '<div class="playbook-impact">Total financial impact: <strong>' + Utils.fmtCurrency(totalImpact) + '</strong></div>' : '') +
        '</div></div>';
    }).join('');
  }

  // ---- Export Text ----
  function renderExportText(actions) {
    var header = 'Revenue Command Center — Actions Export\n' + new Date().toISOString().slice(0,10) + '\n' + '='.repeat(50) + '\n\n';
    var lines = actions.map(function(a) {
      return '[' + a.id + '] ' + Utils.domainLabel(a.domain) + ' | ' + a.status.toUpperCase() + '\n' +
        '  Account: ' + a.accountName + '\n' +
        '  Action:  ' + a.title + '\n' +
        '  Owner:   ' + a.owner + '\n' +
        '  Due:     ' + Utils.fmtDate(a.dueDate) + '\n' +
        '  Impact:  ' + (a.impact > 0 ? Utils.fmtCurrency(a.impact) : 'N/A') + '\n' +
        '-'.repeat(40);
    });
    return header + lines.join('\n');
  }

  // ---- Action owner options ----
  function getActionOwners(actions) {
    var owners = [];
    actions.forEach(function(a) { if (owners.indexOf(a.owner) === -1) owners.push(a.owner); });
    owners.sort();
    return owners.map(function(o) { return '<option value="' + o + '">' + o + '</option>'; }).join('');
  }

  // ---- Action domain filter options for playbook ----
  function getPlaybookAccountOptions(accounts, profiles) {
    var highRisk = profiles.filter(function(p) { return p.riskLevel === 'high' || p.riskLevel === 'critical'; });
    var opts = highRisk.map(function(p) {
      var acct = accounts.find(function(a) { return a.id === p.accountId; });
      return acct ? '<option value="' + acct.id + '">' + acct.name + '</option>' : '';
    }).join('');
    return opts;
  }
  return {
    renderMetricsRow,
    renderAccountRow,
    renderAccountDetail,
    renderEmptyState,
    renderErrorState,
    renderActionsTable,
    renderPlaybookCards,
    renderExportText,
    getActionOwners,
    getPlaybookAccountOptions,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Components };
}
