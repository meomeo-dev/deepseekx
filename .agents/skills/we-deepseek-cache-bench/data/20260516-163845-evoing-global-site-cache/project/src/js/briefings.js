/* Evoing Executive Briefing Builder */
const Briefings = (() => {
  let data = null, selRole = null, selObjective = null, selIndustry = null;
  function init() {
    const de = document.getElementById('briefings-data');
    if (!de) return;
    try { data = JSON.parse(de.textContent); } catch (e) { return; }
    /* Role options */
    const roleEl = document.getElementById('briefing-roles');
    if (roleEl && data.roles) {
      const lang = document.documentElement.lang || 'zh';
      roleEl.innerHTML = (data.roles || []).map((r) => '<button class="briefing-option" data-role="' + r.id + '">' + escHtml(r.label[lang]) + '</button>').join('');
      roleEl.querySelectorAll('.briefing-option').forEach((btn) => { btn.addEventListener('click', () => { roleEl.querySelectorAll('.briefing-option').forEach((b) => b.classList.remove('briefing-option--active')); btn.classList.add('briefing-option--active'); selRole = btn.dataset.role; updateResult(); }); });
      if (data.roles.length > 0) roleEl.querySelector('.briefing-option').click();
    }
    /* Objective options */
    const objEl = document.getElementById('briefing-objectives');
    if (objEl && data.objectives) {
      const lang = document.documentElement.lang || 'zh';
      objEl.innerHTML = (data.objectives || []).map((o) => '<button class="briefing-option" data-objective="' + o.id + '">' + escHtml(o.label[lang]) + '</button>').join('');
      objEl.querySelectorAll('.briefing-option').forEach((btn) => { btn.addEventListener('click', () => { objEl.querySelectorAll('.briefing-option').forEach((b) => b.classList.remove('briefing-option--active')); btn.classList.add('briefing-option--active'); selObjective = btn.dataset.objective; updateResult(); }); });
      if (data.objectives.length > 0) objEl.querySelector('.briefing-option').click();
    }
    /* Industry options */
    const indEl = document.getElementById('briefing-industries');
    if (indEl && data.industries) {
      const lang = document.documentElement.lang || 'zh';
      indEl.innerHTML = (data.industries || []).map((i) => '<button class="briefing-option" data-industry="' + i.id + '">' + escHtml(i.label[lang]) + '</button>').join('');
      indEl.querySelectorAll('.briefing-option').forEach((btn) => { btn.addEventListener('click', () => { indEl.querySelectorAll('.briefing-option').forEach((b) => b.classList.remove('briefing-option--active')); btn.classList.add('briefing-option--active'); selIndustry = btn.dataset.industry; updateResult(); }); });
      if (data.industries.length > 0) indEl.querySelector('.briefing-option').click();
    }
  }
  function updateResult() {
    if (!data) return;
    const result = document.getElementById('briefing-result');
    const lang = document.documentElement.lang || 'zh';
    const role = (data.roles || []).find((r) => r.id === selRole) || {};
    const obj = (data.objectives || []).find((o) => o.id === selObjective) || {};
    const ind = (data.industries || []).find((i) => i.id === selIndustry) || {};
    result.querySelector('.briefing-result__title').textContent = escHtml(role.label ? role.label[lang] : '') + ' \u2014 ' + escHtml(ind.label ? ind.label[lang] : '');
    result.querySelector('.briefing-result__duration').textContent = obj.duration || '';
    const agenda = result.querySelector('.briefing-result__agenda');
    agenda.innerHTML = (obj.agenda ? obj.agenda[lang] || [] : []).map((item, i) => '<div class="briefing-agenda-item"><span class="briefing-agenda-item__num">' + (i + 1) + '</span><span class="briefing-agenda-item__text">' + escHtml(item) + '</span></div>').join('');
  }
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  return { init };
})();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Briefings.init()); else Briefings.init();
