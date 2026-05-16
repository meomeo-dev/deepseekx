/**
 * Evoing Solutions — filter by capability/industry, detail drawer on click.
 */
const Solutions = (() => {
  function init() {
    const grid = document.getElementById('solutions-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.solution-card');

    /* Filter bar */
    const bar = document.querySelector('.filter-bar--solutions');
    if (bar) {
      bar.querySelectorAll('.filter-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          bar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');
          const f = chip.dataset.filter;
          cards.forEach((c) => {
            c.style.display = (f === 'all' || (c.dataset.caps || '').split(',').includes(f)) ? '' : 'none';
          });
        });
      });
    }

    /* Detail drawer */
    const drawer = document.getElementById('solution-drawer');
    const backdrop = document.getElementById('solution-drawer-backdrop');
    if (!drawer) return;

    const closeBtn = drawer.querySelector('.solution-drawer__close');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const sid = card.dataset.solutionId;
        if (!sid) return;
        openDrawer(sid);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('solution-drawer--open')) {
        closeDrawer();
      }
    });
  }

  function openDrawer(id) {
    const dataEl = document.getElementById('solutions-data');
    if (!dataEl) return;
    let data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
    const sol = data.find((s) => s.id === id);
    if (!sol) return;

    const lang = document.documentElement.lang || 'zh';
    const drawer = document.getElementById('solution-drawer');
    const backdrop = document.getElementById('solution-drawer-backdrop');

    drawer.querySelector('.solution-drawer__title').textContent = sol.name[lang];
    drawer.querySelector('.solution-drawer__problem').textContent = sol.problem[lang];
    drawer.querySelector('.solution-drawer__approach').textContent = sol.approach[lang];
    drawer.querySelector('.solution-drawer__outcomes').textContent = sol.outcomes[lang];

    const modsEl = drawer.querySelector('.solution-drawer__modules');
    modsEl.innerHTML = '';
    (sol.modules[lang] || []).forEach((m) => {
      const tag = document.createElement('span');
      tag.className = 'solution-card__module';
      tag.textContent = m;
      modsEl.appendChild(tag);
    });

    const metricsEl = drawer.querySelector('.solution-drawer__metrics-list');
    metricsEl.innerHTML = '';
    (sol.metrics[lang] || []).forEach((m) => {
      const li = document.createElement('li');
      li.textContent = m;
      li.style.cssText = 'font-size:var(--fs-small);color:var(--color-navy-700);margin-bottom:var(--space-xs);';
      metricsEl.appendChild(li);
    });

    const relEl = drawer.querySelector('.solution-drawer__related');
    relEl.innerHTML = '';
    (sol.relatedCapabilities || []).forEach((c) => {
      const tag = document.createElement('span');
      tag.className = 'card__sub';
      tag.textContent = c;
      relEl.appendChild(tag);
    });

    drawer.classList.add('solution-drawer--open');
    if (backdrop) backdrop.classList.add('solution-drawer__backdrop--visible');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    const drawer = document.getElementById('solution-drawer');
    const backdrop = document.getElementById('solution-drawer-backdrop');
    if (drawer) drawer.classList.remove('solution-drawer--open');
    if (backdrop) backdrop.classList.remove('solution-drawer__backdrop--visible');
    document.body.style.overflow = '';
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Solutions.init());
} else {
  Solutions.init();
}
