let TOKEN = null;
let products = [];
let orders = [];
let clients = [];
let stats = null;
let solicitudes = [];
let orderFilter = 'todos';
let pendingDeleteId = null;

document.addEventListener('DOMContentLoaded', () => {
  bindAdminEvents();
  bindModalOverlays();
  initializeAdmin();
});

async function initializeAdmin() {
  TOKEN = sessionStorage.getItem('bielsa_token');
  if (!TOKEN) {
    location.href = '/login';
    return;
  }

  try {
    const response = await fetch('/api/auth/check', { headers: { Authorization: 'Bearer ' + TOKEN } });
    if (!response.ok) {
      sessionStorage.removeItem('bielsa_token');
      location.href = '/login';
      return;
    }

    const data = await response.json();
    document.getElementById('sidebarUser').textContent = '👤 ' + data.username;
    await loadAll();
  } catch {
    location.href = '/login';
  }
}

function bindAdminEvents() {
  document.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => showPage(button.dataset.page, button));
  });

  document.querySelectorAll('[data-order-filter]').forEach((button) => {
    button.addEventListener('click', () => filterOrders(button.dataset.orderFilter, button));
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.closeModal));
  });

  document.getElementById('openStoreBtn')?.addEventListener('click', () => window.open('/'));
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('viewAllOrdersBtn')?.addEventListener('click', () => {
    const ordersButton = document.querySelector('[data-page="orders"]');
    showPage('orders', ordersButton);
  });
  document.getElementById('orderSearch')?.addEventListener('input', renderOrders);
  document.getElementById('productSearch')?.addEventListener('input', renderProducts);
  document.getElementById('clientSearch')?.addEventListener('input', renderClients);
  document.getElementById('addProductBtn')?.addEventListener('click', addProduct);
  document.getElementById('saveEditBtn')?.addEventListener('click', saveEdit);
  document.getElementById('confirmOkBtn')?.addEventListener('click', doDelete);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) {
      return;
    }

    const orderId = Number(button.dataset.orderId);
    const productId = Number(button.dataset.productId);
    const clientId = Number(button.dataset.clientId);

    if (button.dataset.action === 'open-order') {
      openOrder(orderId);
      return;
    }

    if (button.dataset.action === 'open-edit') {
      openEdit(productId);
      return;
    }

    if (button.dataset.action === 'confirm-delete') {
      confirmDelete(productId, decodeURIComponent(button.dataset.productName || ''));
      return;
    }

    if (button.dataset.action === 'approve-client') {
      aprobarCliente(clientId);
      return;
    }

    if (button.dataset.action === 'reject-client') {
      rechazarCliente(clientId);
    }
  });

  document.addEventListener('change', (event) => {
    if (!event.target.matches('.status-sel[data-order-id]')) {
      return;
    }

    changeStatus(Number(event.target.dataset.orderId), event.target.value);
  });
}

function bindModalOverlays() {
  document.querySelectorAll('.modal-bg').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.classList.remove('open');
      }
    });
  });
}

function logout() {
  sessionStorage.removeItem('bielsa_token');
  location.href = '/login';
}

async function loadAll() {
  await Promise.all([loadStats(), loadOrders(), loadProducts(), loadClients()]);
}

async function loadStats() {
  try {
    const response = await fetch('/api/stats', { headers: { Authorization: 'Bearer ' + TOKEN } });
    stats = await response.json();
    renderStats();
    renderCharts();
    renderRecentOrders();
  } catch (error) {
    console.error(error);
  }
}

async function loadOrders() {
  try {
    const response = await fetch('/api/orders', { headers: { Authorization: 'Bearer ' + TOKEN } });
    orders = await response.json();
    renderOrders();
    updatePendingBadge();
  } catch (error) {
    console.error(error);
  }
}

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    products = await response.json();
    renderProducts();
    document.getElementById('productCount').textContent = products.length;
  } catch (error) {
    console.error(error);
  }
}

