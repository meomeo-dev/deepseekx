/**
 * Evoing Articles — dual filter + preview modal on click.
 */
const Articles = (() => {
  function init() {
    const grid = document.getElementById('articles-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.article-card');

    /* Category filter */
    const catBar = document.querySelector('.filter-bar--article-cat');
    if (catBar) {
      catBar.querySelectorAll('.filter-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          catBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');
          applyArticleFilter(cards);
        });
      });
    }

    /* Region filter */
    const regBar = document.querySelector('.filter-bar--article-region');
    if (regBar) {
      regBar.querySelectorAll('.filter-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          regBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('filter-chip--active'));
          chip.classList.add('filter-chip--active');
          applyArticleFilter(cards);
        });
      });
    }

    /* Preview modal */
    const preview = document.getElementById('article-preview');
    const backdrop = document.getElementById('article-preview-backdrop');
    if (!preview) return;

    const closeBtn = preview.querySelector('.article-preview__close');
    if (closeBtn) closeBtn.addEventListener('click', closePreview);
    if (backdrop) backdrop.addEventListener('click', closePreview);

    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const aid = card.dataset.articleId;
        if (!aid) return;
        openPreview(aid);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePreview();
    });
  }

  function applyArticleFilter(cards) {
    const catBar = document.querySelector('.filter-bar--article-cat');
    const regBar = document.querySelector('.filter-bar--article-region');
    const catF = catBar ? (catBar.querySelector('.filter-chip--active') || {}).dataset?.filter || 'all' : 'all';
    const regF = regBar ? (regBar.querySelector('.filter-chip--active') || {}).dataset?.filter || 'all' : 'all';

    cards.forEach((c) => {
      const cMatch = catF === 'all' || c.dataset.category === catF;
      const rMatch = regF === 'all' || c.dataset.region === regF;
      c.style.display = (cMatch && rMatch) ? '' : 'none';
    });
  }

  function openPreview(id) {
    const dataEl = document.getElementById('articles-data');
    if (!dataEl) return;
    let data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
    const art = data.find((a) => a.id === id);
    if (!art) return;

    const lang = document.documentElement.lang || 'zh';
    const preview = document.getElementById('article-preview');
    const backdrop = document.getElementById('article-preview-backdrop');

    preview.querySelector('.article-preview__headline').textContent = art.headline[lang];
    preview.querySelector('.article-preview__deck').textContent = art.deck[lang];

    const sectionsList = preview.querySelector('.article-preview__sections-list');
    sectionsList.innerHTML = '';
    (art.sections[lang] || []).forEach((s, i) => {
      const div = document.createElement('div');
      div.className = 'article-preview__section-item';
      div.innerHTML = '<span class="article-preview__section-num">' + (i + 1) + '</span><span class="article-preview__section-name">' + escHtml(s) + '</span>';
      sectionsList.appendChild(div);
    });

    const authors = art.authors.map((a) => a[lang]).join(', ');
    preview.querySelector('.article-preview__footer').innerHTML =
      '<span>' + escHtml(authors) + '</span><span>' + escHtml(art.date) + ' · ' + escHtml(art.readingTime[lang]) + '</span>';

    preview.classList.add('article-preview--open');
    if (backdrop) backdrop.classList.add('article-preview__backdrop--visible');
    document.body.style.overflow = 'hidden';
  }

  function closePreview() {
    const preview = document.getElementById('article-preview');
    const backdrop = document.getElementById('article-preview-backdrop');
    if (preview) preview.classList.remove('article-preview--open');
    if (backdrop) backdrop.classList.remove('article-preview__backdrop--visible');
    document.body.style.overflow = '';
  }

  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Articles.init());
} else {
  Articles.init();
}
