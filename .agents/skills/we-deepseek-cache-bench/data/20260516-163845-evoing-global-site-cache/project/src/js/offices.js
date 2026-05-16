/**
 * Evoing Offices — region tab filtering.
 */
const Offices = (() => {
  function init() {
    const grid = document.getElementById('offices-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.office-card');

    const tabs = document.querySelectorAll('.offices-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('offices-tab--active'));
        tab.classList.add('offices-tab--active');
        const region = tab.dataset.region;
        cards.forEach((c) => {
          c.style.display = (region === 'all' || c.dataset.region === region) ? '' : 'none';
        });
      });
    });
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Offices.init());
} else {
  Offices.init();
}