async function loadClients() {
  try {
    const response = await fetch('/api/clients', { headers: { Authorization: 'Bearer ' + TOKEN } });
    clients = await response.json();
    renderClients();
    document.getElementById('clientCount').textContent = clients.length;
  } catch (error) {
    console.error(error);
  }
}

function showPage(id, button) {
  document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((navButton) => navButton.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  button?.classList.add('active');

  if (id === 'solicitudes') {
    loadSolicitudes();
  }
}

function renderStats() {
  if (!stats) {
    return;
  }

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat"><span class="icon">📋</span><div class="num">${stats.totalOrders}</div><div class="lbl">Pedidos totales</div><div class="sub">${stats.monthOrders} este mes</div></div>
    <div class="stat red"><span class="icon">⏳</span><div class="num">${stats.pendingOrders}</div><div class="lbl">Pendientes</div><div class="sub">Requieren acción</div></div>
    <div class="stat gold"><span class="icon">💶</span><div class="num">${stats.monthRevenue.toFixed(0)}€</div><div class="lbl">Ingresos mes</div><div class="sub">${stats.totalRevenue.toFixed(0)}€ total</div></div>
    <div class="stat blue"><span class="icon">👥</span><div class="num">${stats.totalClients}</div><div class="lbl">Clientes B2B</div></div>
    <div class="stat"><span class="icon">📦</span><div class="num">${stats.totalProducts}</div><div class="lbl">Productos</div></div>`;
}

function renderCharts() {
  if (!stats) {
    return;
  }

  const bars = document.getElementById('barChart');
  const labels = document.getElementById('barLabels');
  const max = Math.max(...stats.last7.map((day) => day.pedidos), 1);
  bars.innerHTML = stats.last7.map((day) => `
    <div class="bar-col">
      <div class="bar" style="height:${Math.max((day.pedidos / max) * 100, 2)}px" data-val="${day.pedidos} pedidos"></div>
    </div>`).join('');
  labels.innerHTML = stats.last7.map((day) => `<div style="flex:1;text-align:center;font-size:.62rem;color:var(--muted)">${day.dia}</div>`).join('');

  const byStatus = stats.byStatus || {};
  const colors = { pendiente: '#e8b84b', confirmado: '#5a9fe0', en_preparacion: '#a8c45a', enviado: '#c0dd6a', entregado: '#70a830', cancelado: '#e05a5a' };
  const labelsMap = { pendiente: 'Pendiente', confirmado: 'Confirmado', en_preparacion: 'En prep.', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };
  const total = Object.values(byStatus).reduce((sum, value) => sum + value, 0) || 1;
  const canvas = document.getElementById('donutCanvas');
  const context = canvas.getContext('2d');
  let angle = -Math.PI / 2;

  context.clearRect(0, 0, 100, 100);
  Object.entries(byStatus).forEach(([status, value]) => {
    const slice = (value / total) * Math.PI * 2;
    context.beginPath();
    context.moveTo(50, 50);
    context.arc(50, 50, 38, angle, angle + slice);
    context.closePath();
    context.fillStyle = colors[status] || '#555';
    context.fill();
    angle += slice;
  });

  context.beginPath();
  context.arc(50, 50, 22, 0, Math.PI * 2);
  context.fillStyle = '#1c1e14';
  context.fill();

  document.getElementById('donutLegend').innerHTML = Object.entries(byStatus).map(([status, value]) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[status] || '#555'}"></span>
      <span style="color:var(--muted)">${labelsMap[status] || status}</span>
      <span class="legend-val">${value}</span>
    </div>`).join('');

  const topList = document.getElementById('topList');
  if (!stats.topProducts?.length) {
    topList.innerHTML = '<div class="table-state" style="padding:1rem">Sin datos aún</div>';
    return;
  }

  const maxQuantity = stats.topProducts[0].cantidad || 1;
  topList.innerHTML = stats.topProducts.map((product, index) => `
    <div class="top-item">
      <div class="top-rank">${index + 1}</div>
      <div class="top-name">${product.nombre}</div>
      <div class="top-bar-wrap"><div class="top-bar" style="width:${(product.cantidad / maxQuantity) * 100}%"></div></div>
      <div class="top-qty">${product.cantidad} u.</div>
    </div>`).join('');
}

