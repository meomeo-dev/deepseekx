/**
 * Evoing i18n — lightweight bilingual toggle (zh / en).
 * Data-driven: all text nodes with [data-lang="zh"] or [data-lang="en"]
 * are toggled by adding/removing the .lang-hidden class.
 */
const I18n = (() => {
  const STORAGE_KEY = 'evoing-lang';
  let current = 'zh';

  function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') {
      current = stored;
    }
    apply();
    bindToggle();
  }

  function apply() {
    document.documentElement.lang = current;
    document.querySelectorAll('[data-lang]').forEach((el) => {
      if (el.dataset.lang === current) {
        el.classList.remove('lang-hidden');
      } else {
        el.classList.add('lang-hidden');
      }
    });
  }

  function toggle() {
    current = current === 'zh' ? 'en' : 'zh';
    localStorage.setItem(STORAGE_KEY, current);
    apply();
    updateToggleUI();
    dispatchChange();
  }

  function bindToggle() {
    const btn = document.getElementById('lang-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
      updateToggleUI();
    }
  }

  function updateToggleUI() {
    const btn = document.getElementById('lang-toggle');
    if (btn) {
      btn.textContent = current === 'zh' ? 'EN' : '中';
      btn.setAttribute('aria-label', current === 'zh' ? 'Switch to English' : '切换到中文');
    }
  }

  function dispatchChange() {
    window.dispatchEvent(new CustomEvent('evoing:langchange', { detail: { lang: current } }));
  }

  function getLang() {
    return current;
  }

  return { init, toggle, getLang };
})();

/* Auto-init when DOM is ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => I18n.init());
} else {
  I18n.init();
}
