/* Evoing Value Impact Calculator — scenario select + input-driven output */
const ValueCalc = (() => {
  let data = null, currentScenario = null;
  function init() {
    const panel = document.getElementById('value-calc-panel');
    if (!panel) return;
    const btns = document.querySelectorAll('.value-calc__scenario-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        btns.forEach((b) => b.classList.remove('value-calc__scenario-btn--active'));
        btn.classList.add('value-calc__scenario-btn--active');
        loadScenario(btn.dataset.scenario);
      });
    });
    /* Activate first */
    if (btns.length > 0) btns[0].click();
    /* Listen for input changes */
    panel.addEventListener('change', (e) => { if (e.target.classList.contains('value-calc__select')) recalc(); });
  }
  function loadScenario(id) {
    const de = document.getElementById('value-models-data');
    if (!de) return;
    try { data = JSON.parse(de.textContent); } catch (e) { return; }
    currentScenario = data.scenarios.find((s) => s.id === id);
    if (!currentScenario) return;
    const panel = document.getElementById('value-calc-panel');
    const lang = document.documentElement.lang || 'zh';
    panel.querySelector('.value-calc__panel-title').textContent = currentScenario.label[lang];
    /* Build inputs */
    const inputsEl = panel.querySelector('.value-calc__inputs');
    inputsEl.innerHTML = '';
    (currentScenario.inputs || []).forEach((inp) => {
      const div = document.createElement('div');
      div.innerHTML = '<p class="value-calc__input-label">' + escHtml(inp.label[lang]) + '</p><select class="value-calc__select" data-input-id="' + inp.id + '">' + (inp.options || []).map((o, i) => '<option value="' + o.value + '"' + (i === 0 ? ' selected' : '') + '>' + escHtml(o.label && o.label[lang] ? o.label[lang] : o.label) + '</option>').join('') + '</select>';
      inputsEl.appendChild(div);
    });
    panel.querySelector('.value-calc__methodology').textContent = currentScenario.methodology[lang];
    recalc();
  }
  function recalc() {
    if (!currentScenario) return;
    const panel = document.getElementById('value-calc-panel');
    const outputsEl = panel.querySelector('.value-calc__outputs');
    const selects = panel.querySelectorAll('.value-calc__select');
    let inputFactor = 1;
    selects.forEach((sel) => { inputFactor *= parseFloat(sel.value) / parseFloat(sel.options[0].value); });
    const lang = document.documentElement.lang || 'zh';
    outputsEl.innerHTML = (currentScenario.outputs || []).map((o) => {
      const val = o.baseValue * Math.pow(o.multiplier, inputFactor > 1 ? 1 : inputFactor < 1 ? -1 : 0);
      let formatted;
      if (o.format === 'currency') formatted = '$' + (val / 1000000).toFixed(1) + 'M';
      else if (o.format === 'percent') formatted = Math.round(val) + '%';
      else if (o.format === 'multiplier') formatted = Math.round(val) + 'x';
      else if (o.format === 'points') formatted = '+' + Math.round(val);
      else if (o.format === 'fte') formatted = Math.round(val) + ' FTE';
      else formatted = Math.round(val);
      return '<div class="value-calc__output"><span class="value-calc__output-label">' + escHtml(o.label[lang]) + '</span><span class="value-calc__output-value">' + formatted + '</span></div>';
    }).join('');
  }
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  return { init };
})();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ValueCalc.init()); else ValueCalc.init();
