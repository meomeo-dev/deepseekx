/**
 * Evoing Methodology — scroll-driven step activation on the timeline.
 * Each step becomes "active" when scrolled past the viewport midpoint.
 */
const Methodology = (() => {
  function init() {
    const steps = document.querySelectorAll('.methodology-step');
    if (steps.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          /* Deactivate all steps first */
          steps.forEach((s) => s.classList.remove('methodology-step--active'));
          entry.target.classList.add('methodology-step--active');
        }
      });
    }, { threshold: 0.5, rootMargin: '-10% 0px -10% 0px' });

    steps.forEach((step) => observer.observe(step));

    /* Activate first step on load */
    steps[0].classList.add('methodology-step--active');
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Methodology.init());
} else {
  Methodology.init();
}
