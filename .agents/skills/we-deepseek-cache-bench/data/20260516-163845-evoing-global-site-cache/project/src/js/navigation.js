/**
 * Evoing Navigation — sticky nav, scroll effects, mobile toggle, smooth scroll.
 */
const Navigation = (() => {
  let mobileOpen = false;

  function init() {
    const nav = document.querySelector('.nav');
    const toggle = document.getElementById('mobile-toggle');
    const links = document.getElementById('nav-links');
    const linkEls = links ? links.querySelectorAll('.nav__link') : [];

    /* Scroll-driven styling */
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (nav) {
            nav.classList.toggle('nav--scrolled', window.scrollY > 10);
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    /* Mobile toggle */
    if (toggle && links) {
      toggle.addEventListener('click', () => {
        mobileOpen = !mobileOpen;
        toggle.classList.toggle('nav__mobile-toggle--open', mobileOpen);
        links.classList.toggle('nav__links--open', mobileOpen);
        toggle.setAttribute('aria-expanded', mobileOpen);
        document.body.style.overflow = mobileOpen ? 'hidden' : '';
      });
    }

    /* Close mobile nav on link click */
    linkEls.forEach((link) => {
      link.addEventListener('click', () => {
        if (mobileOpen) {
          mobileOpen = false;
          if (toggle) toggle.classList.remove('nav__mobile-toggle--open');
          if (links) links.classList.remove('nav__links--open');
          document.body.style.overflow = '';
        }
      });
    });

    /* Smooth scroll for nav links with data-target */
    document.querySelectorAll('[data-target]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const targetId = el.dataset.target;
        const target = document.getElementById(targetId);
        if (target) {
          e.preventDefault();
          const offset = 80;
          const top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      });
    });
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Navigation.init());
} else {
  Navigation.init();
}
