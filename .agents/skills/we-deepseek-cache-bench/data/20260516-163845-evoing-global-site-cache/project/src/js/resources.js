/* Evoing Resource Library — format/industry filter + request-download state */
const Resources = (() => {
  function init() {
    const grid = document.getElementById('resources-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.resource-card');

    /* Format filter */
    const fmtBar = document.querySelector('.filter-bar--resource-fmt');
    if (fmtBar) {
      fmtBar.querySelectorAll('.filter-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          fmtBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');
          applyResFilter(cards);
        });
      });
    }

    /* Industry filter */
    const indBar = document.querySelector('.filter-bar--resource-ind');
    if (indBar) {
      indBar.querySelectorAll('.filter-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          indBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');
          applyResFilter(cards);
        });
      });
    }

    /* Request/download state */
    cards.forEach((card) => {
      const actionBtn = card.querySelector('.resource-card__action');
      if (actionBtn) {
        actionBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (card.classList.contains('resource-card--requested')) return;
          card.classList.add('resource-card--requested');
          actionBtn.textContent = document.documentElement.lang === 'zh' ? '已请求' : 'Requested';
          showResToast(document.documentElement.lang === 'zh' ? '资源请求已提交，链接将发送至您的邮箱。' : 'Resource request submitted. A link will be emailed to you.');
        });
      }
    });
  }

  function applyResFilter(cards) {
    const fmtBar = document.querySelector('.filter-bar--resource-fmt');
    const indBar = document.querySelector('.filter-bar--resource-ind');
    const fmtF = fmtBar ? (fmtBar.querySelector('.filter-chip--active') || {}).dataset?.filter || 'all' : 'all';
    const indF = indBar ? (indBar.querySelector('.filter-chip--active') || {}).dataset?.filter || 'all' : 'all';
    cards.forEach((c) => {
      const fMatch = fmtF === 'all' || c.dataset.category === fmtF;
      const iMatch = indF === 'all' || c.dataset.industry === indF;
      c.style.display = (fMatch && iMatch) ? '' : 'none';
    });
  }

  function showResToast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast--visible'));
    setTimeout(() => { t.classList.remove('toast--visible'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  return { init };
})();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Resources.init()); else Resources.init();
