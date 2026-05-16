/**
 * Evoing Insights — multi-axis filtering by category and region.
 * Supports two independent filter bars with data-category and data-region attributes.
 */
const Insights = (() => {
  let activeCategory = 'all';
  let activeRegion = 'all';

  function init() {
    const grid = document.getElementById('insights-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.insight-card');

    /* Category filter bar */
    const catBar = document.querySelector('.filter-bar--insight-cat');
    if (catBar) {
      catBar.querySelectorAll('.filter-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          catBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');
          activeCategory = chip.dataset.filter;
          applyFilter(cards);
        });
      });
    }

    /* Region filter bar */
    const regBar = document.querySelector('.filter-bar--insight-region');
    if (regBar) {
      regBar.querySelectorAll('.filter-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          regBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');
          activeRegion = chip.dataset.filter;
          applyFilter(cards);
        });
      });
    }
  }

  function applyFilter(cards) {
    cards.forEach((card) => {
      const catMatch = activeCategory === 'all' || card.dataset.category === activeCategory;
      const regMatch = activeRegion === 'all' || card.dataset.region === activeRegion;
      card.style.display = (catMatch && regMatch) ? '' : 'none';
    });
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Insights.init());
} else {
  Insights.init();
}
