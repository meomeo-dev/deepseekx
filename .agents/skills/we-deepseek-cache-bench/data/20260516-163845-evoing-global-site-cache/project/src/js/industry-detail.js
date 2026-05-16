/**
 * Evoing Industry Detail — drill-down panel that opens when a user clicks
 * an industry summary card. Closes via close button or clicking another card.
 */
const IndustryDetail = (() => {
  let openPanel = null;

  function init() {
    const cards = document.querySelectorAll('.industry-summary-card');
    const panel = document.getElementById('industry-detail-panel');
    if (!panel || cards.length === 0) return;

    /* Close button */
    const closeBtn = panel.querySelector('.industry-detail__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closePanel);
    }

    /* Click outside to close */
    document.addEventListener('click', (e) => {
      if (openPanel && !panel.contains(e.target) && !e.target.closest('.industry-summary-card')) {
        closePanel();
      }
    });

    /* Card clicks */
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const industryId = card.dataset.industry;
        if (!industryId) return;

        /* If same card clicked, toggle off */
        if (openPanel === industryId) {
          closePanel();
          return;
        }

        /* Close previous, open new */
        closePanel();
        openPanel = industryId;
        card.classList.add('industry-summary-card--active');
        panel.classList.add('industry-detail--open');
        populatePanel(panel, industryId);
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  function closePanel() {
    const panel = document.getElementById('industry-detail-panel');
    if (!panel) return;

    /* Move panel to bottom of industries section so it can be reopened */
    const industriesSection = document.getElementById('industries');
    if (industriesSection) {
      industriesSection.appendChild(panel);
    }
    panel.classList.remove('industry-detail--open');
    openPanel = null;

    document.querySelectorAll('.industry-summary-card--active').forEach((c) => {
      c.classList.remove('industry-summary-card--active');
    });

    /* Clear panel content to reset */
    panel.querySelector('.industry-detail__title').textContent = '';
    panel.querySelector('.industry-detail__pains').innerHTML = '';
    panel.querySelector('.industry-detail__approach').textContent = '';
    panel.querySelector('.industry-detail__outcomes').innerHTML = '';
    panel.querySelector('.industry-detail__caps').innerHTML = '';
  }

  function populatePanel(panel, id) {
    /* Data is embedded in a <script type="application/json"> tag */
    const dataEl = document.getElementById('industry-deep-data');
    if (!dataEl) return;

    let data;
    try {
      data = JSON.parse(dataEl.textContent);
    } catch (e) {
      return;
    }

    const industry = data.find((d) => d.id === id);
    if (!industry) return;

    const lang = document.documentElement.lang || 'zh';

    panel.querySelector('.industry-detail__title').textContent = industry.label ? industry.label[lang] : '';
    panel.querySelector('.industry-detail__approach').textContent = industry.approach ? industry.approach[lang] : '';

    /* Pain points */
    const painsList = panel.querySelector('.industry-detail__pains');
    painsList.innerHTML = '';
    if (industry.painPoints && industry.painPoints[lang]) {
      industry.painPoints[lang].forEach((p) => {
        const li = document.createElement('li');
        li.textContent = p;
        painsList.appendChild(li);
      });
    }

    /* Outcomes */
    const outcomesList = panel.querySelector('.industry-detail__outcomes');
    outcomesList.innerHTML = '';
    if (industry.outcomes && industry.outcomes[lang]) {
      industry.outcomes[lang].forEach((o) => {
        const li = document.createElement('li');
        li.textContent = o;
        outcomesList.appendChild(li);
      });
    }

    /* Related capabilities */
    const capsContainer = panel.querySelector('.industry-detail__caps');
    capsContainer.innerHTML = '';
    if (industry.relatedCaps) {
      industry.relatedCaps.forEach((capId) => {
        const span = document.createElement('span');
        span.className = 'industry-detail__cap-tag';
        span.textContent = capId;
        capsContainer.appendChild(span);
      });
    }
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => IndustryDetail.init());
} else {
  IndustryDetail.init();
}