function renderRecentOrders() {
  const recent = [...orders].slice(0, 5);
  const container = document.getElementById('recentOrdersTable');
  container.innerHTML = recent.length ? buildOrdersTable(recent, true) : '<div class="table-state">Sin pedidos aún</div>';
}

function updatePendingBadge() {
  const count = orders.filter((order) => order.estado === 'pendiente').length;
  const badge = document.getElementById('pendingBadge');
  badge.style.display = count ? 'inline-block' : 'none';
  badge.textContent = count;
}

function filterOrders(filter, button) {
  orderFilter = filter;
  document.querySelectorAll('#orderChips .chip').forEach((chip) => chip.classList.remove('active'));
  button?.classList.add('active');
  renderOrders();
}

function renderOrders() {
  const query = (document.getElementById('orderSearch')?.value || '').toLowerCase();
  let list = orderFilter === 'todos' ? orders : orders.filter((order) => order.estado === orderFilter);
  if (query) {
    list = list.filter((order) => (order.clienteNombre + order.clienteEmpresa + order.clienteEmail).toLowerCase().includes(query));
  }

  document.getElementById('ordersTable').innerHTML = list.length
    ? buildOrdersTable(list, false)
    : '<div class="table-state">No hay pedidos con este filtro</div>';
}

function buildOrdersTable(list, compact) {
  const statusMap = { pendiente: 'badge-pending', confirmado: 'badge-confirmed', en_preparacion: 'badge-prep', enviado: 'badge-sent', entregado: 'badge-done', cancelado: 'badge-cancelled' };
  const statusLabel = { pendiente: 'Pendiente', confirmado: 'Confirmado', en_preparacion: 'En prep.', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };
  const statusOptions = ['pendiente', 'confirmado', 'en_preparacion', 'enviado', 'entregado', 'cancelado'];

  return `<table><thead><tr>
    <th>#</th><th>Cliente</th><th>Empresa</th><th>Importe</th><th>Estado</th><th>Fecha</th><th></th>
  </tr></thead><tbody>
  ${list.map((order) => `<tr>
    <td style="color:var(--muted)">${order.id}</td>
    <td class="td-bold">${order.clienteNombre || '—'}</td>
    <td style="color:var(--muted)">${order.clienteEmpresa || '—'}</td>
    <td style="color:var(--accent);font-weight:500">${order.total.toFixed(2)} €</td>
    <td>
      ${compact
        ? `<span class="badge ${statusMap[order.estado] || ''}">${statusLabel[order.estado] || order.estado}</span>`
        : `<select class="status-sel" data-order-id="${order.id}">
            ${statusOptions.map((status) => `<option value="${status}" ${order.estado === status ? 'selected' : ''}>${statusLabel[status]}</option>`).join('')}
           </select>`}
    </td>
    <td style="color:var(--muted);font-size:.78rem">${new Date(order.createdAt).toLocaleDateString('es-ES')}</td>
    <td><button class="btn btn-ghost" style="padding:.3rem .7rem;font-size:.75rem" data-action="open-order" data-order-id="${order.id}">Ver</button></td>
  </tr>`).join('')}
  </tbody></table>`;
}

async function changeStatus(id, estado) {
  try {
    const response = await fetch('/api/orders/' + id + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify({ estado })
    });

    if (!response.ok) {
      throw new Error();
    }

    const index = orders.findIndex((order) => order.id === id);
    if (index > -1) {
      orders[index].estado = estado;
    }

    updatePendingBadge();
    toast('✓ Estado actualizado');
    loadStats();
  } catch {
    toast('Error al actualizar', 'err');
  }
}

