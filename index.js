// ============================================
// JOLLOF HOUSE — Nigerian Kitchen
// ============================================

const cart = new Map();
const productsByName = new Map();
const productsById = new Map();
const cartStorageKey = 'jollof-house-cart';

document.addEventListener('DOMContentLoaded', () => {
  initHeaderScroll();
  initMobileNav();
  initCartSystem();
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

/* ---------- Cart and server menu ---------- */
function initCartSystem() {
  try {
    const savedCart = JSON.parse(localStorage.getItem(cartStorageKey) || '[]');
    if (Array.isArray(savedCart)) {
      savedCart.forEach(({ id, quantity }) => {
        if (typeof id === 'string' && Number.isInteger(quantity) && quantity > 0 && quantity <= 50) {
          cart.set(id, quantity);
        }
      });
    }
  } catch {
    localStorage.removeItem(cartStorageKey);
  }

  document.querySelectorAll('.menu-item-link, .order-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const product = productsByName.get(link.dataset.item || '');
      if (!product) return;
      changeCartQuantity(product.id, 1);
      if (link.classList.contains('menu-item-link')) {
        document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  fetch('/api/menu')
    .then((response) => {
      if (!response.ok) throw new Error('Could not load the menu. Start the app with npm start.');
      return response.json();
    })
    .then((products) => {
      products.forEach((product) => {
        productsById.set(product.id, product);
        productsByName.set(product.name, product);
      });
      for (const id of cart.keys()) {
        if (!productsById.has(id)) cart.delete(id);
      }
      persistCart();
      renderCart();
    })
    .catch(() => {
      const status = document.getElementById('paymentStatus');
      if (status) {
        status.textContent = 'Ordering is temporarily unavailable. Please try again shortly or contact the restaurant.';
        status.classList.add('is-error');
      }
    });

  document.getElementById('cartItems')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const quantity = cart.get(id) || 0;
    if (button.dataset.action === 'increase') changeCartQuantity(id, 1);
    if (button.dataset.action === 'decrease') changeCartQuantity(id, -1);
    if (button.dataset.action === 'remove') changeCartQuantity(id, -quantity);
  });
}

function changeCartQuantity(id, change) {
  const current = cart.get(id) || 0;
  const next = Math.max(0, Math.min(50, current + change));
  if (!next) cart.delete(id);
  else cart.set(id, next);
  persistCart();
  renderCart();
}

function persistCart() {
  try {
    localStorage.setItem(cartStorageKey, JSON.stringify([...cart].map(([id, quantity]) => ({ id, quantity }))));
  } catch {
    // The cart still works for this page view when browser storage is unavailable.
  }
}

function formatNaira(amount) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
}

function renderCart() {
  const cartItems = document.getElementById('cartItems');
  if (!cartItems) return;
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  const total = [...cart].reduce((sum, [id, quantity]) => sum + (productsById.get(id)?.price || 0) * quantity, 0);
  const countElement = document.getElementById('cartCount');
  const totalElement = document.getElementById('cartTotal');
  if (countElement) countElement.textContent = `${count} item${count === 1 ? '' : 's'}`;
  if (totalElement) totalElement.textContent = formatNaira(total);
  cartItems.replaceChildren();

  const visibleItems = [...cart].filter(([id]) => productsById.has(id));
  if (!visibleItems.length) {
    const empty = document.createElement('p');
    empty.className = 'cart-empty';
    empty.textContent = 'Your cart is empty. Add a dish from the menu.';
    cartItems.append(empty);
    return;
  }

  visibleItems.forEach(([id, quantity]) => {
    const product = productsById.get(id);
    const row = document.createElement('div');
    row.className = 'cart-row';
    const description = document.createElement('div');
    description.className = 'cart-item-description';
    const name = document.createElement('strong');
    name.textContent = product.name;
    const price = document.createElement('span');
    price.textContent = formatNaira(product.price * quantity);
    description.append(name, price);

    const controls = document.createElement('div');
    controls.className = 'cart-controls';
    controls.append(
      createCartButton('−', 'decrease', id, `Remove one ${product.name}`),
      Object.assign(document.createElement('span'), { textContent: quantity }),
      createCartButton('+', 'increase', id, `Add one ${product.name}`),
      createCartButton('Remove', 'remove', id, `Remove ${product.name} from cart`)
    );
    row.append(description, controls);
    cartItems.append(row);
  });
}

function createCartButton(label, action, id, accessibleName) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = action === 'remove' ? 'cart-remove' : 'cart-quantity-button';
  button.dataset.action = action;
  button.dataset.id = id;
  button.setAttribute('aria-label', accessibleName);
  button.textContent = label;
  return button;
}

/* ---------- Submit an order to the backend ---------- */
function initOrderForm() {
  const form = document.getElementById('orderForm');
  const status = document.getElementById('paymentStatus');
  if (!form || !status) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!cart.size) {
      status.textContent = 'Add at least one item to your cart before placing an order.';
      status.classList.add('is-error');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    status.classList.remove('is-error', 'success');
    status.textContent = 'Sending your order…';

    try {
      const formData = new FormData(form);
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          address: formData.get('address'),
          notes: formData.get('notes'),
          items: [...cart].map(([id, quantity]) => ({ id, quantity }))
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The order could not be placed.');
      status.textContent = `Order #${result.orderId} received. Total: ${formatNaira(result.total)}. Payment is due on delivery or pickup.`;
      status.classList.add('success');
      form.reset();
      cart.clear();
      persistCart();
      renderCart();
    } catch (error) {
      status.textContent = error.message || 'The order could not be placed. Please try again.';
      status.classList.add('is-error');
    } finally {
      submitButton.disabled = false;
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