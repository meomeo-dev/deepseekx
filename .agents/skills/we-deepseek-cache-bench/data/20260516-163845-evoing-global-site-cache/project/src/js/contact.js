/**
 * Evoing Contact — client-side form validation with inline error messages.
 */
const ContactForm = (() => {
  function init() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const nameEl = form.querySelector('[name="name"]');
    const emailEl = form.querySelector('[name="email"]');
    const companyEl = form.querySelector('[name="company"]');
    const capabilityEl = form.querySelector('[name="capability"]');
    const messageEl = form.querySelector('[name="message"]');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearErrors(form);

      let valid = true;

      if (!nameEl || !nameEl.value.trim()) {
        showError(nameEl || form.querySelector('[name="name"]'), 'Name is required.');
        valid = false;
      }

      if (!emailEl || !isValidEmail(emailEl.value)) {
        showError(emailEl || form.querySelector('[name="email"]'), 'A valid email is required.');
        valid = false;
      }

      if (!messageEl || !messageEl.value.trim()) {
        showError(messageEl || form.querySelector('[name="message"]'), 'Please enter a message.');
        valid = false;
      }

      if (!valid) return;

      /* Simulate submission */
      const btn = form.querySelector('button[type="submit"]');
      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending...';
      setTimeout(() => {
        btn.textContent = origText;
        btn.disabled = false;
        form.reset();
        showToast('Thank you — our team will reach out within 24 hours.');
      }, 800);
    });

    /* Clear error on input */
    form.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', () => clearError(el));
    });
  }

  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val || '');
  }

  function showError(el, msg) {
    if (!el) return;
    el.classList.add('contact-form__input--error');
    const err = document.createElement('span');
    err.className = 'contact-form__error';
    err.textContent = msg;
    el.parentNode.appendChild(err);
  }

  function clearError(el) {
    if (!el) return;
    el.classList.remove('contact-form__input--error');
    const err = el.parentNode.querySelector('.contact-form__error');
    if (err) err.remove();
  }

  function clearErrors(form) {
    form.querySelectorAll('.contact-form__error').forEach((e) => e.remove());
    form.querySelectorAll('.contact-form__input--error').forEach((e) => e.classList.remove('contact-form__input--error'));
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ContactForm.init());
} else {
  ContactForm.init();
}