function openOrder(id) {
  const order = orders.find((item) => item.id === id);
  if (!order) {
    return;
  }

  document.getElementById('modalOrderId').textContent = order.id;
  document.getElementById('modalOrderContent').innerHTML = `
    <div class="order-meta">
      <span class="k">Cliente</span><span class="v">${order.clienteNombre || '—'}</span>
      <span class="k">Empresa</span><span class="v">${order.clienteEmpresa || '—'}</span>
      <span class="k">Email</span><span class="v">${order.clienteEmail || '—'}</span>
      <span class="k">Fecha entrega</span><span class="v">${order.fechaEntrega || 'No especificada'}</span>
      <span class="k">Fecha pedido</span><span class="v">${new Date(order.createdAt).toLocaleString('es-ES')}</span>
      <span class="k">Estado</span><span class="v">${order.estado}</span>
    </div>
    ${order.nota ? `<div style="background:var(--bg);border:1px solid var(--border);border-radius:2px;padding:.7rem;font-size:.82rem;color:var(--muted);margin-bottom:.8rem">📝 ${order.nota}</div>` : ''}
    <table class="order-items-table">
      <thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${order.items.map((item) => `<tr>
          <td>${item.emoji || ''} ${item.nombre}</td>
          <td>${item.precio.toFixed(2)} €/${item.unidad}</td>
          <td>${item.cantidad} ${item.unidad}</td>
          <td style="color:var(--accent)">${(item.precio * item.cantidad).toFixed(2)} €</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="order-total-row"><span>Total del pedido</span><span>${order.total.toFixed(2)} €</span></div>`;
  document.getElementById('orderModal').classList.add('open');
}

function renderProducts() {
  const query = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const list = query
    ? products.filter((product) => product.name.toLowerCase().includes(query) || product.category.includes(query))
    : products;

  const table = document.getElementById('productsTable');
  if (!list.length) {
    table.innerHTML = '<div class="table-state">Sin productos</div>';
    return;
  }

  table.innerHTML = `<table><thead><tr>
    <th></th><th>Nombre</th><th>Cat.</th><th>Precio</th><th>Unidad</th><th>Origen</th><th>Mín.</th><th>Badge</th><th>Acciones</th>
  </tr></thead><tbody>
  ${list.map((product) => `<tr>
    <td style="font-size:1.4rem">${product.emoji}</td>
    <td class="td-bold">${product.name}</td>
    <td><span style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">${product.category}</span></td>
    <td style="color:var(--accent);font-weight:500">${parseFloat(product.price).toFixed(2)} €</td>
    <td style="color:var(--muted)">${product.unit}</td>
    <td style="color:var(--muted)">${product.origin || '—'}</td>
    <td style="color:var(--muted)">${product.minOrder || '—'}</td>
    <td>${product.badge ? `<span class="badge ${product.badgeType === 'eco' ? 'badge-eco' : 'badge-season'}">${product.badge}</span>` : '—'}</td>
    <td style="display:flex;gap:.4rem">
      <button class="btn btn-ghost" style="padding:.3rem .6rem;font-size:.72rem" data-action="open-edit" data-product-id="${product.id}">✏️</button>
      <button class="btn btn-red" style="padding:.3rem .6rem;font-size:.72rem" data-action="confirm-delete" data-product-id="${product.id}" data-product-name="${encodeURIComponent(product.name)}">🗑</button>
    </td>
  </tr>`).join('')}
  </tbody></table>`;
  document.getElementById('productCount').textContent = products.length;
}

async function addProduct() {
  const name = document.getElementById('fn').value.trim();
  const price = document.getElementById('fpr').value;
  const category = document.getElementById('fcat').value;

  if (!name || !price) {
    showProductMsg('Nombre y precio son obligatorios', 'err');
    return;
  }

  const button = document.getElementById('addProductBtn');
  button.disabled = true;
  button.textContent = 'Añadiendo...';

  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify({
        name,
        category,
        emoji: document.getElementById('fem').value || '📦',
        price: parseFloat(price),
        unit: document.getElementById('fun').value,
        origin: document.getElementById('for').value.trim(),
        minOrder: document.getElementById('fmo').value.trim(),
        badge: document.getElementById('fba').value.trim(),
        badgeType: document.getElementById('fbt').value
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error);
    }

    products.push(data);
    renderProducts();
    showProductMsg('✓ Producto añadido', 'ok');
    ['fn', 'fem', 'fpr', 'for', 'fmo', 'fba'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    toast('✓ ' + data.name + ' añadido');
  } catch (error) {
    showProductMsg('Error: ' + error.message, 'err');
  } finally {
    button.disabled = false;
    button.textContent = 'Añadir producto';
  }
}

function showProductMsg(message, type) {
  const element = document.getElementById('productMsg');
  element.textContent = message;
  element.className = 'msg ' + type;
  setTimeout(() => {
    element.textContent = '';
  }, 4000);
}

function openEdit(id) {
  const product = products.find((item) => item.id === id);
  if (!product) {
    return;
  }

  document.getElementById('editId').value = id;
  document.getElementById('en').value = product.name;
  document.getElementById('ecat').value = product.category;
  document.getElementById('eem').value = product.emoji;
  document.getElementById('epr').value = product.price;
  document.getElementById('eun').value = product.unit;
  document.getElementById('eor').value = product.origin || '';
  document.getElementById('emo').value = product.minOrder || '';
  document.getElementById('eba').value = product.badge || '';
  document.getElementById('ebt').value = product.badgeType || '';
  document.getElementById('editModal').classList.add('open');
}

async function saveEdit() {
  const id = parseInt(document.getElementById('editId').value, 10);
  const body = {
    name: document.getElementById('en').value,
    category: document.getElementById('ecat').value,
    emoji: document.getElementById('eem').value,
    price: parseFloat(document.getElementById('epr').value),
    unit: document.getElementById('eun').value,
    origin: document.getElementById('eor').value,
    minOrder: document.getElementById('emo').value,
    badge: document.getElementById('eba').value,
    badgeType: document.getElementById('ebt').value
  };

  try {
    const response = await fetch('/api/products/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error);
    }

    const index = products.findIndex((product) => product.id === id);
    if (index > -1) {
      products[index] = data;
    }

    renderProducts();
    closeModal('editModal');
    toast('✓ Producto actualizado');
  } catch (error) {
    document.getElementById('editMsg').className = 'msg err';
    document.getElementById('editMsg').textContent = 'Error: ' + error.message;
  }
}

function confirmDelete(id, name) {
  pendingDeleteId = id;
  document.getElementById('confirmText').textContent = `¿Eliminar "${name}"? Esta acción no se puede deshacer.`;
  document.getElementById('confirmModal').classList.add('open');
}

async function doDelete() {
  if (!pendingDeleteId) {
    return;
  }

  closeModal('confirmModal');

  try {
    const response = await fetch('/api/products/' + pendingDeleteId, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + TOKEN }
    });

    if (!response.ok) {
      throw new Error();
    }

    products = products.filter((product) => product.id !== pendingDeleteId);
    renderProducts();
    toast('🗑 Producto eliminado');
  } catch {
    toast('Error al eliminar', 'err');
  }

  pendingDeleteId = null;
}

function renderClients() {
  const query = (document.getElementById('clientSearch')?.value || '').toLowerCase();
  const list = query
    ? clients.filter((client) => (client.nombre + client.empresa + client.email).toLowerCase().includes(query))
    : clients;

  const table = document.getElementById('clientsTable');
  if (!list.length) {
    table.innerHTML = '<div class="table-state">Sin clientes registrados aún</div>';
    return;
  }

  table.innerHTML = `<table><thead><tr>
    <th>#</th><th>Nombre</th><th>Empresa</th><th>CIF</th><th>Email</th><th>Teléfono</th><th>Registro</th>
  </tr></thead><tbody>
  ${list.map((client) => `<tr>
    <td style="color:var(--muted)">${client.id}</td>
    <td class="td-bold">${client.nombre}</td>
    <td style="color:var(--muted)">${client.empresa || '—'}</td>
    <td style="color:var(--muted);font-size:.78rem">${client.cif || '—'}</td>
    <td style="color:var(--muted)">${client.email}</td>
    <td style="color:var(--muted)">${client.telefono || '—'}</td>
    <td style="color:var(--muted);font-size:.75rem">${new Date(client.createdAt).toLocaleDateString('es-ES')}</td>
  </tr>`).join('')}
  </tbody></table>`;
  document.getElementById('clientCount').textContent = clients.length;
}

async function loadSolicitudes() {
  try {
    const response = await fetch('/api/notifications', { headers: { Authorization: 'Bearer ' + TOKEN } });
    const data = await response.json();
    solicitudes = data.pendingClients || [];

    const badge = document.getElementById('solicitudesBadge');
    if (solicitudes.length > 0) {
      badge.textContent = solicitudes.length;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }

    renderSolicitudes();
  } catch (error) {
    console.error(error);
  }
}

function renderSolicitudes() {
  const container = document.getElementById('solicitudesContainer');
  if (!solicitudes.length) {
    container.innerHTML = '<div class="empty-sol">✅ No hay solicitudes pendientes</div>';
    return;
  }

  container.innerHTML = solicitudes.map((solicitud) => `
    <div class="sol-card" id="sol-${solicitud.id}">
      <div class="sol-avatar">🏪</div>
      <div class="sol-info">
        <div class="sol-name">${solicitud.nombre} ${solicitud.empresa ? '· ' + solicitud.empresa : ''}</div>
        <div class="sol-detail">📧 ${solicitud.email}${solicitud.telefono ? ' · 📞 ' + solicitud.telefono : ''}${solicitud.cif ? ' · CIF: ' + solicitud.cif : ''}</div>
        <div class="sol-date">Solicitado el ${new Date(solicitud.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      <div class="sol-actions">
        <button class="btn-approve" data-action="approve-client" data-client-id="${solicitud.id}">✓ Aprobar</button>
        <button class="btn-reject" data-action="reject-client" data-client-id="${solicitud.id}">✕ Rechazar</button>
      </div>
    </div>`).join('');
}

async function aprobarCliente(id) {
  try {
    const response = await fetch('/api/clients/' + id + '/approve', { method: 'PUT', headers: { Authorization: 'Bearer ' + TOKEN } });
    if (!response.ok) {
      throw new Error();
    }

    solicitudes = solicitudes.filter((solicitud) => solicitud.id !== id);
    document.getElementById('sol-' + id)?.remove();
    if (!solicitudes.length) {
      renderSolicitudes();
    }

    const badge = document.getElementById('solicitudesBadge');
    badge.textContent = solicitudes.length;
    if (!solicitudes.length) {
      badge.style.display = 'none';
    }

    toast('✅ Cuenta aprobada: el cliente ya puede acceder');
    if (clients.length) {
      clients = await fetch('/api/clients', { headers: { Authorization: 'Bearer ' + TOKEN } }).then((res) => res.json());
      renderClients();
    }
  } catch {
    toast('Error al aprobar', 'err');
  }
}

async function rechazarCliente(id) {
  try {
    const response = await fetch('/api/clients/' + id + '/reject', { method: 'PUT', headers: { Authorization: 'Bearer ' + TOKEN } });
    if (!response.ok) {
      throw new Error();
    }

    solicitudes = solicitudes.filter((solicitud) => solicitud.id !== id);
    document.getElementById('sol-' + id)?.remove();
    if (!solicitudes.length) {
      renderSolicitudes();
    }

    const badge = document.getElementById('solicitudesBadge');
    badge.textContent = solicitudes.length;
    if (!solicitudes.length) {
      badge.style.display = 'none';
    }

    toast('Solicitud rechazada');
  } catch {
    toast('Error al rechazar', 'err');
  }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function toast(message, type = '') {
  const element = document.getElementById('toast');
  element.textContent = message;
  element.className = 'toast ' + (type ? type + ' ' : '') + 'show';
  setTimeout(() => element.classList.remove('show'), 2400);
}
