/**
 * Evoing Filter — capability / industry filtering with active state.
 * Expects filter chips with data-filter="<id>" and cards with data-category="<id>".
 */
const Filter = (() => {
  function init() {
    document.querySelectorAll('.filter-bar').forEach((bar) => {
      const chips = bar.querySelectorAll('.filter-chip');
      const targetSelector = bar.dataset.filterTarget || '.card';
      const cards = document.querySelectorAll(targetSelector);

      chips.forEach((chip) => {
        chip.addEventListener('click', () => {
          const filterId = chip.dataset.filter;

          /* Update active chip */
          chips.forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');

          /* Filter cards */
          cards.forEach((card) => {
            if (filterId === 'all' || card.dataset.category === filterId) {
              card.style.display = '';
              card.style.animation = 'fadeIn 0.3s ease-out';
            } else {
              card.style.display = 'none';
            }
          });
        });
      });
    });
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Filter.init());
} else {
  Filter.init();
}
