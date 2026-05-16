/**
 * Evoing Case Studies — filter by industry/region, detail panel.
 */
const CaseStudies = (() => {
  let openId = null;

  function init() {
    const grid = document.getElementById('case-studies-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.case-study-card');

    /* Industry filter */
    const indBar = document.querySelector('.filter-bar--case-ind');
    if (indBar) {
      indBar.querySelectorAll('.filter-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          indBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');
          applyFilters(cards);
        });
      });
    }

    /* Region filter */
    const regBar = document.querySelector('.filter-bar--case-region');
    if (regBar) {
      regBar.querySelectorAll('.filter-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          regBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');
          applyFilters(cards);
        });
      });
    }

    /* Detail panel */
    const panel = document.getElementById('case-study-detail');
    if (!panel) return;

    const closeBtn = panel.querySelector('.case-study-detail__close');
    if (closeBtn) closeBtn.addEventListener('click', closeDetail);

    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const cid = card.dataset.caseId;
        if (!cid) return;
        if (openId === cid) { closeDetail(); return; }
        openDetail(cid);
        card.classList.add('industry-summary-card--active');
      });
    });
  }

  function applyFilters(cards) {
    const indBar = document.querySelector('.filter-bar--case-ind');
    const regBar = document.querySelector('.filter-bar--case-region');
    const indActive = indBar ? indBar.querySelector('.filter-chip--active') : null;
    const regActive = regBar ? regBar.querySelector('.filter-chip--active') : null;
    const indF = indActive ? indActive.dataset.filter : 'all';
    const regF = regActive ? regActive.dataset.filter : 'all';

    cards.forEach((c) => {
      const iMatch = indF === 'all' || c.dataset.industry === indF;
      const rMatch = regF === 'all' || c.dataset.region === regF;
      c.style.display = (iMatch && rMatch) ? '' : 'none';
    });
  }

  function openDetail(id) {
    const dataEl = document.getElementById('case-studies-data');
    if (!dataEl) return;
    let data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
    const cs = data.find((c) => c.id === id);
    if (!cs) return;

    const lang = document.documentElement.lang || 'zh';
    const panel = document.getElementById('case-study-detail');

    panel.querySelector('.case-study-detail__title').textContent = cs.title ? cs.title[lang] : id;
    panel.querySelector('.case-study-detail__challenge').textContent = cs.challenge[lang];
    panel.querySelector('.case-study-detail__intervention').textContent = cs.intervention[lang];
    panel.querySelector('.case-study-detail__architecture').textContent = cs.architecture[lang];

    const resultsEl = panel.querySelector('.case-study-detail__results');
    resultsEl.innerHTML = '';
    (cs.results[lang] || []).forEach((r) => {
      const li = document.createElement('li');
      li.textContent = r;
      resultsEl.appendChild(li);
    });

    panel.querySelector('.case-study-detail__timeline').textContent = cs.timeline || '';

    const capsEl = panel.querySelector('.case-study-detail__caps');
    capsEl.innerHTML = '';
    (cs.capabilities || []).forEach((cap) => {
      const tag = document.createElement('span');
      tag.className = 'card__sub';
      tag.textContent = cap;
      capsEl.appendChild(tag);
    });

    openId = id;
    panel.classList.add('case-study-detail--open');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeDetail() {
    const panel = document.getElementById('case-study-detail');
    if (panel) panel.classList.remove('case-study-detail--open');
    openId = null;
    document.querySelectorAll('.industry-summary-card--active').forEach((el) => el.classList.remove('industry-summary-card--active'));
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CaseStudies.init());
} else {
  CaseStudies.init();
}
