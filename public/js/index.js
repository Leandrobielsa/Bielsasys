const API = '/api/products';
let allProducts = [];
let cart = {};
let activeFilter = 'todos';
let searchQuery = '';
let clientToken = null;
let clientData = null;

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  restoreTheme();
  restoreClientSession();
  loadProducts();
});

function bindEvents() {
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('searchInput')?.addEventListener('input', onSearch);
  document.getElementById('cartToggle')?.addEventListener('click', toggleCart);
  document.getElementById('closeCartBtn')?.addEventListener('click', toggleCart);
  document.getElementById('submitCartBtn')?.addEventListener('click', sendCartOrder);

  document.querySelectorAll('#filterBar .filter-btn').forEach((button) => {
    button.addEventListener('click', () => setFilter(button.dataset.filter, button));
  });

  document.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) {
      return;
    }

    const productId = Number(actionButton.dataset.productId);

    if (actionButton.dataset.action === 'add-to-cart') {
      addToCart(productId);
      return;
    }

    if (actionButton.dataset.action === 'change-qty') {
      changeQty(productId, Number(actionButton.dataset.delta));
    }
  });
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';

  html.setAttribute('data-theme', nextTheme);
  document.getElementById('themeBtn').textContent = nextTheme === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('bielsa_theme', nextTheme);
}

function restoreTheme() {
  const saved = localStorage.getItem('bielsa_theme');
  if (!saved) {
    return;
  }

  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeBtn').textContent = saved === 'dark' ? '🌙' : '☀️';
}

async function restoreClientSession() {
  clientToken = sessionStorage.getItem('bielsa_client_token');
  if (!clientToken) {
    return;
  }

  try {
    const response = await fetch('/api/cliente/check', {
      headers: { Authorization: 'Bearer ' + clientToken }
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    clientData = data.cliente;
    document.getElementById('navUser').textContent = '👋 ' + clientData.nombre.split(' ')[0];
    document.getElementById('navRegister').style.display = 'none';
  } catch {
    // Ignorar error: la sesión se validará al intentar comprar.
  }
}

async function loadProducts() {
  try {
    const response = await fetch(API);
    if (!response.ok) {
      throw new Error();
    }

    allProducts = await response.json();
    document.getElementById('productCountHero').textContent = allProducts.length;
    renderProducts();
  } catch {
    document.getElementById('productGrid').innerHTML = '<div class="no-results">⚠ No se pudo conectar con el servidor.</div>';
  }
}

function renderProducts() {
  const query = searchQuery.toLowerCase();
  let list = activeFilter === 'todos'
    ? allProducts
    : allProducts.filter((product) => product.category === activeFilter);

  if (query) {
    list = list.filter((product) => {
      return (product.name + product.category + product.origin).toLowerCase().includes(query);
    });
  }

  const grid = document.getElementById('productGrid');
  const resultCount = document.getElementById('resultCount');

  if (query || activeFilter !== 'todos') {
    resultCount.textContent = list.length + ' resultado' + (list.length !== 1 ? 's' : '') + ' encontrado' + (list.length !== 1 ? 's' : '');
  } else {
    resultCount.textContent = '';
  }

  if (!list.length) {
    grid.innerHTML = '<div class="no-results">🔍 No se encontraron productos con esa búsqueda.</div>';
    return;
  }

  grid.innerHTML = list.map((product) => `
    <div class="product-card">
      <div class="product-img">
        <span>${product.emoji}</span>
        ${product.badge ? `<span class="product-badge ${product.badgeType === 'eco' ? 'eco' : 'normal'}">${product.badge}</span>` : ''}
      </div>
      <div class="product-body">
        <div class="product-cat">${product.category}</div>
        <div class="product-name">${product.name}</div>
        <div class="product-origin">📍 ${product.origin || '—'} · Mín. ${product.minOrder || '—'}</div>
        <div class="product-footer">
          <div><span class="product-price">${parseFloat(product.price).toFixed(2).replace('.', ',')} €</span><span class="product-unit"> /${product.unit}</span></div>
          <button class="add-btn" data-action="add-to-cart" data-product-id="${product.id}">+ Añadir</button>
        </div>
      </div>
    </div>`).join('');
}

function onSearch() {
  searchQuery = document.getElementById('searchInput').value;
  if (searchQuery && activeFilter !== 'todos') {
    activeFilter = 'todos';
    document.querySelectorAll('.filter-btn').forEach((button) => button.classList.remove('active'));
    document.querySelector('.filter-btn')?.classList.add('active');
  }

  renderProducts();
}

function setFilter(category, button) {
  activeFilter = category;
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.filter-btn').forEach((filterButton) => filterButton.classList.remove('active'));
  button.classList.add('active');
  renderProducts();
}

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  updateCart();
  toast('✓ Añadido al pedido');
}

function changeQty(id, delta) {
  cart[id] = Math.max(0, (cart[id] || 0) + delta);
  if (!cart[id]) {
    delete cart[id];
  }

  updateCart();
}

function updateCart() {
  const count = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  document.getElementById('cartCount').textContent = count;

  const itemsContainer = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');

  if (!count) {
    itemsContainer.innerHTML = '<div class="empty-cart">Tu pedido está vacío.</div>';
    footer.style.display = 'none';
    return;
  }

  let total = 0;
  itemsContainer.innerHTML = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => {
      const product = allProducts.find((item) => item.id == id);
      if (!product) {
        return '';
      }

      total += product.price * quantity;
      return `<div class="cart-item">
        <div class="ci-emoji">${product.emoji}</div>
        <div class="ci-info"><div class="ci-name">${product.name}</div><div class="ci-price">${parseFloat(product.price).toFixed(2).replace('.', ',')} €/${product.unit}</div></div>
        <div class="ci-qty"><button class="qty-btn" data-action="change-qty" data-product-id="${id}" data-delta="-1">−</button><span style="min-width:18px;text-align:center;font-size:.82rem">${quantity}</span><button class="qty-btn" data-action="change-qty" data-product-id="${id}" data-delta="1">+</button></div>
      </div>`;
    })
    .join('');

  document.getElementById('cartTotal').textContent = total.toFixed(2).replace('.', ',') + ' €';
  footer.style.display = 'block';
}

function toggleCart() {
  document.getElementById('cartPanel').classList.toggle('open');
}

async function sendCartOrder() {
  if (!clientToken) {
    toast('Inicia sesión para tramitar pedidos');
    setTimeout(() => {
      location.href = '/portal';
    }, 1500);
    return;
  }

  const items = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => {
      const product = allProducts.find((item) => item.id == id);
      return product
        ? { nombre: product.name, emoji: product.emoji, precio: product.price, cantidad: quantity, unidad: product.unit }
        : null;
    })
    .filter(Boolean);

  if (!items.length) {
    return;
  }

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + clientToken
      },
      body: JSON.stringify({ items, nota: '' })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Error desconocido al enviar pedido');
    }

    cart = {};
    updateCart();
    toggleCart();
    toast('✅ Pedido enviado correctamente');
  } catch (error) {
    toast('❌ ' + error.message);
  }
}

function toast(message) {
  const toastElement = document.getElementById('toast');
  toastElement.textContent = message;
  toastElement.classList.add('show');
  setTimeout(() => toastElement.classList.remove('show'), 2400);
}
