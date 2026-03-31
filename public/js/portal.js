const STATUS_LABEL = {pendiente:'Pendiente',confirmado:'Confirmado',en_preparacion:'En preparaciÃ³n',enviado:'Enviado',entregado:'Entregado',cancelado:'Cancelado'};
const STATUS_CLASS  = {pendiente:'bp',confirmado:'bc',en_preparacion:'bpr',enviado:'bs',entregado:'bd',cancelado:'bx'};

let clientToken = null;
let myOrders    = [];

// â”€â”€ Vistas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showLogin() {
  document.getElementById('portalView').classList.remove('active');
  document.getElementById('loginView').classList.add('active');
  document.getElementById('loginErr').classList.remove('visible');
  const btn = document.getElementById('loginBtn');
  btn.disabled    = false;
  btn.textContent = 'Entrar â†’';
  setTimeout(() => document.getElementById('loginEmail').focus(), 80);
}

function showPortal(cliente) {
  document.getElementById('loginView').classList.remove('active');
  document.getElementById('portalView').classList.add('active');
  document.getElementById('portalUserName').textContent  = cliente.nombre + (cliente.empresa ? ' Â· ' + cliente.empresa : '');
  document.getElementById('portalGreetName').textContent = cliente.nombre.split(' ')[0];
  document.getElementById('portalGreetSub').textContent  = cliente.empresa ? 'Cuenta B2B Â· ' + cliente.empresa : 'Cuenta B2B';
  loadOrders();
}

// â”€â”€ Arranque â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('DOMContentLoaded', () => {
  // Botones â€” enlazados una sola vez aquÃ­, nunca con onclick inline
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('btnTienda').addEventListener('click', () => window.location.href = '/');
  document.getElementById('btnLogout').addEventListener('click', doLogout);
  document.getElementById('loginEmail').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('loginPass').addEventListener('keydown',  e => { if (e.key === 'Enter') doLogin(); });

  // Comprobar si hay sesiÃ³n guardada
  initSession();
});

async function initSession() {
  clientToken = sessionStorage.getItem('bielsa_client_token');
  if (clientToken) {
    try {
      const r = await fetch('/api/cliente/check', { headers: { Authorization: 'Bearer ' + clientToken } });
      if (r.ok) {
        const d = await r.json();
        showPortal(d.cliente);
        return;
      }
    } catch (_) {}
    sessionStorage.removeItem('bielsa_client_token');
    clientToken = null;
  }
  showLogin();
}

// â”€â”€ Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) { showErr('Introduce email y contraseÃ±a.'); return; }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Entrando...';

  try {
    const r = await fetch('/api/cliente/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Credenciales incorrectas.');
    sessionStorage.setItem('bielsa_client_token', d.token);
    clientToken = d.token;
    showPortal(d.cliente);
  } catch (e) {
    showErr(e.message);
    btn.disabled = false; btn.textContent = 'Entrar â†’';
  }
}

function showErr(msg) {
  const el = document.getElementById('loginErr');
  el.textContent = msg;
  el.classList.add('visible');
}

// â”€â”€ Logout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function doLogout() {
  sessionStorage.removeItem('bielsa_client_token');
  clientToken = null;
  myOrders    = [];
  showLogin();
}

// â”€â”€ Pedidos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadOrders() {
  const c = document.getElementById('ordersContainer');
  c.innerHTML = '<div style="text-align:center;padding:2rem"><span class="spinner"></span></div>';
  try {
    const r = await fetch('/api/orders/mine', { headers: { Authorization: 'Bearer ' + clientToken } });
    if (!r.ok) throw new Error();
    myOrders = await r.json();
    document.getElementById('sc-total').textContent   = myOrders.length;
    document.getElementById('sc-pending').textContent = myOrders.filter(o => o.estado === 'pendiente').length;
    const spent = myOrders.filter(o => o.estado !== 'cancelado').reduce((s, o) => s + o.total, 0);
    document.getElementById('sc-spent').textContent   = spent.toFixed(0);
    renderOrders();
  } catch {
    c.innerHTML = '<div class="empty-orders">âš  Error al cargar pedidos.</div>';
  }
}

function renderOrders() {
  const c = document.getElementById('ordersContainer');
  if (!myOrders.length) {
    c.innerHTML = '<div class="empty-orders">ðŸ“¦ AÃºn no tienes pedidos.<br><br><a href="/">Ver catÃ¡logo â†’</a></div>';
    return;
  }
  c.innerHTML = myOrders.map((o, i) => `
    <div class="order-card">
      <div class="order-head" data-i="${i}">
        <div class="order-head-left">
          <div>
            <div class="order-id">Pedido #${o.id}</div>
            <div class="order-date">${new Date(o.createdAt).toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</div>
          </div>
          <span class="badge ${STATUS_CLASS[o.estado]||'bp'}">${STATUS_LABEL[o.estado]||o.estado}</span>
        </div>
        <div style="display:flex;align-items:center;gap:1rem">
          <span class="order-total-chip">${o.total.toFixed(2)} â‚¬</span>
          <span class="order-toggle" id="tog-${i}">â–¼</span>
        </div>
      </div>
      <div class="order-body" id="body-${i}">
        <div class="order-items-list">
          ${o.items.map(it=>`
            <div class="oi">
              <div><span class="oi-name">${it.emoji||''} ${it.nombre}</span><br>
              <span class="oi-detail">${it.precio.toFixed(2)} â‚¬/${it.unidad} Ã— ${it.cantidad} ${it.unidad}</span></div>
              <span class="oi-sub">${(it.precio*it.cantidad).toFixed(2)} â‚¬</span>
            </div>`).join('')}
        </div>
        <div class="order-total-line"><span>Total</span><span>${o.total.toFixed(2)} â‚¬</span></div>
        ${o.fechaEntrega?`<div class="nota-box">ðŸ“… Entrega solicitada: ${o.fechaEntrega}</div>`:''}
        ${o.nota?`<div class="nota-box">ðŸ“ Nota: ${o.nota}</div>`:''}
      </div>
    </div>`).join('');

  // Eventos de los acordeones (delegaciÃ³n en el contenedor)
  c.addEventListener('click', e => {
    const head = e.target.closest('.order-head');
    if (!head) return;
    const i    = head.dataset.i;
    const body = document.getElementById('body-' + i);
    const tog  = document.getElementById('tog-'  + i);
    const open = body.classList.toggle('open');
    tog.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
  });
}
