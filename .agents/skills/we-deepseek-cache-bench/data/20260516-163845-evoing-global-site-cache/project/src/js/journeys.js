/* Evoing Client Journeys — role selector tabs */
const Journeys = (() => {
  function init() {
    const btns = document.querySelectorAll('.journey-role-btn');
    const contents = document.querySelectorAll('.journey-content');
    if (btns.length === 0) return;

    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        btns.forEach((b) => b.classList.remove('journey-role-btn--active'));
        btn.classList.add('journey-role-btn--active');
        const role = btn.dataset.role;
        contents.forEach((c) => {
          c.classList.toggle('journey-content--active', c.dataset.role === role);
        });
      });
    });
  }
  return { init };
})();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Journeys.init()); else Journeys.init();
