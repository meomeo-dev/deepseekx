/**
 * Evoing Careers — job family filter on openings.
 */
const CareersModule = (() => {
  function init() {
    const grid = document.getElementById('jobs-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.job-card');

    const bar = document.querySelector('.jobs-filter');
    if (bar) {
      bar.querySelectorAll('.filter-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          bar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');
          const f = chip.dataset.filter;
          cards.forEach((c) => {
            c.style.display = (f === 'all' || c.dataset.path === f) ? '' : 'none';
          });
        });
      });
    }
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CareersModule.init());
} else {
  CareersModule.init();
}
