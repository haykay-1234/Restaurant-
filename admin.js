document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.getElementById('loginPanel');
  const ordersPanel = document.getElementById('ordersPanel');
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  const dashboardMessage = document.getElementById('dashboardMessage');
  const ordersList = document.getElementById('ordersList');
  const orderSummary = document.getElementById('orderSummary');

  const money = (value) => new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0
  }).format(value);

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
    return body;
  }

  function setAuthenticated(authenticated) {
    loginPanel.hidden = authenticated;
    ordersPanel.hidden = !authenticated;
  }

  function addText(parent, tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.append(element);
    return element;
  }

  function renderOrders(orders) {
    ordersList.replaceChildren();
    orderSummary.textContent = `${orders.length} order${orders.length === 1 ? '' : 's'} shown`;
    if (!orders.length) {
      addText(ordersList, 'p', 'admin-empty', 'No orders yet. New orders will appear here.');
      return;
    }

    for (const order of orders) {
      const card = document.createElement('article');
      card.className = 'admin-order-card';
      const heading = document.createElement('div');
      heading.className = 'admin-order-heading';
      const title = document.createElement('div');
      addText(title, 'h3', '', `Order #${order.id} · ${order.name}`);
      addText(title, 'p', 'admin-order-date', new Date(order.createdAt).toLocaleString());
      heading.append(title);
      addText(heading, 'strong', 'admin-order-total', money(order.total));
      card.append(heading);

      const details = document.createElement('div');
      details.className = 'admin-order-details';
      addText(details, 'p', '', `${order.email}${order.phone ? ` · ${order.phone}` : ''}`);
      addText(details, 'p', '', order.address);
      addText(details, 'p', '', `Payment: ${order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}`);
      addText(details, 'p', '', order.items.map((item) => `${item.quantity} × ${item.name} (${money(item.lineTotal)})`).join(' · '));
      if (order.notes) addText(details, 'p', 'admin-order-notes', `Notes: ${order.notes}`);
      card.append(details);

      const footer = document.createElement('div');
      footer.className = 'admin-order-footer';
      const label = document.createElement('label');
      label.textContent = 'Status';
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Status for order ${order.id}`);
      for (const status of ['pending', 'preparing', 'ready', 'completed', 'cancelled']) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status[0].toUpperCase() + status.slice(1);
        option.selected = status === order.status;
        select.append(option);
      }
      select.addEventListener('change', async () => {
        select.disabled = true;
        dashboardMessage.textContent = '';
        try {
          await request(`/api/admin/orders/${order.id}/status`, {
            method: 'PATCH', body: JSON.stringify({ status: select.value })
          });
          dashboardMessage.textContent = `Order #${order.id} updated.`;
        } catch (error) {
          dashboardMessage.textContent = error.message;
          select.value = order.status;
        } finally {
          select.disabled = false;
        }
      });
      label.append(select);
      footer.append(label);
      card.append(footer);
      ordersList.append(card);
    }
  }

  async function loadOrders() {
    dashboardMessage.textContent = '';
    orderSummary.textContent = 'Loading orders…';
    try {
      renderOrders(await request('/api/admin/orders'));
    } catch (error) {
      if (error.message.includes('sign in')) setAuthenticated(false);
      dashboardMessage.textContent = error.message;
      orderSummary.textContent = 'Could not load orders';
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginMessage.textContent = 'Signing in…';
    try {
      await request('/api/admin/login', {
        method: 'POST', body: JSON.stringify({ password: loginForm.password.value })
      });
      loginForm.reset();
      loginMessage.textContent = '';
      setAuthenticated(true);
      await loadOrders();
    } catch (error) {
      loginMessage.textContent = error.message;
    }
  });

  document.getElementById('refreshOrders').addEventListener('click', loadOrders);
  document.getElementById('logoutButton').addEventListener('click', async () => {
    await request('/api/admin/logout', { method: 'POST', body: '{}' });
    setAuthenticated(false);
    ordersList.replaceChildren();
  });

  request('/api/admin/session').then(() => {
    setAuthenticated(true);
    loadOrders();
  }).catch(() => setAuthenticated(false));
});
