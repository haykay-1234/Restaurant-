// ============================================
// JOLLOF HOUSE — Nigerian Kitchen
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initHeaderScroll();
  initMobileNav();
  initMenuOrderSelection();
  initOrderForm();
  initReservationForm();
  initContactForm();
  setFooterYear();
});

/* ---------- Header changes appearance on scroll ---------- */
function initHeaderScroll() {
  const header = document.getElementById('siteHeader');
  if (!header) return;

  const onScroll = () => {
    if (window.scrollY > 40) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  };

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---------- Mobile nav toggle ---------- */
function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('primaryNav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close the menu after a link is tapped (mobile UX)
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------- Menu item order links ---------- */
function initMenuOrderSelection() {
  const orderSelect = document.getElementById('order-item');
  if (!orderSelect) return;

  const selectItem = (item) => {
    if (!item) return;
    orderSelect.value = item;
  };

  document.querySelectorAll('.menu-item-link, .order-link').forEach((link) => {
    link.addEventListener('click', () => {
      selectItem(link.dataset.item || '');
    });
  });
}

/* ---------- Order form with payment UI ---------- */
function initOrderForm() {
  const form = document.getElementById('orderForm');
  const status = document.getElementById('paymentStatus');
  if (!form || !status) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const item = form.item.value.trim();
    const address = form.address.value.trim();
    const cardName = form.card_name.value.trim();
    const cardNumber = form.card_number.value.replace(/\s+/g, '');
    const cardExpiry = form.card_expiry.value.trim();
    const cardCvv = form.card_cvv.value.trim();

    if (!name || !email || !item || !address || !cardName || !cardNumber || !cardExpiry || !cardCvv) {
      status.textContent = 'Please complete all required fields before placing the order.';
      status.classList.add('is-error');
      status.classList.remove('success');
      return;
    }

    if (!isValidEmail(email)) {
      status.textContent = 'Please enter a valid email address.';
      status.classList.add('is-error');
      status.classList.remove('success');
      return;
    }

    if (cardNumber.length < 12 || cardCvv.length < 3) {
      status.textContent = 'Please enter a valid card number and CVV.';
      status.classList.add('is-error');
      status.classList.remove('success');
      return;
    }

    status.classList.remove('is-error');
    status.textContent = 'Processing your payment...';

    try {
      await fetch(form.action, {
        method: form.method,
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      });

      status.textContent = 'Successful order received!';
      status.classList.add('success');
      form.reset();
    } catch (error) {
      status.textContent = 'Payment step failed in the browser demo. Please try again.';
      status.classList.add('is-error');
      status.classList.remove('success');
    }
  });
}

/* ---------- Reservation form validation ---------- */
function initReservationForm() {
  const form = document.getElementById('reserveForm');
  const status = document.getElementById('formStatus');
  if (!form || !status) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors(form);

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const date = form.date.value;
    const time = form.time.value;

    let hasError = false;

    if (name.length < 2) {
      showError('name', 'Please enter your name.');
      hasError = true;
    }

    if (!isValidEmail(email)) {
      showError('email', 'Please enter a valid email address.');
      hasError = true;
    }

    if (!date) {
      showError('date', 'Please choose a date.');
      hasError = true;
    } else if (new Date(date) < new Date(new Date().toDateString())) {
      showError('date', 'Please choose a date in the future.');
      hasError = true;
    }

    if (!time) {
      showError('time', 'Please choose a time.');
      hasError = true;
    }

    if (hasError) {
      status.textContent = 'Please fix the highlighted fields.';
      status.classList.add('is-error');
      return;
    }

    status.classList.remove('is-error');
    status.textContent = `Thanks, ${name.split(' ')[0]} — we'll confirm your table by email shortly.`;
    form.reset();
    form.guests.value = '2';
  });
}

/* ---------- Contact form validation ---------- */
function initContactForm() {
  const form = document.getElementById('contactForm');
  const status = document.getElementById('contactStatus');
  if (!form || !status) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearContactErrors(form, status);

    const name = form.cname.value.trim();
    const email = form.cemail.value.trim();
    const subject = form.csubject.value.trim();
    const message = form.cmessage.value.trim();

    let hasError = false;

    if (name.length < 2) {
      showError('cname', 'Please enter your name.');
      hasError = true;
    }

    if (!isValidEmail(email)) {
      showError('cemail', 'Please enter a valid email address.');
      hasError = true;
    }

    if (subject.length < 2) {
      showError('csubject', 'Please add a subject.');
      hasError = true;
    }

    if (message.length < 10) {
      showError('cmessage', 'Please write a message of at least 10 characters.');
      hasError = true;
    }

    if (hasError) {
      status.textContent = 'Please fix the highlighted fields.';
      status.classList.add('is-error');
      return;
    }

    status.classList.remove('is-error');
    status.textContent = `Thanks, ${name.split(' ')[0]} — we'll get back to you shortly.`;
    form.reset();
  });
}

function clearContactErrors(form, status) {
  form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
  status.textContent = '';
  status.classList.remove('is-error');
}

function showError(fieldName, message) {
  const el = document.getElementById(`err-${fieldName}`);
  if (el) el.textContent = message;
}

function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
  const status = document.getElementById('formStatus');
  if (status) {
    status.textContent = '';
    status.classList.remove('is-error');
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* ---------- Footer year ---------- */
function setFooterYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}