/* Evoing Trust — renders trust pillars and certifications from embedded data */
const TrustModule = (() => {
  function init() {
    const de = document.getElementById('trust-data');
    if (!de) return;
    let data;
    try { data = JSON.parse(de.textContent); } catch (e) { return; }
    if (!data.pillars) return;
    const lang = document.documentElement.lang || 'zh';
    const icons = { scale: '\u2696', shield: '\uD83D\uDEE1', lock: '\uD83D\uDD12', check: '\u2714' };
    const grid = document.getElementById('trust-grid');
    if (grid) {
      grid.innerHTML = data.pillars.map((p) => '<div class="trust-card"><div class="trust-card__header"><span class="trust-card__icon">' + (icons[p.icon] || '') + '</span><h3 class="trust-card__label">' + esc(p.label[lang]) + '</h3></div><p class="trust-card__summary">' + esc(p.summary[lang]) + '</p><div class="trust-card__frameworks">' + (p.frameworks[lang] || []).map((f) => '<span class="trust-card__fw-tag">' + esc(f) + '</span>').join('') + '</div><div class="trust-card__commitments">' + (p.commitments[lang] || []).map((c) => '<p class="trust-card__commit">' + esc(c) + '</p>').join('') + '</div></div>').join('');
    }
    const certs = document.getElementById('certs-bar');
    if (certs && data.certifications) {
      certs.innerHTML = data.certifications.map((c) => '<div class="cert-badge"><p class="cert-badge__label">' + esc(c.label) + '</p><p class="cert-badge__scope">' + esc(c.scope[lang]) + '</p></div>').join('');
    }
    /* Reveal cards */
    setTimeout(() => {
      document.querySelectorAll('.trust-card,.cert-badge').forEach((el) => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)'; el.style.animation = 'fadeInUp .5s ease-out forwards'; });
    }, 100);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  return { init };
})();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => TrustModule.init()); else TrustModule.init();
