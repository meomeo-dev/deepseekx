// Revenue Command Center — Application Controller (Round 2)

(function () {
  'use strict';

  // ---- State ----
  var state = {
    activeTab: 'dashboard',
    filters: { search: '', riskFilter: 'all', domainFilter: 'all' },
    actionFilters: { owner: 'all', status: 'all', domain: 'all' },
    playbookAccount: 'all',
    expandedId: null,
    ready: false,
    error: null,
  };

  // ---- DOM refs (dashboard) ----
  var $metrics = document.getElementById('metrics-row');
  var $search = document.getElementById('search-input');
  var $riskFilter = document.getElementById('risk-filter');
  var $domainFilter = document.getElementById('domain-filter');
  var $filterChips = document.querySelectorAll('#panel-dashboard .filter-chip');
  var $accountList = document.getElementById('account-list');
  var $summary = document.getElementById('results-summary');
  var $errorContainer = document.getElementById('error-container');

  // ---- DOM refs (tabs) ----
  var $tabBtns = document.querySelectorAll('.tab-btn');
  var $tabPanels = document.querySelectorAll('.tab-panel');

  // ---- DOM refs (actions) ----
  var $actionList = document.getElementById('action-list');
  var $actionsOwnerFilter = document.getElementById('actions-owner-filter');
  var $actionsStatusFilter = document.getElementById('actions-status-filter');
  var $actionsDomainFilter = document.getElementById('actions-domain-filter');
  var $actionsSummary = document.getElementById('actions-summary');
  var $exportBtn = document.getElementById('export-actions-btn');
  var $exportArea = document.getElementById('actions-export-area');
  var $exportText = document.getElementById('actions-export-text');
  var $actionsCount = document.getElementById('actions-count');

  // ---- DOM refs (playbook) ----
  var $playbookList = document.getElementById('playbook-list');
  var $playbookAccountFilter = document.getElementById('playbook-account-filter');
  var $playbookSummary = document.getElementById('playbook-summary');

  // ---- Tab switching ----
  function switchTab(tabName) {
    state.activeTab = tabName;
    $tabBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tabName); });
    $tabPanels.forEach(function (p) { p.classList.toggle('active', p.id === 'panel-' + tabName); });

    if (tabName === 'dashboard') refreshAccountList();
    if (tabName === 'actions') refreshActions();
    if (tabName === 'playbook') refreshPlaybook();
  }

  // ---- Dashboard: metrics + account list ----
  function refreshMetrics() {
    if (!$metrics) return;
    var m = DATA.getMetrics();
    $metrics.innerHTML = Components.renderMetricsRow(m);
  }

  function refreshAccountList() {
    if (!$accountList) return;
    var filtered, errorMsg = null;

    try {
      filtered = Utils.filterAccounts(DATA.riskProfiles, DATA.accounts, state.filters);
    } catch (e) {
      errorMsg = e.message;
      filtered = [];
    }

    if ($errorContainer) {
      $errorContainer.innerHTML = state.error ? Components.renderErrorState(state.error) : errorMsg ? Components.renderErrorState(errorMsg) : '';
    }

    if (!$accountList) return;

    if (filtered.length === 0) {
      $accountList.innerHTML = Components.renderEmptyState();
      if ($summary) $summary.textContent = '0 results';
      return;
    }

    if ($summary) $summary.textContent = filtered.length + ' of ' + DATA.accounts.length + ' accounts';

    $accountList.innerHTML = filtered.map(function (p) {
      var acct = DATA.getAccountById(p.accountId);
      if (!acct) return '';
      return Components.renderAccountRow(acct, p, state.expandedId === acct.id);
    }).join('');

    // Attach expand listeners
    $accountList.querySelectorAll('.account-summary').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var row = el.closest('.account-row');
        if (!row) return;
        toggleDetail(row.dataset.accountId);
        e.stopPropagation();
      });
    });

    $accountList.querySelectorAll('[data-action="close-detail"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        closeDetail(btn.dataset.id);
        e.stopPropagation();
      });
    });

    if (state.expandedId) renderDetailPanel(state.expandedId);
  }

  function toggleDetail(id) {
    if (state.expandedId === id) { closeDetail(id); return; }
    if (state.expandedId) closeDetail(state.expandedId);
    state.expandedId = id;
    renderDetailPanel(id);
    var row = document.querySelector('.account-row[data-account-id="' + id + '"]');
    if (row) row.classList.add('expanded');
  }

  function closeDetail(id) {
    var row = document.querySelector('.account-row[data-account-id="' + id + '"]');
    if (row) {
      row.classList.remove('expanded');
      var panel = row.querySelector('.account-detail');
      if (panel) { panel.classList.remove('visible'); panel.innerHTML = ''; }
    }
    state.expandedId = null;
  }

  function renderDetailPanel(id) {
    var row = document.querySelector('.account-row[data-account-id="' + id + '"]');
    if (!row) return;
    var panel = row.querySelector('.account-detail');
    if (!panel) return;
    var acct = DATA.getAccountById(id);
    var profile = DATA.getRiskProfile(id);
    if (!acct || !profile) return;
    panel.innerHTML = Components.renderAccountDetail(acct, profile);
    panel.classList.add('visible');
  }

  // ---- Actions tab ----
  function refreshActions() {
    if (!$actionList) return;
    var allActions = DATA.getActions();
    var filtered = allActions.slice();

    if (state.actionFilters.owner !== 'all') {
      filtered = filtered.filter(function (a) { return a.owner === state.actionFilters.owner; });
    }
    if (state.actionFilters.status !== 'all') {
      filtered = filtered.filter(function (a) { return a.status === state.actionFilters.status; });
    }
    if (state.actionFilters.domain !== 'all') {
      filtered = filtered.filter(function (a) { return a.domain === state.actionFilters.domain; });
    }

    // Populate owner filter dropdown if empty
    if ($actionsOwnerFilter && $actionsOwnerFilter.options.length <= 1) {
      $actionsOwnerFilter.innerHTML = '<option value="all">All Owners</option>' + Components.getActionOwners(allActions);
    }

    // Update pending count badge
    var pendingCount = allActions.filter(function (a) { return a.status === 'pending'; }).length;
    if ($actionsCount) $actionsCount.textContent = pendingCount;

    $actionList.innerHTML = Components.renderActionsTable(filtered);
    if ($actionsSummary) $actionsSummary.textContent = filtered.length + ' of ' + allActions.length + ' actions';

    // Attach action button listeners
    $actionList.querySelectorAll('[data-action="complete-action"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        DATA.updateActionStatus(btn.dataset.id, 'completed');
        refreshActions();
        e.stopPropagation();
      });
    });
    $actionList.querySelectorAll('[data-action="defer-action"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        DATA.updateActionStatus(btn.dataset.id, 'deferred');
        refreshActions();
        e.stopPropagation();
      });
    });
    $actionList.querySelectorAll('[data-action="undo-action"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        DATA.updateActionStatus(btn.dataset.id, 'pending');
        refreshActions();
        e.stopPropagation();
      });
    });
  }

  // ---- Export ----
  function doExport() {
    var allActions = DATA.getActions();
    var filtered = allActions.slice();
    if (state.actionFilters.owner !== 'all') filtered = filtered.filter(function (a) { return a.owner === state.actionFilters.owner; });
    if (state.actionFilters.status !== 'all') filtered = filtered.filter(function (a) { return a.status === state.actionFilters.status; });
    if (state.actionFilters.domain !== 'all') filtered = filtered.filter(function (a) { return a.domain === state.actionFilters.domain; });

    var text = Components.renderExportText(filtered);
    if ($exportText) $exportText.textContent = text;
    if ($exportArea) {
      var isHidden = $exportArea.style.display === 'none';
      $exportArea.style.display = isHidden ? 'block' : 'none';
      if (isHidden) $exportText.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ---- Playbook tab ----
  function refreshPlaybook() {
    if (!$playbookList) return;
    var profiles = DATA.riskProfiles;
    var accounts = DATA.accounts;
    var highRiskProfiles = profiles.filter(function (p) { return p.riskLevel === 'high' || p.riskLevel === 'critical'; });

    // Populate account filter
    if ($playbookAccountFilter && $playbookAccountFilter.options.length <= 1) {
      $playbookAccountFilter.innerHTML = '<option value="all">All High-Risk Accounts</option>' +
        Components.getPlaybookAccountOptions(accounts, profiles);
    }

    var html = Components.renderPlaybookCards(accounts, profiles, DATA.getPlaybooks, state.playbookAccount);
    $playbookList.innerHTML = html;
    if ($playbookSummary) $playbookSummary.textContent = highRiskProfiles.length + ' high-risk accounts';
  }

  // ---- Event bindings ----
  // Tab buttons
  $tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
  });

  // Dashboard filters
  if ($search) $search.addEventListener('input', function () {
    state.filters.search = $search.value;
    refreshAccountList();
  });
  if ($riskFilter) $riskFilter.addEventListener('change', function () {
    state.filters.riskFilter = $riskFilter.value;
    refreshAccountList();
  });
  if ($domainFilter) $domainFilter.addEventListener('change', function () {
    state.filters.domainFilter = $domainFilter.value;
    refreshAccountList();
  });
  $filterChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var domain = chip.dataset.domain;
      if (!domain) return;
      if (state.filters.domainFilter === domain) {
        state.filters.domainFilter = 'all';
        $filterChips.forEach(function (c) { c.classList.remove('active'); });
        if ($domainFilter) $domainFilter.value = 'all';
      } else {
        state.filters.domainFilter = domain;
        $filterChips.forEach(function (c) { c.classList.toggle('active', c.dataset.domain === domain); });
        if ($domainFilter) $domainFilter.value = domain;
      }
      refreshAccountList();
    });
  });

  // Actions filters
  if ($actionsOwnerFilter) $actionsOwnerFilter.addEventListener('change', function () {
    state.actionFilters.owner = $actionsOwnerFilter.value;
    refreshActions();
  });
  if ($actionsStatusFilter) $actionsStatusFilter.addEventListener('change', function () {
    state.actionFilters.status = $actionsStatusFilter.value;
    refreshActions();
  });
  if ($actionsDomainFilter) $actionsDomainFilter.addEventListener('change', function () {
    state.actionFilters.domain = $actionsDomainFilter.value;
    refreshActions();
  });

  // Export
  if ($exportBtn) $exportBtn.addEventListener('click', doExport);

  // Playbook filter
  if ($playbookAccountFilter) $playbookAccountFilter.addEventListener('change', function () {
    state.playbookAccount = $playbookAccountFilter.value;
    refreshPlaybook();
  });

  // Keyboard: Escape closes detail
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.expandedId) {
      closeDetail(state.expandedId);
      refreshAccountList();
    }
  });

  // ---- Init ----
  function init() {
    try {
      if (!DATA.accounts || DATA.accounts.length === 0) {
        throw new Error('Account data is empty — check data.js');
      }

      refreshMetrics();
      refreshAccountList();
      switchTab(state.activeTab);
      state.ready = true;
    } catch (e) {
      state.error = e.message;
      if ($errorContainer) $errorContainer.innerHTML = Components.renderErrorState(e.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
