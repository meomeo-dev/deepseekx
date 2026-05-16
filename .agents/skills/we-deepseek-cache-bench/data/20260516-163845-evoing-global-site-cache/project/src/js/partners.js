/* Evoing Partners — renders partner ecosystem from embedded data */
const PartnersModule = (() => {
  function init() {
    const de = document.getElementById('partners-data');
    if (!de) return;
    let data;
    try { data = JSON.parse(de.textContent); } catch (e) { return; }
    const lang = document.documentElement.lang || 'zh';
    const cats = document.getElementById('partners-categories');
    if (cats && data.categories) {
      cats.innerHTML = data.categories.map((cat) => '<div class="partner-category"><h3 class="partner-category__title">' + esc(cat.label[lang]) + '</h3><div class="partner-category__grid">' + (cat.partners || []).map((p) => '<div class="partner-card"><p class="partner-card__name">' + esc(p.name) + '</p><p class="partner-card__tier">' + esc(p.tier[lang]) + '</p><div class="partner-card__competencies">' + (p.competencies[lang] || []).map((c) => '<span class="partner-card__comp">' + esc(c) + '</span>').join('') + '</div></div>').join('') + '</div></div>').join('');
    }
    const cm = document.getElementById('collab-models');
    if (cm && data.collaborationModels) {
      cm.innerHTML = data.collaborationModels.map((m) => '<div class="collab-model"><p class="collab-model__label">' + esc(m.label[lang]) + '</p><p class="collab-model__desc">' + esc(m.desc[lang]) + '</p></div>').join('');
    }
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  return { init };
})();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => PartnersModule.init()); else PartnersModule.init();
