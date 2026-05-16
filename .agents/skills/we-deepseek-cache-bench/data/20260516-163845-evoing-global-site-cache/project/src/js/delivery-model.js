/* Evoing Global Delivery Model — engagement tabs */
const DeliveryModel = (() => {
  function init() {
    const tabs = document.querySelectorAll('.delivery-tab');
    const panels = document.querySelectorAll('.delivery-panel');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('delivery-tab--active'));
        tab.classList.add('delivery-tab--active');
        panels.forEach((p) => p.classList.remove('delivery-panel--active'));
        const target = document.getElementById('delivery-panel-' + tab.dataset.engagement);
        if (target) target.classList.add('delivery-panel--active');
      });
    });
  }
  return { init };
})();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => DeliveryModel.init()); else DeliveryModel.init();
