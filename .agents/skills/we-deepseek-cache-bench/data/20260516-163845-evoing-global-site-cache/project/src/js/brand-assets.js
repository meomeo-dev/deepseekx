/* Evoing Brand Assets — download button state toggles */
const BrandAssets = (() => {
  function init() {
    document.querySelectorAll('.download-card').forEach((card) => {
      card.addEventListener('click', () => {
        const state = card.querySelector('.download-card__state');
        if (!state) return;
        if (state.dataset.downloaded === 'true') return;
        state.dataset.downloaded = 'true';
        state.textContent = document.documentElement.lang === 'zh' ? '\u2713 已下载' : '\u2713 Downloaded';
        const toast = document.createElement('div'); toast.className = 'toast';
        toast.textContent = document.documentElement.lang === 'zh' ? '模拟下载开始' : 'Simulated download started';
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast--visible'));
        setTimeout(() => { toast.classList.remove('toast--visible'); setTimeout(() => toast.remove(), 300); }, 2000);
      });
    });
  }
  return { init };
})();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => BrandAssets.init()); else BrandAssets.init();
